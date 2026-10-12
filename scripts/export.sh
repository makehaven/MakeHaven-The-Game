#!/usr/bin/env bash
set -euo pipefail
project_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$project_root"
gdevelop_bin=${GDEVELOP_BIN:-$(command -v gdevelop || true)}
if [[ -z "$gdevelop_bin" ]]; then
  echo 'Set GDEVELOP_BIN to your GDevelop executable, or export game.json from GDevelop.' >&2
  exit 1
fi
python3 scripts/build-project.py
profile_dir=$(mktemp -d /tmp/makehaven-export.XXXXXX)
trap 'rm -rf -- "$profile_dir"' EXIT
"$gdevelop_bin" --no-sandbox --ozone-platform=headless --disable-gpu \
  --user-data-dir="$profile_dir" --disable-update-check \
  --run-command EXPORT_HTML5_EXTERNAL "$project_root/game.json"
python3 scripts/package-game.py
