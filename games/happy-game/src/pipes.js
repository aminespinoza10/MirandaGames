// Pipe pairs. Each pair is { x, gapY, scored }: x is the left edge, gapY the top of the gap.
// Pure: randomness is injected so tests can pin gap positions.

export function createPipes() {
  return { list: [] };
}

export function gapBounds(cfg, groundY) {
  return {
    min: cfg.PIPE_TOP_MARGIN,
    max: groundY - cfg.PIPE_BOTTOM_MARGIN - cfg.PIPE_GAP,
  };
}

function spawn(pipes, x, cfg, groundY, rng) {
  const { min, max } = gapBounds(cfg, groundY);
  const gapY = Math.round(min + rng() * Math.max(0, max - min));
  pipes.list.push({ x, gapY, scored: false });
}

// One fixed step: scroll, drop pairs that left the screen, keep the next pair queued offscreen right.
export function updatePipes(pipes, cfg, { pipeWidth, groundY, rng }) {
  for (const pipe of pipes.list) pipe.x -= cfg.SCROLL_SPEED;
  pipes.list = pipes.list.filter((pipe) => pipe.x + pipeWidth > 0);

  const last = pipes.list[pipes.list.length - 1];
  if (!last) {
    spawn(pipes, cfg.FIRST_PIPE_X, cfg, groundY, rng);
  } else if (last.x <= cfg.WIDTH) {
    spawn(pipes, last.x + cfg.PIPE_SPACING, cfg, groundY, rng);
  }
}
