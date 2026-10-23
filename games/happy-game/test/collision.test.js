import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cfg from '../src/config.js';
import { findCollision, overlaps } from '../src/collision.js';

const dims = { pipeWidth: 52, groundY: 400 };
const pipe = { x: 100, gapY: 150, scored: false };
const box = (x, y, w = 28, h = 18) => ({ x, y, w, h });

test('overlapping a bottom pipe is a pipe hit', () => {
  assert.equal(findCollision(box(110, 260), [pipe], cfg, dims), 'pipe');
});

test('overlapping a top pipe is a pipe hit', () => {
  assert.equal(findCollision(box(110, 140), [pipe], cfg, dims), 'pipe');
});

test('passing through the gap is safe', () => {
  assert.equal(findCollision(box(110, 190), [pipe], cfg, dims), null);
});

test('touching the ground is a ground hit', () => {
  assert.equal(findCollision(box(20, 400 - 18), [pipe], cfg, dims), 'ground');
  assert.equal(findCollision(box(20, 400 - 19), [pipe], cfg, dims), null);
});

test('flying above the screen clear of pipes is not a collision', () => {
  assert.equal(findCollision(box(20, -200), [pipe], cfg, dims), null);
});

test('flying above the screen inside a pipe column still hits the pipe', () => {
  assert.equal(findCollision(box(110, -200), [pipe], cfg, dims), 'pipe');
});

test('edges that only touch do not overlap', () => {
  assert.equal(overlaps(box(0, 0, 10, 10), box(10, 0, 10, 10)), false);
});
