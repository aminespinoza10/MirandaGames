import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cfg from '../src/config.js';
import { createPipes, updatePipes, gapBounds } from '../src/pipes.js';

const GROUND_Y = 400;
const PIPE_WIDTH = 52;

function run(steps, rng = Math.random) {
  const pipes = createPipes();
  const seen = [];
  for (let i = 0; i < steps; i++) {
    updatePipes(pipes, cfg, { pipeWidth: PIPE_WIDTH, groundY: GROUND_Y, rng });
    for (const p of pipes.list) if (!seen.includes(p)) seen.push(p);
  }
  return { pipes, seen };
}

test('pipes spawn offscreen right at a fixed spacing', () => {
  const { pipes } = run(600);
  assert.ok(pipes.list.length >= 2);
  for (let i = 1; i < pipes.list.length; i++) {
    assert.equal(pipes.list[i].x - pipes.list[i - 1].x, cfg.PIPE_SPACING);
  }
  assert.ok(pipes.list[pipes.list.length - 1].x > cfg.WIDTH);
});

test('every gap lies within the configured margins, even at rng extremes', () => {
  const { min, max } = gapBounds(cfg, GROUND_Y);
  for (const value of [0, 0.5, 0.999999]) {
    const { seen } = run(600, () => value);
    for (const p of seen) {
      assert.ok(p.gapY >= cfg.PIPE_TOP_MARGIN, `gap top ${p.gapY}`);
      assert.ok(p.gapY + cfg.PIPE_GAP <= GROUND_Y - cfg.PIPE_BOTTOM_MARGIN, `gap bottom ${p.gapY + cfg.PIPE_GAP}`);
      assert.ok(p.gapY >= min && p.gapY <= max);
    }
  }
});

test('pipes that scroll past the left edge are removed', () => {
  const { pipes, seen } = run(1000);
  const gone = seen.filter((p) => !pipes.list.includes(p));
  assert.ok(gone.length > 0);
  for (const p of gone) assert.ok(p.x + PIPE_WIDTH <= 0);
  for (const p of pipes.list) assert.ok(p.x + PIPE_WIDTH > 0);
});

test('pipes scroll at a constant speed', () => {
  const pipes = createPipes();
  updatePipes(pipes, cfg, { pipeWidth: PIPE_WIDTH, groundY: GROUND_Y, rng: () => 0.5 });
  const first = pipes.list[0];
  const x0 = first.x;
  updatePipes(pipes, cfg, { pipeWidth: PIPE_WIDTH, groundY: GROUND_Y, rng: () => 0.5 });
  assert.equal(first.x, x0 - cfg.SCROLL_SPEED);
});
