# MakeHaven: Make Something

A gamepad-first guest game built in GDevelop. Explore six shop layouts, gather
materials, complete a short making activity, and collect a badge for each shop.

| Shop | Activity |
| --- | --- |
| Woodshop | Assemble a birdhouse in order |
| Textiles | Follow a four-color stitching pattern |
| Metal shop | Time three joins to make a sculpture |
| Electronics | Rotate wires to complete an LED circuit |
| Printmaking | Register three color layers |
| BioLab | Focus three stylized microscope samples |

## Play the browser build

```sh
python3 -m http.server 8093 --bind 127.0.0.1 --directory build
```

Open **http://127.0.0.1:8093**. Press a gamepad button, then A / Cross to begin.
Keyboard fallback: arrows, Space/Enter, E, Escape. Full controls and Pi setup are
in [docs/KIOSK.md](docs/KIOSK.md).

The ready-to-copy release is `output/MakeHaven-Game.zip`. Build outputs are ignored
by Git; create them using the export instructions below when cloning the repository.

## Edit and build

- `game.json`: working GDevelop project, opens and previews in GDevelop 5.
- `levels.json`: shop copy, colors, project definitions, and platform coordinates.
- `scripts/gameplay.js`: shared input, fixed-step platform physics, making activities,
  native GDevelop sprite/text rendering, session badges, and kiosk recovery.
- `assets/shops/`: six generated backgrounds plus small code-native UI shapes.
- `docs/asset-prompts.json`: exact prompts; all backgrounds used built-in image generation.

The new scenes are generated from the level data and shared script. Edit those source
files, then run `python3 scripts/build-project.py` to update `game.json`. Direct edits
to generated scenes are replaced on rebuild. Existing legacy objects, extensions,
and artwork are retained in the project, but the new scenes use `Maker` objects and
their own shared JavaScript event instead of the old enemy/portal event sheet.

To export using the GDevelop CLI (tested with 5.6.281 on Linux):

```sh
GDEVELOP_BIN=/path/to/gdevelop bash scripts/export.sh
```

Or open `game.json` in GDevelop, export an HTML5 game into `build/`, then run:

```sh
python3 scripts/package-game.py
```

All game resources are local. No runtime package installation is necessary on the Pi.

## Verification

```sh
node tests/gameplay.test.cjs
```

This checks actual jump-physics reachability in all six layouts, held-button handling,
rescue, pause, idle reset, forgiving assembly, badges, and 30/60 FPS consistency.

For exported browser acceptance tests, install Playwright in a development environment,
serve `build/` at port 8093, and run:

```sh
node tests/browser-acceptance.cjs
```

`PLAYWRIGHT_PATH` and `CHROME_PATH` can point to an existing installation. Tests simulate
a standard gamepad and block external requests. They exercise an actual platform jump,
all six bench activities, badges, disconnect recovery, and idle reset. A test-only URL
parameter (`?test=1`) exposes position and idle fixtures for isolated acceptance checks;
normal kiosk URLs do not expose those hooks. Bench tests place the player at pickups;
the separate physics suite checks that the platforms are reachable without teleporting.

Screenshots of the exported game are in `docs/screenshots/`. Physical gamepad mapping,
Pi performance, and an unattended on-device soak test still require the installation hardware.
