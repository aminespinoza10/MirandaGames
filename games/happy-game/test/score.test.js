import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectPoints, createBestStore } from '../src/score.js';

const KEY = 'test.best';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
}

test('a pipe scores once when the bird center passes its center', () => {
  const pipes = [{ x: 100, gapY: 100, scored: false }];
  assert.equal(collectPoints(pipes, 125, 52), 0);
  assert.equal(collectPoints(pipes, 126, 52), 1);
  assert.equal(collectPoints(pipes, 130, 52), 0);
  assert.equal(collectPoints(pipes, 200, 52), 0);
});

test('several pipes each count once', () => {
  const pipes = [{ x: 0, gapY: 0, scored: false }, { x: 10, gapY: 0, scored: false }];
  assert.equal(collectPoints(pipes, 100, 52), 2);
  assert.equal(collectPoints(pipes, 100, 52), 0);
});

test('a higher score becomes the new best and is persisted', () => {
  const storage = memoryStorage({ [KEY]: '5' });
  const best = createBestStore(storage, KEY);
  assert.equal(best.get(), 5);
  assert.equal(best.submit(3), false);
  assert.equal(best.submit(5), false);
  assert.equal(best.submit(8), true);
  assert.equal(best.get(), 8);
  assert.equal(storage.data[KEY], '8');
  assert.equal(createBestStore(storage, KEY).get(), 8);
});

test('storage that throws falls back to an in-memory best', () => {
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const best = createBestStore(throwing, KEY);
  assert.equal(best.get(), 0);
  assert.equal(best.submit(4), true);
  assert.equal(best.get(), 4);
  assert.equal(best.submit(2), false);
});

test('missing storage and garbage values are handled', () => {
  assert.equal(createBestStore(undefined, KEY).get(), 0);
  assert.equal(createBestStore(memoryStorage({ [KEY]: 'banana' }), KEY).get(), 0);
});
