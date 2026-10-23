import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStepper } from '../src/loop.js';
import * as cfg from '../src/config.js';

function stepsOverOneSecond(hz) {
  const stepper = createStepper(cfg.STEP_MS, cfg.MAX_FRAME_MS);
  let steps = 0;
  for (let i = 0; i < hz; i++) steps += stepper.advance(1000 / hz);
  return steps;
}

test('60 Hz and 144 Hz frames produce the same number of steps per second', () => {
  assert.equal(stepsOverOneSecond(60), 60);
  assert.equal(stepsOverOneSecond(144), 60);
});

test('rounded frame times (16.7 ms / 6.9 ms) stay within one step of each other', () => {
  const run = (dt, frames) => {
    const s = createStepper(cfg.STEP_MS, cfg.MAX_FRAME_MS);
    let n = 0;
    for (let i = 0; i < frames; i++) n += s.advance(dt);
    return n;
  };
  const a = run(16.7, 60);
  const b = run(6.9, 145);
  assert.ok(Math.abs(a - b) <= 1, `${a} vs ${b}`);
});

test('a long pause is capped so the game does not fast-forward', () => {
  const stepper = createStepper(cfg.STEP_MS, cfg.MAX_FRAME_MS);
  assert.equal(stepper.advance(10_000), 15);
});

test('negative frame times are ignored', () => {
  const stepper = createStepper(cfg.STEP_MS, cfg.MAX_FRAME_MS);
  assert.equal(stepper.advance(-50), 0);
});
