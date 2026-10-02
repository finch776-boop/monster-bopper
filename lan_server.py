#!/usr/bin/env python3
"""Private same-LAN server and WebRTC signaling for Monster Bopper.

The server has no external dependencies, does not contact the internet, and keeps
room signaling only in memory. Stopping it erases every room and join offer.
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import re
import threading
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
MAX_BODY = 1_500_000
ROOM_TTL = 90
SLOT_COUNT = 4
ROOM_CODE = re.compile(r"^\d{4}$")
PUBLIC_PATHS = {"/", "/index.html", "/three.module.js", "/manifest.json", "/icon-192.png", "/icon-512.png", "/sw.js"}
STATE = {"room": None, "slots": [None] * SLOT_COUNT}
STATE_LOCK = threading.Lock()


def _private_client(raw_ip: str) -> bool:
    try:
        address = ipaddress.ip_address(raw_ip.split("%", 1)[0])
        if getattr(address, "ipv4_mapped", None):
            address = address.ipv4_mapped
        return address.is_loopback or address.is_private or address.is_link_local
    except ValueError:
        return False


def _fresh(item: object) -> bool:
    return isinstance(item, dict) and time.time() * 1000 - float(item.get("t", 0)) < ROOM_TTL * 1000


class MonsterBopperHandler(SimpleHTTPRequestHandler):
    server_version = "MonsterBopperLAN/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _api_allowed(self) -> bool:
        if _private_client(self.client_address[0]):
            return True
        self._json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "local_network_only"})
        return False

    def _read_json(self) -> dict | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length < 2 or length > MAX_BODY:
            return None
        try:
            value = json.loads(self.rfile.read(length))
            return value if isinstance(value, dict) else None
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None

    def _room_code(self) -> str:
        return self.headers.get("X-Room-Code", "").strip()

    def _authorized(self) -> bool:
        room = STATE["room"]
        return _fresh(room) and self._room_code() == room.get("_code")

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if not path.startswith("/api/"):
            if path not in PUBLIC_PATHS:
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            return super().do_GET()
        if not self._api_allowed():
            return
        with STATE_LOCK:
            if path == "/api/status":
                return self._json(HTTPStatus.OK, {"ok": True, "local_only": True, "service": "monster-bopper-lan"})
            if path == "/api/room":
                if not self._authorized():
                    return self._json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "room_code_required"})
                room = {k: v for k, v in STATE["room"].items() if k != "_code"}
                return self._json(HTTPStatus.OK, room)
            match = re.fullmatch(r"/api/slots/(\d+)", path)
            if match:
                if not self._authorized():
                    return self._json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "room_code_required"})
                index = int(match.group(1))
                if index >= SLOT_COUNT:
                    return self._json(HTTPStatus.NOT_FOUND, {"ok": False})
                value = STATE["slots"][index]
                return self._json(HTTPStatus.OK, value if _fresh(value) else {})
        self._json(HTTPStatus.NOT_FOUND, {"ok": False})

    def do_HEAD(self) -> None:
        path = urlparse(self.path).path
        if path not in PUBLIC_PATHS:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        super().do_HEAD()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if not path.startswith("/api/"):
            return self._json(HTTPStatus.METHOD_NOT_ALLOWED, {"ok": False})
        if not self._api_allowed():
            return
        value = self._read_json()
        if value is None:
            return self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "invalid_json"})
        with STATE_LOCK:
            if path == "/api/room":
                code = str(value.pop("code", self._room_code())).strip()
                room = STATE["room"]
                if not ROOM_CODE.fullmatch(code):
                    return self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "four_digit_code_required"})
                if _fresh(room) and code != room.get("_code"):
                    return self._json(HTTPStatus.CONFLICT, {"ok": False, "error": "another_room_is_open"})
                if not _fresh(room):
                    STATE["slots"] = [None] * SLOT_COUNT
                value["_code"] = code
                STATE["room"] = value
                return self._json(HTTPStatus.OK, {"ok": True})
            if path == "/api/close":
                if not self._authorized():
                    return self._json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "room_code_required"})
                STATE["room"] = None
                STATE["slots"] = [None] * SLOT_COUNT
                return self._json(HTTPStatus.OK, {"ok": True})
            match = re.fullmatch(r"/api/slots/(\d+)", path)
            if match:
                if not self._authorized():
                    return self._json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "room_code_required"})
                index = int(match.group(1))
                if index >= SLOT_COUNT:
                    return self._json(HTTPStatus.NOT_FOUND, {"ok": False})
                STATE["slots"][index] = value
                return self._json(HTTPStatus.OK, {"ok": True})
        self._json(HTTPStatus.NOT_FOUND, {"ok": False})

    def end_headers(self) -> None:
        if not urlparse(self.path).path.startswith("/api/"):
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Monster Bopper privately on the local network")
    parser.add_argument("--bind", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8091)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.bind, args.port), MonsterBopperHandler)
    print(f"Monster Bopper family server: http://localhost:{args.port}", flush=True)
    print("Local-network devices only. Room signaling is erased when this window closes.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
