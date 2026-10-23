import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cfg from '../src/config.js';
import { createGame, flap, step, drainEvents, canRestart, READY, PLAYING, GAME_OVER } from '../src/game.js';
import { createBestStore } from '../src/score.js';

const dims = { bird: { width: 34, height: 24 }, pipeWidth: 52, groundY: 400 };

function newGame(best = createBestStore(undefined, 'k')) {
  return createGame({ cfg, dims, bestStore: best, rng: () => 0.5 });
}

function steps(game, n) {
  for (let i = 0; i < n; i++) step(game);
}

// Keeps the bird centered in each upcoming gap, flapping when it sinks below it.
function autopilot(game) {
  const next = game.pipes.list.find((p) => p.x + dims.pipeWidth > game.bird.x - 20);
  const target = next ? next.gapY + cfg.PIPE_GAP / 2 + 10 : cfg.BIRD_START_Y;
  if (game.bird.y > target && game.bird.vy >= 0) flap(game);
}

test('starts in Ready with the bird idle, no pipes and the ground scrolling', () => {
  const game = newGame();
  assert.equal(game.phase, READY);
  steps(game, 60);
  assert.equal(game.phase, READY);
  assert.equal(game.pipes.list.length, 0);
  assert.ok(Math.abs(game.bird.y - cfg.BIRD_START_Y) <= cfg.BIRD_BOB_AMPLITUDE);
  assert.ok(game.groundOffset > 0);
});

test('flapping in Ready starts Playing with an upward impulse', () => {
  const game = newGame();
  flap(game);
  assert.equal(game.phase, PLAYING);
  assert.equal(game.bird.vy, cfg.FLAP_VELOCITY);
  assert.deepEqual(drainEvents(game), ['flap']);
});

test('falling to the ground ends the round with a hit, and the bird rests', () => {
  const game = newGame();
  flap(game);
  drainEvents(game);
  steps(game, 300);
  assert.equal(game.phase, GAME_OVER);
  assert.equal(game.hitPipe, false);
  assert.deepEqual(drainEvents(game), ['hit']);
});

test('hitting a pipe freezes scrolling, the bird falls to the ground and dies', () => {
  const game = newGame();
  flap(game);
  // Fly high every step so the bird hits the top pipe of the first pair.
  while (game.phase === PLAYING) {
    if (game.bird.y > 60) flap(game);
    step(game);
  }
  assert.equal(game.hitPipe, true);
  const events = drainEvents(game);
  assert.equal(events.at(-1), 'hit');
  const ground = game.groundOffset;
  const pipeX = game.pipes.list[0].x;
  const y = game.bird.y;
  flap(game); // ignored while falling
  steps(game, 300);
  assert.equal(game.groundOffset, ground);
  assert.equal(game.pipes.list[0].x, pipeX);
  assert.ok(game.bird.y > y);
  assert.deepEqual(drainEvents(game), ['die']);
});

test('passing pipes scores one point each and plays the point sound', () => {
  const game = newGame();
  flap(game);
  let points = 0;
  for (let i = 0; i < 1500 && game.phase === PLAYING; i++) {
    autopilot(game);
    step(game);
    points += drainEvents(game).filter((e) => e === 'point').length;
  }
  assert.ok(game.score >= 3, `score ${game.score}`);
  assert.equal(points, game.score);
});

test('restart is debounced for 0.5 s, then returns to a fresh Ready', () => {
  const fresh = newGame();
  flap(fresh);
  for (let i = 0; i < 1000 && fresh.phase === PLAYING; i++) step(fresh);
  assert.equal(fresh.phase, GAME_OVER);
  steps(fresh, 29); // ~0.48 s
  assert.equal(canRestart(fresh), false);
  flap(fresh);
  assert.equal(fresh.phase, GAME_OVER);
  steps(fresh, 1);
  assert.equal(canRestart(fresh), true);
  flap(fresh);
  assert.equal(fresh.phase, READY);
  assert.equal(fresh.score, 0);
  assert.equal(fresh.pipes.list.length, 0);
  assert.equal(fresh.bird.y, cfg.BIRD_START_Y);
});

test('a better score is recorded as the new best', () => {
  const best = createBestStore(undefined, 'k');
  best.submit(1);
  const game = newGame(best);
  flap(game);
  for (let i = 0; i < 1500 && game.phase === PLAYING; i++) {
    autopilot(game);
    if (game.score >= 2) {
      game.bird.vy = cfg.MAX_FALL_SPEED;
    }
    step(game);
  }
  assert.equal(game.phase, GAME_OVER);
  assert.ok(game.score >= 2);
  assert.equal(game.newBest, true);
  assert.equal(game.best, game.score);
});
