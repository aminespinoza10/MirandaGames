import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateManifest, normalizeImage, assetUrl, loadAssets, IMAGE_KEYS, OPTIONAL_IMAGE_KEYS, SOUND_KEYS } from '../src/assets.js';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const manifest = JSON.parse(readFileSync(path.join(ASSETS, 'manifest.json'), 'utf8'));

const DECLARED_IMAGE_KEYS = [...IMAGE_KEYS, ...OPTIONAL_IMAGE_KEYS.filter((key) => manifest.images[key])];

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('the shipped manifest declares every required key', () => {
  assert.deepEqual(validateManifest(manifest), []);
});

test('every file the manifest references exists', () => {
  const files = [
    ...DECLARED_IMAGE_KEYS.flatMap((key) => normalizeImage(manifest.images[key]).frames),
    ...SOUND_KEYS.map((key) => manifest.sounds[key]),
  ];
  for (const file of files) assert.ok(existsSync(path.join(ASSETS, file)), `${file} is missing`);
});

// Art may be any resolution (it's scaled to the declared size), so only check PNGs are real, non-empty images.
test('referenced PNG images are valid and not empty', () => {
  for (const key of DECLARED_IMAGE_KEYS) {
    for (const file of normalizeImage(manifest.images[key]).frames.filter((f) => f.endsWith('.png'))) {
      const buf = readFileSync(path.join(ASSETS, file));
      assert.ok(buf.subarray(0, 8).equals(PNG_SIGNATURE), `${file} is not a PNG`);
      assert.ok(buf.readUInt32BE(16) > 0 && buf.readUInt32BE(20) > 0, `${file} has no pixels`);
    }
  }
});

test('validation reports missing keys, sizes and digit count', () => {
  const broken = structuredClone(manifest);
  delete broken.images.ground;
  broken.images.bird.width = 0;
  broken.images.digits.frames = broken.images.digits.frames.slice(0, 9);
  delete broken.sounds.die;
  const problems = validateManifest(broken);
  assert.ok(problems.some((p) => p.includes('images.ground')));
  assert.ok(problems.some((p) => p.includes('images.bird') && p.includes('width')));
  assert.ok(problems.some((p) => p.includes('10 frames')));
  assert.ok(problems.some((p) => p.includes('sounds.die')));
  assert.deepEqual(validateManifest(null), ['manifest is not a JSON object']);
});

test('optional images may be left out, but are checked when present', () => {
  const without = structuredClone(manifest);
  delete without.images.birdDead;
  assert.deepEqual(validateManifest(without), []);
  const broken = structuredClone(manifest);
  broken.images.birdDead = { src: 'images/x.png', width: 0, height: 40 };
  assert.ok(validateManifest(broken).some((p) => p.includes('images.birdDead') && p.includes('width')));
});

test('a single "src" and a "frames" list normalize the same way', () => {
  assert.deepEqual(normalizeImage({ src: 'a.png', width: 1, height: 2 }), { frames: ['a.png'], width: 1, height: 2 });
  assert.deepEqual(normalizeImage({ frames: ['a.png', 'b.png'], width: 1, height: 2 }).frames, ['a.png', 'b.png']);
});

test('asset URLs carry the build id', () => {
  assert.equal(assetUrl('assets/', 'images/happy-0.png', 'abc123-20261022T1900Z'), 'assets/images/happy-0.png?v=abc123-20261022T1900Z');
  assert.equal(assetUrl('assets/', 'x.png', 'a b'), 'assets/x.png?v=a%20b');
});

test('failed assets fall back and log a warning naming the key and path', async () => {
  const warnings = [];
  const fakeCanvas = (width, height) => ({
    width,
    height,
    fallback: true,
    getContext: () => new Proxy({}, { get: (_, prop) => (prop in {} ? undefined : () => {}), set: () => true }),
  });
  // Fixed fixture so customizing the shipped manifest never breaks this test.
  const fixture = structuredClone(manifest);
  fixture.images.bird = { frames: ['t/bird-a.png', 't/bird-b.png', 't/bird-c.png'], width: 34, height: 24 };
  fixture.images.background = { src: 't/broken-bg.png', width: 288, height: 512 };
  fixture.sounds.flap = 't/broken-flap.wav';
  delete fixture.images.birdDead;
  const urls = [];
  const assets = await loadAssets(fixture, {
    build: 'b1',
    log: (m) => warnings.push(m),
    createCanvas: fakeCanvas,
    loadImage: async (url) => {
      urls.push(url);
      return url.includes('broken-') ? null : { ok: true, url };
    },
    loadSound: async (url) => (url.includes('broken-') ? null : url),
    createSound: (src) => ({ src, play() {} }),
  });
  assert.equal(assets.images.background.frames[0].fallback, true);
  assert.equal(assets.images.background.frames[0].width, 288);
  assert.equal(assets.images.bird.frames.length, 3);
  assert.equal(assets.images.bird.frames[0].ok, true);
  assert.equal(assets.images.birdDead, undefined);
  assert.equal(assets.sounds.flap.src, null);
  assert.equal(warnings.length, 2);
  assert.ok(warnings.some((w) => w.includes('background') && w.includes('t/broken-bg.png')));
  assert.ok(warnings.some((w) => w.includes('flap') && w.includes('t/broken-flap.wav')));
  assert.ok(urls.every((u) => u.endsWith('?v=b1')));
});
