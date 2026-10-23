import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cfg from '../src/config.js';
import { createBird, flap, updatePhysics, updateIdle, frameIndex, isDiving, hitbox } from '../src/bird.js';

const SIZE = { width: 34, height: 24 };
const GROUND_Y = 400;

test('falling without input speeds up every step until max fall speed', () => {
  const bird = createBird(cfg, SIZE);
  bird.y = 50;
  let prev = bird.vy;
  for (let i = 0; i < 10; i++) {
    updatePhysics(bird, cfg, GROUND_Y);
    assert.ok(bird.vy > prev);
    prev = bird.vy;
  }
  for (let i = 0; i < 100; i++) updatePhysics(bird, cfg, 10_000);
  assert.equal(bird.vy, cfg.MAX_FALL_SPEED);
});

test('flap sets velocity to the flap velocity regardless of previous velocity', () => {
  const bird = createBird(cfg, SIZE);
  bird.vy = cfg.MAX_FALL_SPEED;
  flap(bird, cfg);
  assert.equal(bird.vy, cfg.FLAP_VELOCITY);
  bird.vy = -10;
  flap(bird, cfg);
  assert.equal(bird.vy, cfg.FLAP_VELOCITY);
});

test('bird tilts up after a flap and nose-dives at max fall speed, stopping its wings', () => {
  const bird = createBird(cfg, SIZE);
  bird.y = 0;
  flap(bird, cfg);
  updatePhysics(bird, cfg, 10_000);
  assert.equal(bird.rotation, cfg.BIRD_FLAP_ANGLE);
  for (let i = 0; i < 100; i++) updatePhysics(bird, cfg, 10_000);
  assert.equal(bird.rotation, 90);
  assert.ok(isDiving(bird, cfg));
  const frame = bird.frame;
  for (let i = 0; i < 20; i++) updatePhysics(bird, cfg, 10_000);
  assert.equal(bird.frame, frame);
});

test('bird stops on the ground', () => {
  const bird = createBird(cfg, SIZE);
  for (let i = 0; i < 200; i++) updatePhysics(bird, cfg, GROUND_Y);
  const box = hitbox(bird, cfg.BIRD_HITBOX_INSET);
  assert.equal(box.y + box.h, GROUND_Y);
  assert.equal(bird.vy, 0);
});

test('idle bird hovers near its start height and keeps flapping', () => {
  const bird = createBird(cfg, SIZE);
  for (let i = 0; i < 120; i++) {
    updateIdle(bird, cfg);
    assert.ok(Math.abs(bird.y - cfg.BIRD_START_Y) <= cfg.BIRD_BOB_AMPLITUDE);
  }
  assert.ok(bird.frame > 0);
});

test('frame index cycles through any number of frames, including one', () => {
  const bird = createBird(cfg, SIZE);
  bird.frame = 7;
  assert.equal(frameIndex(bird, 3), 1);
  assert.equal(frameIndex(bird, 4), 3);
  assert.equal(frameIndex(bird, 1), 0);
});

test('hitbox is the declared size inset on every side', () => {
  const bird = createBird(cfg, SIZE);
  const box = hitbox(bird, 3);
  assert.deepEqual(box, { x: bird.x - 17 + 3, y: bird.y - 12 + 3, w: 28, h: 18 });
});
