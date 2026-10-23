# Happy Game

Our Flappy Bird clone for the browser: plain JavaScript and a `<canvas>`, no dependencies, no build step.
Every image and sound can be swapped by editing one file, `assets/manifest.json`.

## Run it locally

The game must be served over HTTP (opening `index.html` directly won't work). From this folder:

```bash
npx serve            # or: python3 -m http.server 8000
```

Open the address it prints (for `http.server`: <http://localhost:8000>).

Controls: click, tap, **Space** or **Up Arrow** to flap.

## Run the tests

```bash
npm test
```

Requires Node.js 20 or newer. The tests cover the physics, pipes, collisions, scoring, game flow and the asset manifest.

## Customize your game

All art and sounds live in `assets/`, and `assets/manifest.json` says which file is used for what.
To customize, drop your files into `assets/images/` or `assets/sounds/`, point the manifest at them and reload.
No code changes needed.

### The manifest

```json
"bird": {
  "frames": ["images/happy-0.png", "images/happy-1.png"],
  "width": 32,
  "height": 34
}
```

- Paths are relative to `assets/`.
- Use `"src": "images/file.png"` for a single image, or `"frames": [...]` for an animation.
- **`width` and `height` are the size on screen, in game pixels** (the game is 288 × 512). Your image can have any
  resolution: it gets scaled to this size. For sharper art, draw it at 4× (the puppy is 128 × 136 for a `32 × 34` entry).
  Keep the same proportions as your image, or it will look stretched.

| Key | What it is | Notes |
| --- | --- | --- |
| `bird` | The player | Any number of `frames` (1 = no flapping animation). Its size is also its hitbox, minus a small margin. |
| `birdDead` | The player after a crash (optional) | Shown upright while it falls and on the game over screen, standing on the bottom edge of `bird` (taller art grows upward). Leave it out to keep using `bird`. |
| `background` | Sky / scenery | Drawn from the top; repeated sideways if narrower than 288. |
| `ground` | Scrolling floor | Repeats sideways, so make the left and right edges match. Its `height` sets where the floor is: taller ground = less room to fly. |
| `pipeTop` | Upper pipe | The open end faces down. Stretched if a gap needs more length than the image has. |
| `pipeBottom` | Lower pipe | The open end faces up. `pipeTop`'s `width` is the pipe hitbox width. |
| `digits` | Score numbers | Exactly 10 `frames`, in order 0 → 9. |
| `getReady` | Start screen overlay | Drawn centered near the top. Keep the left part clear, because the bird hovers there. |
| `gameOver` | Game over title | Drawn above the score panel. |
| `flap`, `point`, `hit`, `die` (in `sounds`) | Sound effects | `.wav`, `.mp3` or `.ogg`. `die` plays when the bird lands after hitting a pipe. |

### If something doesn't show up

Open the browser console (F12). A missing or broken file is reported like this:

```
[assets] background: failed to load or decode "images/backgrund.png", using a fallback
```

The game keeps running with a plain colored stand-in (or silence), so look for a typo in the path.
If the manifest itself has a mistake (a missing key, a missing size, not 10 digits), the page says what's wrong.

### Change how the game feels

Gravity, flap strength, scroll speed, pipe gap and spacing live in `src/config.js`, separate from the art.
Each value is commented. Distances are game pixels and speeds are per step (60 steps per second).

### Regenerate the art

```bash
npm run placeholders
```

This redraws the candy-land background and floor, the candy sticks, the digits, the title overlays and the sounds in `assets/`,
and **overwrites files with the same names**. The puppy sprites (`happy-*.png`) are not generated, so they are never touched.

## Deploy to the home server

From the **repo root**:

```bash
./scripts/deploy.sh happy-game
```

It runs the tests, uploads the game and checks it's live at <http://192.168.68.77/happy-game/>.
Only what the browser needs is uploaded (`test/`, `tools/`, `package.json` and this README stay local).
Files you delete locally are also removed from the server's `happy-game` folder, and nothing else on the server is touched.
After a deploy, a normal reload shows the new art and sounds.

See the [root README](../../README.md#deploying) for the one-time server setup, settings and troubleshooting.

## How it's organized

```
index.html, style.css   page + full-window scaling
build.json              build stamp (written by the deploy script; null locally)
src/main.js             boot: load manifest and assets, start the loop
src/config.js           gameplay tuning
src/game.js             Ready → Playing → Game Over state machine
src/bird.js, pipes.js, collision.js, score.js   game rules (pure, unit-tested)
src/assets.js           manifest loading and fallbacks
src/render.js, input.js, loop.js                drawing, controls, fixed 60 Hz timestep
assets/                 manifest.json, images/, sounds/
test/                   node:test unit tests
tools/                  art and sound generator (not deployed)
```
