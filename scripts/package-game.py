#!/usr/bin/env python3
"""Package an existing GDevelop HTML5 export as a self-contained kiosk ZIP."""
from pathlib import Path
import shutil
import zipfile

root = Path(__file__).resolve().parent.parent
build = root / 'build'
index = build / 'index.html'
if not index.is_file():
    raise SystemExit('Export game.json to build/ with GDevelop first.')
shutil.copyfile(root / 'assets/image/Idle2.png', build / 'favicon.png')
html = index.read_text()
if 'href="favicon.png"' not in html:
    html = html.replace('</head>', '<link rel="icon" href="favicon.png">\n</head>')
index.write_text(html)
output = root / 'output'
output.mkdir(exist_ok=True)
with zipfile.ZipFile(output / 'MakeHaven-Game.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for f in sorted(build.rglob('*')):
        if f.is_file():
            archive.write(f, f.relative_to(build))
    archive.write(root / 'scripts/launch-kiosk.sh', 'scripts/launch-kiosk.sh')
    archive.write(root / 'docs/KIOSK.md', 'README.md')
print('Packaged output/MakeHaven-Game.zip (HTML5 game, local assets, kiosk launcher).')
