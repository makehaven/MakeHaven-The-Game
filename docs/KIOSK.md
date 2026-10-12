# MakeHaven guest game

This is a local HTML5 game. No account or internet connection is needed to play.
Unzip the whole download into a folder on the Raspberry Pi; keep the files together.

## Play

From a terminal in the extracted folder:

```sh
python3 -m http.server 8093 --bind 127.0.0.1
```

Open `http://127.0.0.1:8093` in Chromium. In the source repository, add
`--directory build` to that command. Connect a standard USB or Bluetooth gamepad
and press a button to let the browser discover it.

For fullscreen kiosk operation from the Raspberry Pi OS desktop:

```sh
bash scripts/launch-kiosk.sh
```

The launcher starts a local web server and relaunches Chromium if it exits.
It uses a temporary browser profile and does not change OS settings.
Set `CHROMIUM_BIN`, `MAKEHAVEN_PORT`, or `MAKEHAVEN_WEB_ROOT` if needed.
Ctrl+C in its terminal stops the launcher; a staff keyboard is useful for maintenance.

## Controls

| Action | Xbox-style gamepad | PlayStation-style gamepad | Keyboard |
| --- | --- | --- | --- |
| Move / choose / adjust | Stick or D-pad | Stick or D-pad | Arrows or WASD |
| Jump / confirm | A | Cross | Space or Enter |
| Use making bench | X | Square | E |
| Back / shop map | B | Circle | Escape |
| Return to entrance, keep materials | Y | Triangle | R |
| Pause / resume | Start / Menu | Options | P |
| Toggle sound | View / Select | Share / Create | M |

Choose any of six shops. Collect its five glowing materials, go to the making bench
on the right, and press X / Square. Follow the bench prompts to complete the project.
There are no lives or game-over penalties. Badges last for the current visit.
The welcome screen starts a new visit; returning to the map keeps earned badges.
Leaving an unfinished shop resets that shop's materials when you enter it again.

After 70 seconds without a control change, a reset warning appears. At 90 seconds
the game clears the visit and returns to the welcome screen. Disconnecting a gamepad
pauses the activity until a controller is available; the idle timer still runs.
Sound is off by default and resets to off between visits.

## Pi setup and acceptance

Use Raspberry Pi OS with its graphical desktop, Chromium, a landscape display,
and a standard-mapped gamepad. The game renders at 1280×720 and scales to the screen.
Hardware acceleration should stay enabled. No GPU-intensive bloom is used in the
new scenes. Performance has been checked in desktop Chromium, not on a physical Pi.

Once the launcher works manually, add it to the desktop session's autostart using
an absolute path. For desktops supporting XDG autostart, an example `.desktop` file is:

```ini
[Desktop Entry]
Type=Application
Name=MakeHaven Game
Exec=bash /home/YOUR_USER/MakeHaven-Game/scripts/launch-kiosk.sh
Terminal=false
```

Use your actual username/path. Configure automatic desktop login and turn off screen
blanking in Raspberry Pi OS. See the [official Raspberry Pi kiosk guide](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/)
for desktop startup details; they vary by OS release.

Before putting it in front of guests, check:

- A cold boot opens the game and the physical controller starts a visit.
- Stick, D-pad, all four face buttons, pause, and audio toggle work.
- Each shop can be completed comfortably on the installed screen.
- Unplugging/reconnecting the controller preserves the current activity.
- Walking away returns to the welcome screen after 90 seconds.
- It still starts and plays with Wi-Fi disconnected.
- It runs for an hour without overheating, slowing down, or screen blanking.

The artwork is an illustrated interpretation of the shops, not an exact floor plan.
The bench activities are playful introductions, not machine operating instructions.
