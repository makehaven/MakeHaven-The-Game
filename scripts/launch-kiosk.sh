#!/usr/bin/env bash
# Run from the Pi's desktop session. Does not install packages or change OS settings.
set -euo pipefail
project_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
web_root=${MAKEHAVEN_WEB_ROOT:-$project_root/build}
if [[ ! -f "$web_root/index.html" && -f "$project_root/index.html" ]]; then web_root=$project_root; fi
if [[ ! -f "$web_root/index.html" ]]; then echo 'No browser build found. Export the game first.' >&2; exit 1; fi
browser_bin=${CHROMIUM_BIN:-$(command -v chromium || command -v chromium-browser || true)}
if [[ -z "$browser_bin" ]]; then echo 'Install Chromium using Raspberry Pi OS, then run this again.' >&2; exit 1; fi
port=${MAKEHAVEN_PORT:-8093}
run_dir=$(mktemp -d /tmp/makehaven-kiosk.XXXXXX)
server_pid=''
cleanup() {
  if [[ -n "$server_pid" ]]; then kill "$server_pid" 2>/dev/null || true; fi
  rm -rf -- "$run_dir"
}
trap cleanup EXIT
trap 'exit 0' INT TERM
python3 -m http.server "$port" --bind 127.0.0.1 --directory "$web_root" > "$run_dir/server.log" 2>&1 &
server_pid=$!
sleep 1
if ! kill -0 "$server_pid" 2>/dev/null; then cat "$run_dir/server.log" >&2; exit 1; fi
echo "MakeHaven is running at http://127.0.0.1:$port"
while kill -0 "$server_pid" 2>/dev/null; do
  "$browser_bin" --kiosk --no-first-run --disable-session-crashed-bubble \
    --autoplay-policy=no-user-gesture-required --user-data-dir="$run_dir/browser" \
    "http://127.0.0.1:$port" || true
  sleep 2
done
