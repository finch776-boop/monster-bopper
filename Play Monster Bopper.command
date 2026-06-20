#!/bin/bash
# Double-click to play Monster Bopper.
# Starts a tiny local web server, opens the game on this Mac, AND prints a
# link you can open on a Fire tablet / iPhone that's on the same Wi-Fi.
# Keep this Terminal window open while playing; close it to stop.

cd "$(dirname "$0")" || exit 1

# Pick the first FREE port (avoids clashing with other servers on this Mac).
PORT=""
for P in 8091 8181 8282 7777 9090 8090 8765; do
  if ! lsof -nP -iTCP:$P -sTCP:LISTEN >/dev/null 2>&1; then PORT=$P; break; fi
done
[ -z "$PORT" ] && PORT=8091

# Find the IP of whichever interface actually has the network (Wi-Fi/Ethernet).
IFACE=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')
IP=$(ipconfig getifaddr "$IFACE" 2>/dev/null)
[ -z "$IP" ] && IP=$(ipconfig getifaddr en1 2>/dev/null || ipconfig getifaddr en0 2>/dev/null)

echo ""
echo "  ⚡  TEEN TITANS GO! — MONSTER BOPPER ⚡"
echo "  ------------------------------------------------"
echo "  On THIS Mac:            http://localhost:$PORT"
if [ -n "$IP" ]; then
  echo "  On a Fire tablet/iPhone (same Wi-Fi):"
  echo "        http://$IP:$PORT"
  echo ""
  echo "  Tip: on the tablet/phone, after it loads, use the browser menu"
  echo "       'Add to Home Screen' for a full-screen, app-like game."
fi
echo "  ------------------------------------------------"
echo "  ❌  Close this window when you're done playing."
echo ""
echo "  (If macOS asks to allow incoming network connections, click Allow"
echo "   so the tablet/phone can reach the game.)"
echo ""

# Open the browser on this Mac shortly after the server starts.
( sleep 1; open "http://localhost:$PORT" ) &

# Static server (Python 3 ships with macOS). Binds to all interfaces for LAN.
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT"
else
  python -m SimpleHTTPServer "$PORT"
fi
