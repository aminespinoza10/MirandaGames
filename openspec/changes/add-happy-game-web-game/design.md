# Design

## Context

The repo is empty apart from a README (see proposal.md for why we're building this). It will eventually hold several games, so each game gets its own folder under `games/`. The goal is a game that plays like the original first; customizing the assets comes after (see specs/game-assets).

## Goals / Non-Goals

**Goals:**
- Zero dependencies and no build step, so it's easy to open, read and tinker with.
- Asset swapping only touches `assets/` files and `manifest.json`.
- Gameplay tuning (gravity, speed, gap) lives in one config file, separate from the art.
- Logic can be unit-tested without a browser.

**Non-Goals:**
- Medals, a leaderboard, settings menus, day/night themes. These can be added later as their own changes.
- Visual asset editor tooling.
- Offline/PWA install.

## Decisions

### Vanilla JavaScript (ES modules) + Canvas 2D, no framework
Flappy Bird is a single-screen game with a few dozen sprites, so a framework would add more than it saves. Plain ES modules run directly in every modern browser.
*Alternatives:* Phaser (heavy, has its own asset system to learn), a TypeScript + Vite build (needs a toolchain, which isn't worth it at this size).

### Layout

```
games/happy-game/
  index.html            canvas + loads src/main.js
  style.css             full-window centering, image-rendering: pixelated
  src/
    main.js             boot: load manifest → assets → start loop
    config.js           gameplay tuning constants (logical units)
    loop.js             fixed-timestep loop
    game.js             state machine (Ready / Playing / GameOver), update + render orchestration
    bird.js, pipes.js   pure state + update functions
    collision.js        AABB checks (pure)
    score.js            scoring + best-score persistence (storage injected)
    assets.js           manifest loader, fallback images, sound wrapper
    input.js            pointer/keyboard → "flap" events
    render.js           all drawing from game state
  assets/
    manifest.json
    images/*.png
    sounds/*.wav
  test/*.test.js        node:test unit tests for pure modules
```

### Fixed logical resolution 288×512, scaled to fit
This matches the original's proportions. All gameplay math uses logical units. The canvas backing store is sized to logical × integer-ish scale × devicePixelRatio, and the CSS keeps the aspect ratio. `imageSmoothingEnabled = false` keeps pixel art crisp.

### Fixed-timestep simulation (60 updates/s) with accumulator
This makes the trajectory frame-rate independent, as the spec requires. Rendering runs on `requestAnimationFrame`. The accumulator is capped (e.g. 250 ms) so that a backgrounded tab doesn't trigger a "spiral of death."
*Alternative:* variable dt physics gives slightly different jump heights at 60 Hz and 144 Hz, which breaks the "identical feel" goal.

### Pure logic modules, rendering separated
`bird`, `pipes`, `collision` and `score` hold no DOM references, so they can be tested with `node --test` (Node ≥ 20, already installed). `render.js` is the only module that draws.

### Asset manifest is JSON with keys, paths and logical sizes
Example shape:
```json
{
  "images": {
    "bird":       { "frames": ["images/bird-0.png","images/bird-1.png","images/bird-2.png"], "width": 34, "height": 24 },
    "background": { "src": "images/background.png", "width": 288, "height": 512 },
    "ground":     { "src": "images/ground.png", "width": 336, "height": 112 },
    "pipeTop":    { "src": "images/pipe-top.png", "width": 52, "height": 320 },
    "pipeBottom": { "src": "images/pipe-bottom.png", "width": 52, "height": 320 },
    "digits":     { "frames": ["images/0.png", "...", "images/9.png"], "width": 24, "height": 36 },
    "getReady":   { "src": "images/get-ready.png", "width": 184, "height": 267 },
    "gameOver":   { "src": "images/game-over.png", "width": 192, "height": 42 }
  },
  "sounds": { "flap": "sounds/flap.wav", "point": "sounds/point.wav", "hit": "sounds/hit.wav", "die": "sounds/die.wav" }
}
```
JSON is safe to edit by hand and can't break the code the way a JS file can. The draw size comes from `width`/`height`, so art at any resolution works. Pipes are drawn by stretching or clipping the pipe image to the needed length, anchored at the gap.
*Alternative:* a JS config module (would allow comments, but a syntax error there crashes the boot).

### Bird hitbox slightly inset from its declared size
The hitbox is the declared rectangle shrunk by a few logical pixels. This matches the forgiving feel of the original. The inset is defined in `config.js`, not in the manifest, because it's part of the gameplay.

### Fallbacks via generated canvases
When an image fails to load, `assets.js` substitutes an offscreen canvas of the declared size filled with a key-specific color. Renderers never branch on a missing asset. Sounds use `HTMLAudioElement` clones per play (simple, and overlapping playback works). A failed sound becomes a no-op. Audio is unlocked on the first input.
*Alternative:* Web Audio API offers lower latency, but its decode-failure handling is more complex. We can revisit this if latency is noticeable.

### Placeholder art is original
We'll make simple original pixel-art PNGs (bird, pipes, sky, ground, digits, banners) at the declared sizes, plus short generated sound effects. We won't copy the original game's art, which is copyrighted. These placeholders are exactly what the user will later replace.

### Best score in localStorage, wrapped in try/catch
The storage key is `mirandagames.happy-game.best`. When storage fails, the game falls back to an in-memory value.

### Serving
ES modules and `fetch(manifest.json)` don't work from `file://`. The README documents `npx serve games/happy-game`, or `python3 -m http.server`, as the way to run it locally.

### Deployment: rsync over SSH into the existing nginx site
The server (Ubuntu 24.04, nginx 1.24) already has a default site on port 80 with `root /var/www/html` and `try_files $uri $uri/ /index.html`. It also hosts `/venster/`. A folder at `/var/www/html/<game>/` is therefore served at `/<game>/` with no nginx change.
*Alternatives:* a new server block or port (needs sudo and a config reload on every new game), or Docker on the server (more moving parts than a static folder needs).

`scripts/deploy.sh <game>` (bash, runs from WSL):
1. Load defaults, then `deploy.env` if present (gitignored), then env vars. The defaults are `DEPLOY_HOST=192.168.68.77`, `DEPLOY_USER=aminespinoza`, `DEPLOY_KEY=~/.ssh/id_home_ubuntu`, `DEPLOY_WEBROOT=/var/www/html`.
2. Validate that `games/<game>/` exists and that the target resolves to exactly `$DEPLOY_WEBROOT/<game>`, where `<game>` matches `^[a-z0-9-]+$`. This is the guard for `--delete`.
3. Run `npm test` in the game folder. Abort on failure.
4. Over SSH with `BatchMode=yes`, check `test -w <target>`. If the check fails, print `sudo mkdir -p <target> && sudo chown <user>: <target>` and exit.
5. Write `build.json` with `{ "build": "<git short sha>-<UTC timestamp>" }` into a temporary staging copy of the game.
6. Run `rsync -az --delete` with excludes for `test/`, `package.json`, `README.md`, `*.test.js` and dotfiles, uploading the staging copy to the target.
7. `curl` the game URL (expects 200 + `text/html`) and `assets/manifest.json` (expects 200 + JSON), then print the URL.

The script is generic over `<game>`, so future games deploy the same way, each after its own one-time folder setup.

### Cache-busting via build id
nginx sends `ETag`/`Last-Modified` but no `Cache-Control`, so browsers may cache assets based on their own heuristics and show the old art after a swap. To prevent this, `main.js` fetches `build.json` and `manifest.json` with `cache: 'no-store'`, and `assets.js` appends `?v=<build>` to every asset URL. When `build.json` is absent (local development), the build id is the page-load timestamp, so assets are always fresh while editing.
*Alternative:* add `Cache-Control: no-cache` in nginx (needs sudo and a config edit, and must be done again for each game).

### Detecting "missing" assets behind the SPA fallback
Because of `try_files ... /index.html`, a bad path returns the site's root page with status 200. Images: an HTML body fails to decode, so `onerror` already fires. Sounds: `HTMLAudioElement` fires `error` on undecodable content. Manifest: `main.js` checks `response.ok` and the JSON parse, and shows a clear error on screen if either fails. The warning text says "failed to load or decode" rather than "404".

## Risks / Trade-offs

- [Game feel differs from the original] → Every tuning number (gravity ≈ 0.25 px/step², flap ≈ −4.6 px/step, scroll speed 2 px/step, pipe gap ~100 px, spacing ~150 px) sits in `config.js` and can be adjusted during playtesting.
- [Replacement art with a different aspect ratio looks stretched] → The README tells users to update `width`/`height` in the manifest and to keep the hitbox reasonable for the bird.
- [HTMLAudio latency on some mobile browsers] → Acceptable for v1. The sound wrapper is isolated, so it can be switched to Web Audio later.
- [Opening index.html directly shows a blank page] → `main.js` detects `file:` protocol and shows a message explaining how to serve the game.
- [`rsync --delete` pointed at the wrong folder wipes other content such as `/venster`] → The script validates the game name, builds the target from the web root and game name instead of taking a free-form path, and the deploy user can only write to folders it has been given via the one-time `chown`.
- [Players see stale assets after a deploy] → The build id is appended to asset URLs, and `build.json`/`manifest.json` are fetched with `no-store`.
- [nginx `mime.types` may lack an entry for `.wav`] → Browsers sniff WAV content, and post-deploy playtesting checks that sounds play. If any browser refuses, switch the placeholders to `.ogg`/`.mp3`, which are in the default mime types.
- [Server IP changes (DHCP)] → Override `DEPLOY_HOST` in `deploy.env`. Reserving the IP in the router is recommended.
