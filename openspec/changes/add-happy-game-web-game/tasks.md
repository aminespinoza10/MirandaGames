# Tasks

## 1. Scaffolding

- [x] 1.1 Create `games/happy-game/` with `index.html`, `style.css`, `src/`, `assets/images/`, `assets/sounds/`, `test/`, and a `package.json` with `"type": "module"` and `"test": "node --test test/"`. Verify by serving the folder and seeing a blank centered canvas with no console errors
- [x] 1.2 Add `src/config.js` with logical resolution (288×512) and all gameplay tuning constants from design.md. Verify that it imports cleanly in Node (`node -e "import('./src/config.js')"`)

## 2. Core logic (pure, tested)

- [x] 2.1 Implement `src/loop.js` fixed-timestep loop (60 Hz, capped accumulator), and verify with a unit test that simulated 16.7 ms and 6.9 ms frame sequences yield the same step count over 1 s
- [x] 2.2 Implement `src/bird.js` (gravity, max fall speed, flap sets velocity, rotation from velocity, idle bob, frame cycling for N frames), and verify with unit tests for falling, terminal velocity, flap override, nose-dive rotation and a single-frame bird
- [x] 2.3 Implement `src/pipes.js` (spawn at fixed spacing, random gap within margins via injectable RNG, scroll, removal offscreen), and verify with unit tests for spacing, gap bounds and removal
- [x] 2.4 Implement `src/collision.js` (inset bird hitbox vs. pipe rects and ground; top of screen not lethal, but pipe columns extend upward), and verify with unit tests for pipe hit, ground hit, above-screen-clear and above-screen-in-pipe-column
- [x] 2.5 Implement `src/score.js` (one point per pipe center crossed, best score with injected storage + in-memory fallback), and verify with unit tests for once-per-pipe, new best, and throwing storage
- [x] 2.6 Implement `src/game.js` state machine (Ready → Playing → Game Over → Ready with 0.5 s debounce, post-hit fall, scroll stop), and verify with unit tests driving flap events through each transition

## 3. Assets

- [x] 3.1 Create original placeholder PNGs (3 bird frames, background, ground, top/bottom pipe, digits 0–9, get-ready, game-over) at the sizes in design.md, and verify that each file opens and matches its declared size
- [x] 3.2 Create short placeholder WAVs for flap, point, hit and die, and verify that each plays in a browser
- [x] 3.3 Write `assets/manifest.json` with every required key from specs/game-assets, and verify with a unit test that the manifest contains all required keys and every referenced file exists
- [x] 3.4 Implement `src/assets.js` (load manifest, load images/sounds in parallel, generated colored-canvas fallback for failed images, silent no-op for failed sounds, console warning with key + path, audio unlock on first input). Verify by temporarily breaking the background and flap paths and confirming the game plays with a solid background, no flap sound and two console warnings

## 4. Rendering, input and boot

- [x] 4.1 Implement `src/input.js` (pointer down on canvas, Space/ArrowUp, `preventDefault` to avoid scroll/zoom, ignore key repeat), and verify on desktop and in mobile emulation that taps flap without scrolling the page
- [x] 4.2 Implement `src/render.js` (background, scrolling ground, pipes stretched from manifest images, rotated/animated bird, digit-sprite score, Ready/Game Over overlays with score, best and "new" marker, loading indication), and verify visually through each state
- [x] 4.3 Implement `src/main.js` + `style.css` (boot sequence, `file:` protocol notice, responsive scaling with DPR and pixelated rendering, resize/orientation handling), and verify that resizing the window keeps the aspect ratio and crisp pixels
- [x] 4.4 Wire sounds to events (flap, point, hit, die on ground after a pipe hit), and verify each plays at the right moment after the first interaction

## 5. Docs and integration

- [x] 5.1 Update root `README.md` and add `games/happy-game/README.md` with how to run (`npx serve` / `python3 -m http.server`), how to run tests, and a "Customize your game" guide (manifest keys, declared sizes, frame counts, where to tune physics). Verify by following the guide to swap the bird for another image
- [x] 5.2 Run `npm test` in `games/happy-game/` and verify all tests pass
- [ ] 5.3 Playtest at 60 Hz and a high-refresh display (or a throttled-CPU emulation) and compare feel against the original. Adjust `config.js` tuning, and verify that a full round (start, score several pipes, die, see best, restart) works on desktop and mobile emulation

## 6. Deployment

- [x] 6.1 Write `scripts/deploy.sh` per design.md (config layering, game-name/target guard, tests gate, writability check with setup hint, staging copy with `build.json`, `rsync --delete` with excludes, curl verification), plus `deploy.env.example`, and add `deploy.env` to root `.gitignore`. Verify that `./scripts/deploy.sh nope` lists games and exits non-zero, that an unsafe `DEPLOY_WEBROOT`/name is refused, and that `shellcheck scripts/deploy.sh` is clean if shellcheck is available
- [x] 6.2 Make `main.js` read `build.json` (falling back to the load timestamp) and `assets.js` append `?v=<build>` to asset URLs, both fetched with `no-store`. Verify with a unit test on the URL builder and by checking in DevTools that asset requests carry `?v=`
- [x] 6.3 Ask the user to run the one-time setup on the server (`sudo mkdir -p /var/www/html/happy-game && sudo chown aminespinoza: /var/www/html/happy-game`), since it needs their sudo password. Verify that `ssh … test -w /var/www/html/happy-game` succeeds
- [ ] 6.4 Run the first `./scripts/deploy.sh happy-game`. Verify that it exits 0, that `http://192.168.68.77/happy-game/` plays on desktop and on a phone on the same Wi-Fi, that `/venster/` still works, and that `test/` and `package.json` are absent on the server
- [x] 6.5 Verify cache-busting and mirroring end to end: swap the bird image, redeploy, normal-reload on the phone, and see the new bird; delete a file locally, redeploy, and confirm it's gone on the server
- [x] 6.6 Add a "Deploy" section to `games/happy-game/README.md` and the root README (one-time setup, `./scripts/deploy.sh <game>`, `deploy.env` overrides, troubleshooting for SSH/key, unwritable folder and stale cache). Verify by following it from a fresh shell

## Workflow follow-up

- Archive the change with `/opsx:archive` after playtesting is done.
