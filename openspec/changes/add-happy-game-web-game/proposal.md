# Proposal

## Why

The repo is meant to hold games we build together, and it doesn't have any yet. A Flappy Bird clone is a good first game: the rules are well known and it's small enough to finish. Once it plays like the original, we want to swap in our own art and sounds without touching game code.

## What Changes

- Add a browser-playable Flappy Bird clone under `games/happy-game/` that matches the original's gameplay. That covers tap/click/space to flap, gravity, scrolling pipe pairs with a fixed gap, collision with pipes and ground, one point per pipe passed, and the Get Ready → Playing → Game Over flow with a best score.
- Ship original placeholder art and sounds styled like the original. The real Flappy Bird assets are copyrighted, so we won't copy them. The user has approved placeholder sounds.
- Define every swappable asset (bird frames, pipes, background, ground, digits/UI, sounds) in a single asset manifest file. Customizing the game then means editing that file and dropping in new files.
- The game keeps running when an asset is missing or fails to load. It draws a simple fallback shape, or plays nothing for a sound.
- Web only, for desktop and mobile browsers. No native or app-store builds.
- Deploy with one command to the home nginx server (192.168.68.77), where the game is served at `http://192.168.68.77/happy-game/`. The deploy script is generic per game, so future games in this repo can reuse it.

## Capabilities

### New Capabilities
- `happy-game-gameplay`: The rules and feel of the game. Covers input, bird physics, pipe generation and scrolling, collision, scoring, best-score persistence and game state flow.
- `game-assets`: How the game's visuals and sounds are declared, loaded, replaced and degraded when they're missing, so the game can be customized without code changes.
- `game-deployment`: How a game in this repo gets published to the home nginx server. Covers the one-command deploy, what gets uploaded, safety limits, post-deploy verification, and making sure players see fresh assets after each deploy.

### Modified Capabilities
<!-- None: no specs exist yet. -->

## Impact

- New folder `games/happy-game/` with static HTML/JS/CSS, assets and an asset manifest.
- No runtime dependencies and no build step. It runs from any static file server.
- Unit tests for the game logic use Node's built-in test runner, so there are no new dependencies there either.
- The README gets instructions for running the game, swapping assets and deploying.
- New `scripts/deploy.sh` (bash, uses `ssh` + `rsync`), `deploy.env.example`, and a `.gitignore` entry for the local `deploy.env`.
- Server: no nginx configuration change. The existing default site already serves `/var/www/html`. A one-time setup, run by the user with sudo, creates `/var/www/html/happy-game` owned by the deploy user. The existing `/venster` app is left untouched.
