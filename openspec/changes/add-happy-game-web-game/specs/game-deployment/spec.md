# Spec Delta

## Purpose

Lets a game in this repo be published to the home nginx server with one command, safely and repeatably, so players on the local network always get the latest version.

## ADDED Requirements

### Requirement: One-command deploy
Running the deploy command with a game name SHALL publish that game's files to the server so it is reachable at `http://<host>/<game>/`.

#### Scenario: Deploy happy-game
- **WHEN** the user runs `./scripts/deploy.sh happy-game` from the repo root with the server reachable
- **THEN** the game is served at `http://192.168.68.77/happy-game/` and the command exits with status 0

#### Scenario: Unknown game
- **WHEN** the user runs the deploy command with a name that has no folder under `games/`
- **THEN** the command lists the available games, exits non-zero and contacts no server

### Requirement: Tests gate the deploy
The deploy command SHALL run the game's unit tests first and SHALL NOT upload anything if they fail.

#### Scenario: Failing test
- **WHEN** any unit test of the game fails
- **THEN** the command reports the failure, exits non-zero and leaves the server unchanged

### Requirement: Only runtime files are published
The deploy SHALL upload only the files the browser needs. Tests, package metadata, READMEs and local configuration SHALL NOT be uploaded.

#### Scenario: Inspect deployed folder
- **WHEN** a deploy completes
- **THEN** the server folder contains `index.html`, styles, `src/`, `assets/` and the build stamp, and does not contain `test/`, `package.json` or `README.md`

### Requirement: Server mirrors the local game
After a deploy, files removed from the local game SHALL also be removed from that game's server folder, and nothing outside that folder SHALL be modified.

#### Scenario: Removed asset
- **WHEN** the user deletes an asset locally and deploys again
- **THEN** the asset is gone from the server's game folder

#### Scenario: Other sites untouched
- **WHEN** any game is deployed
- **THEN** other content under the web root, such as `/venster/`, is unchanged

#### Scenario: Unsafe target refused
- **WHEN** the configured remote path is not a game-named folder directly inside the configured web root
- **THEN** the command refuses to run and exits non-zero

### Requirement: No privileged operations or secrets
The deploy command SHALL NOT use sudo or prompt for a password, and no password or private key SHALL be stored in the repo. Host, user, key and web root SHALL have defaults that can be overridden by environment variables or by an untracked local config file.

#### Scenario: Folder not yet writable
- **WHEN** the game's server folder does not exist or the deploy user can't write to it
- **THEN** the command stops before uploading and prints the exact one-time setup command for the user to run on the server

#### Scenario: Override host
- **WHEN** the user sets `DEPLOY_HOST` to another address and deploys
- **THEN** the game is published to that host instead of the default

### Requirement: Post-deploy verification
After uploading, the deploy command SHALL request the game's URL and its asset manifest, and SHALL report success only if both respond successfully with the expected content types.

#### Scenario: Successful check
- **WHEN** the upload finishes and nginx serves the game
- **THEN** the command prints the game URL and exits 0

#### Scenario: Server not serving
- **WHEN** the upload finishes but the URL returns an error or the manifest is not JSON
- **THEN** the command reports what failed and exits non-zero

### Requirement: Fresh assets after deploy
After a deploy, a player who does a normal reload SHALL get the newly deployed assets and manifest, with no hard refresh or cache clearing needed.

#### Scenario: Swapped bird sprite
- **WHEN** the user replaces the bird image, deploys, and a player who had the old version open reloads the page normally
- **THEN** the new bird image is shown
