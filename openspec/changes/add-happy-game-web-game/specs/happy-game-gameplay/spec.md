# Spec Delta

## Purpose

Defines the rules and feel of the Flappy Bird clone: how the player controls the bird, how obstacles behave, how score is earned, and how a round starts and ends.

## ADDED Requirements

### Requirement: Game state flow
The game SHALL have three states, Ready, Playing and Game Over, and SHALL start in Ready when the page loads.

#### Scenario: Start from Ready
- **WHEN** the game is in Ready and the player flaps
- **THEN** the game enters Playing and the bird receives an upward flap impulse

#### Scenario: Bird idles while Ready
- **WHEN** the game is in Ready
- **THEN** the bird hovers in place with a gentle bob, no pipes are present, and the ground scrolls

#### Scenario: Restart after Game Over
- **WHEN** the game is in Game Over, the game-over screen has been visible for at least 0.5 seconds, and the player flaps
- **THEN** the game returns to Ready with the score reset to 0, the bird at its start position and all pipes removed

#### Scenario: Restart is debounced
- **WHEN** the player flaps within 0.5 seconds of entering Game Over
- **THEN** the game stays in Game Over

### Requirement: Flap input
The player SHALL be able to flap with a mouse click or touch on the game area, or with the Space or Up Arrow key.

#### Scenario: Keyboard flap
- **WHEN** the game is in Playing and the player presses Space
- **THEN** the bird's vertical velocity is set to the configured flap velocity (upward), whatever its previous velocity was

#### Scenario: Touch flap does not scroll the page
- **WHEN** the player taps the game area on a mobile browser
- **THEN** the bird flaps and the page does not scroll or zoom

### Requirement: Bird physics
While Playing, the bird SHALL accelerate downward under constant gravity up to a maximum fall speed, and SHALL stay at a fixed horizontal position.

#### Scenario: Falling without input
- **WHEN** the player does not flap during Playing
- **THEN** the bird's downward velocity increases every step until it reaches the configured maximum fall speed

#### Scenario: Frame-rate independence
- **WHEN** the game runs on displays with different refresh rates (for example 60 Hz and 144 Hz)
- **THEN** the bird follows the same trajectory for the same inputs

### Requirement: Bird rotation and animation
The bird SHALL tilt up after a flap and rotate toward nose-down as it falls, and SHALL cycle its wing animation frames while Ready or Playing.

#### Scenario: Nose dive
- **WHEN** the bird has been falling at maximum fall speed
- **THEN** it is drawn rotated nose-down (90°) and its wing animation stops

### Requirement: Pipe generation and scrolling
While Playing, pipe pairs SHALL spawn off the right edge at a fixed horizontal spacing and scroll left at a constant speed. Each pair has a vertical gap of fixed height whose position is random within configured bounds.

#### Scenario: Pipes spawn at regular spacing
- **WHEN** the game has been in Playing long enough for several pipes to appear
- **THEN** consecutive pipe pairs are separated by the configured horizontal spacing and every gap has the configured height

#### Scenario: Gap stays within bounds
- **WHEN** a pipe pair spawns
- **THEN** its gap lies entirely between the configured top margin and the top of the ground minus the bottom margin

#### Scenario: Offscreen pipes are removed
- **WHEN** a pipe pair scrolls completely past the left edge
- **THEN** it is no longer simulated or drawn

### Requirement: Collision ends the round
The round SHALL end when the bird's hitbox overlaps a pipe or touches the ground. Flying above the top of the screen SHALL NOT end the round, but the bird SHALL still collide with a pipe that extends to the top of the screen.

#### Scenario: Hit a pipe
- **WHEN** the bird's hitbox overlaps any part of a pipe
- **THEN** the game plays the hit sound, enters Game Over, and stops pipe and ground scrolling

#### Scenario: Hit the ground
- **WHEN** the bottom of the bird's hitbox reaches the top of the ground
- **THEN** the game enters Game Over and the bird rests on the ground

#### Scenario: Fall after pipe hit
- **WHEN** the bird hits a pipe in mid-air
- **THEN** the bird keeps falling until it rests on the ground, and flap input no longer affects it

#### Scenario: Above the screen
- **WHEN** the bird flies above the top edge while clear of any pipe column
- **THEN** the round continues

### Requirement: Scoring
The score SHALL go up by exactly 1 each time the bird's horizontal center passes the horizontal center of a pipe pair, and SHALL be shown on screen during Playing.

#### Scenario: Pass a pipe
- **WHEN** the bird's center crosses a pipe pair's center during Playing
- **THEN** the score goes up by 1 and the point sound plays

#### Scenario: Each pipe counts once
- **WHEN** the bird passes the same pipe pair
- **THEN** that pair contributes at most 1 point

### Requirement: Best score persistence
The game SHALL keep the player's best score on the device across page reloads, and SHALL show both the round score and the best score on the Game Over screen.

#### Scenario: New best
- **WHEN** a round ends with a score higher than the stored best
- **THEN** the best score is updated, persisted, and marked as new on the Game Over screen

#### Scenario: Storage unavailable
- **WHEN** browser storage cannot be read or written (for example, in a private window)
- **THEN** the game still plays normally and tracks the best score for the current session only

### Requirement: Responsive display
The game SHALL render at a fixed logical resolution with a portrait aspect ratio, scaled to the largest size that fits the browser window without distortion. Pixel art SHALL stay crisp.

#### Scenario: Window resize
- **WHEN** the browser window is resized or a phone is rotated
- **THEN** the game area rescales to fit, keeps its aspect ratio, and gameplay is unaffected
