# Spec Delta

## Purpose

Lets the game's look and sound be customized by replacing files and editing one manifest, without changing game code, and keeps the game playable when an asset is missing or broken.

## ADDED Requirements

### Requirement: Single asset manifest
Every image and sound the game uses SHALL be declared in one human-editable manifest file. Each entry maps a fixed asset key to a file path relative to the game's assets folder.

#### Scenario: Swap the bird sprite
- **WHEN** a user replaces the file path for the bird frames in the manifest with their own image files and reloads
- **THEN** the game draws the new bird images and no code file was edited

#### Scenario: Required asset keys
- **WHEN** the manifest is inspected
- **THEN** it declares keys for bird animation frames, background, ground, top pipe, bottom pipe, score digits 0–9, the Ready screen, the Game Over screen, and the flap, point, hit and die sounds

### Requirement: Logical sizes decouple art from gameplay
Each visual asset's on-screen size SHALL come from the manifest, not from the image file's pixel dimensions, so replacement art at any resolution is scaled to the declared size. Gameplay hitboxes SHALL be based on the declared size.

#### Scenario: High-resolution replacement
- **WHEN** a user swaps the bird for an image four times larger than the original without changing its declared size
- **THEN** the bird appears at the same on-screen size and collisions behave exactly as before

### Requirement: Variable bird animation frames
The bird SHALL accept one or more animation frames, cycling through however many the manifest lists.

#### Scenario: Single-frame bird
- **WHEN** the manifest lists only one bird frame
- **THEN** the game shows that static image and plays normally

### Requirement: Loading before play
The game SHALL load all declared assets before accepting input and SHALL show a loading indication meanwhile.

#### Scenario: Slow network
- **WHEN** assets take several seconds to load
- **THEN** a loading indication is shown and flapping has no effect until loading finishes

### Requirement: Missing or broken assets degrade gracefully
If an asset fails to load, the game SHALL still be playable. Missing images are drawn as plain colored shapes at the declared size, missing sounds are silent, and a warning naming the asset key and path is logged to the browser console.

#### Scenario: Typo in an image path
- **WHEN** the manifest points the background at a file that does not exist
- **THEN** the game loads, draws a solid-color background, plays normally, and logs a warning naming the background key and the bad path

#### Scenario: Server returns a page instead of the asset
- **WHEN** a missing image or sound path is answered with an HTML page and a success status (as the server's fallback routing does) instead of "not found"
- **THEN** the asset is treated as failed: the fallback is used and a warning names the key and path

#### Scenario: Missing sound
- **WHEN** the flap sound file is missing
- **THEN** flapping works without sound and a warning is logged

### Requirement: Audio respects browser autoplay rules
Sounds SHALL only start after the player's first interaction, and failure to play a sound SHALL never interrupt gameplay.

#### Scenario: First flap unlocks audio
- **WHEN** the page loads and the player has not interacted yet
- **THEN** no sound is attempted; from the first flap onward, sounds play
