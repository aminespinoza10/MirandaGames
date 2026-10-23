// Bird state and physics. Pure: no DOM, one call = one fixed step.
// x/y are the bird's center; width/height come from the manifest's declared size.

export function createBird(cfg, size) {
  return {
    x: cfg.BIRD_X,
    y: cfg.BIRD_START_Y,
    vy: 0,
    rotation: 0,
    width: size.width,
    height: size.height,
    frame: 0,
    frameTimer: 0,
    bobTime: 0,
  };
}

export function flap(bird, cfg) {
  bird.vy = cfg.FLAP_VELOCITY;
}

export function rotationFor(vy, cfg) {
  if (vy < cfg.BIRD_TILT_START_SPEED) return cfg.BIRD_FLAP_ANGLE;
  const t = (vy - cfg.BIRD_TILT_START_SPEED) / (cfg.MAX_FALL_SPEED - cfg.BIRD_TILT_START_SPEED);
  return Math.min(cfg.BIRD_DIVE_ANGLE, cfg.BIRD_FLAP_ANGLE + t * (cfg.BIRD_DIVE_ANGLE - cfg.BIRD_FLAP_ANGLE));
}

export function isDiving(bird, cfg) {
  return bird.rotation >= cfg.BIRD_DIVE_ANGLE;
}

function animateWings(bird, cfg) {
  if (isDiving(bird, cfg)) return;
  bird.frameTimer++;
  if (bird.frameTimer >= cfg.BIRD_FRAME_STEPS) {
    bird.frameTimer = 0;
    bird.frame++;
  }
}

// Ready screen: hover around the start height, wings flapping.
export function updateIdle(bird, cfg) {
  bird.bobTime++;
  bird.y = cfg.BIRD_START_Y + Math.sin(bird.bobTime * cfg.BIRD_BOB_SPEED) * cfg.BIRD_BOB_AMPLITUDE;
  bird.vy = 0;
  bird.rotation = 0;
  animateWings(bird, cfg);
}

// Playing (and falling after a crash): gravity up to terminal speed, stop on the ground.
export function updatePhysics(bird, cfg, groundY) {
  bird.vy = Math.min(bird.vy + cfg.GRAVITY, cfg.MAX_FALL_SPEED);
  bird.y += bird.vy;
  bird.rotation = rotationFor(bird.vy, cfg);
  const restY = groundY - bird.height / 2 + cfg.BIRD_HITBOX_INSET;
  if (bird.y >= restY) {
    bird.y = restY;
    bird.vy = 0;
  }
  animateWings(bird, cfg);
}

export function isOnGround(bird, cfg, groundY) {
  return bird.y >= groundY - bird.height / 2 + cfg.BIRD_HITBOX_INSET;
}

export function hitbox(bird, inset) {
  return {
    x: bird.x - bird.width / 2 + inset,
    y: bird.y - bird.height / 2 + inset,
    w: bird.width - inset * 2,
    h: bird.height - inset * 2,
  };
}

export function frameIndex(bird, frameCount) {
  return frameCount > 0 ? bird.frame % frameCount : 0;
}
