// Gameplay tuning. All distances are logical pixels; all rates are per fixed step (60 steps/s).
// Art sizes (bird, pipes, ground) come from assets/manifest.json, not from here.

export const WIDTH = 288;
export const HEIGHT = 512;

export const STEP_MS = 1000 / 60;
export const MAX_FRAME_MS = 250;

// Bird
export const BIRD_X = 70;
export const BIRD_START_Y = 240;
export const GRAVITY = 0.25;
export const FLAP_VELOCITY = -4.6;
export const MAX_FALL_SPEED = 8;
export const BIRD_HITBOX_INSET = 3;
export const BIRD_FLAP_ANGLE = -25;
export const BIRD_DIVE_ANGLE = 90;
// The bird keeps its nose up until it falls faster than this, then tilts toward a dive.
export const BIRD_TILT_START_SPEED = 2;
export const BIRD_FRAME_STEPS = 5;
export const BIRD_BOB_AMPLITUDE = 4;
export const BIRD_BOB_SPEED = 0.12;

// World
export const SCROLL_SPEED = 2;
export const PIPE_GAP = 100;
export const PIPE_SPACING = 156;
export const PIPE_TOP_MARGIN = 50;
export const PIPE_BOTTOM_MARGIN = 50;
export const FIRST_PIPE_X = WIDTH + 60;

// Flow
export const RESTART_DELAY_MS = 500;
export const BEST_SCORE_KEY = 'mirandagames.happy-game.best';
