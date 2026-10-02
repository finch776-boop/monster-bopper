import http.client
import json
import threading
import unittest

import lan_server


class LanServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = lan_server.ThreadingHTTPServer(("127.0.0.1", 0), lan_server.MonsterBopperHandler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def setUp(self):
        with lan_server.STATE_LOCK:
            lan_server.STATE["room"] = None
            lan_server.STATE["slots"] = [None] * lan_server.SLOT_COUNT

    def request(self, method, path, payload=None, code=None):
        headers = {}
        body = None
        if payload is not None:
            body = json.dumps(payload)
            headers["Content-Type"] = "application/json"
        if code:
            headers["X-Room-Code"] = code
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
        conn.request(method, path, body=body, headers=headers)
        response = conn.getresponse()
        data = json.loads(response.read().decode("utf-8"))
        status = response.status
        conn.close()
        return status, data

    def test_status_identifies_local_only_service(self):
        status, data = self.request("GET", "/api/status")
        self.assertEqual(200, status)
        self.assertTrue(data["local_only"])
        self.assertEqual("monster-bopper-lan", data["service"])

    def test_server_does_not_expose_repository_or_private_files(self):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
        conn.request("GET", "/.git/config")
        response = conn.getresponse()
        response.read()
        self.assertEqual(404, response.status)
        conn.close()

    def test_room_requires_pin_and_never_returns_it(self):
        status, _ = self.request("POST", "/api/room", {"t": 1, "code": "12"})
        self.assertEqual(400, status)
        status, _ = self.request("POST", "/api/room", {"t": 9_999_999_999_999, "name": "Player 1", "code": "2468"}, "2468")
        self.assertEqual(200, status)
        status, _ = self.request("GET", "/api/room", code="1111")
        self.assertEqual(403, status)
        status, room = self.request("GET", "/api/room", code="2468")
        self.assertEqual(200, status)
        self.assertNotIn("code", room)
        self.assertNotIn("_code", room)

    def test_signaling_slot_round_trip_requires_room_pin(self):
        self.request("POST", "/api/room", {"t": 9_999_999_999_999, "code": "1357"}, "1357")
        offer = {"t": 9_999_999_999_999, "tok": "guest", "sdp": "local-offer"}
        status, _ = self.request("POST", "/api/slots/0", offer, "1357")
        self.assertEqual(200, status)
        status, saved = self.request("GET", "/api/slots/0", code="1357")
        self.assertEqual(200, status)
        self.assertEqual("local-offer", saved["sdp"])
        status, _ = self.request("GET", "/api/slots/0", code="0000")
        self.assertEqual(403, status)

    def test_host_can_close_room_and_start_a_new_one_immediately(self):
        self.request("POST", "/api/room", {"t": 9_999_999_999_999, "code": "2468"}, "2468")
        status, _ = self.request("POST", "/api/close", {}, "2468")
        self.assertEqual(200, status)
        status, _ = self.request("POST", "/api/room", {"t": 9_999_999_999_999, "code": "1357"}, "1357")
        self.assertEqual(200, status)


if __name__ == "__main__":
    unittest.main()
