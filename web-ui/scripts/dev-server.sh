#!/usr/bin/env bash
# The one shared dev server: starts it on the port if nothing is listening there,
# otherwise attaches to the running one. The server runs in its own session so
# it outlives whichever Claude session or terminal started it; this script only
# streams its log and exits when the server stops.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${DEV_PORT:-5199}"
LOG=".dev/dev-server-$PORT.log"
mkdir -p .dev

listening() { ss -Hltn "sport = :$PORT" | grep -q .; }

exec 9>".dev/dev-server-$PORT.lock"
flock 9
if listening; then
	echo "Reusing the dev server already running on http://localhost:$PORT"
else
	echo "Starting the dev server on http://localhost:$PORT"
	# shellcheck disable=SC1091
	source "$HOME/.nvm/nvm.sh"
	nvm use --silent
	: >"$LOG"
	setsid nohup npm run dev -- --port "$PORT" --strictPort \
		>"$LOG" 2>&1 </dev/null 9>&- &
	for _ in $(seq 240); do
		listening && break
		sleep 0.5
	done
fi
flock -u 9
exec 9>&-

echo "Log: web-ui/$LOG — stop it with: fuser -k $PORT/tcp"
tail -n 40 -F "$LOG" 2>/dev/null &
tail_pid=$!
trap 'kill "$tail_pid" 2>/dev/null' EXIT INT TERM
while listening; do sleep 2; done
echo "The dev server on $PORT stopped."
