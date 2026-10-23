// Axis-aligned collision checks. Rectangles are { x, y, w, h }.

// Top pipes reach infinitely upward: flying over the screen edge doesn't skip a pipe.
const SKY = 1e6;

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function pipeRects(pipe, cfg, pipeWidth, groundY) {
  const bottomY = pipe.gapY + cfg.PIPE_GAP;
  return [
    { x: pipe.x, y: -SKY, w: pipeWidth, h: SKY + pipe.gapY },
    { x: pipe.x, y: bottomY, w: pipeWidth, h: groundY - bottomY },
  ];
}

export function hitsGround(box, groundY) {
  return box.y + box.h >= groundY;
}

// Returns 'pipe', 'ground' or null.
export function findCollision(box, pipes, cfg, { pipeWidth, groundY }) {
  for (const pipe of pipes) {
    for (const rect of pipeRects(pipe, cfg, pipeWidth, groundY)) {
      if (overlaps(box, rect)) return 'pipe';
    }
  }
  return hitsGround(box, groundY) ? 'ground' : null;
}
