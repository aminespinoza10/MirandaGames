// Generates the original placeholder art (PNG) and sounds (WAV) in assets/.
// Run: npm run placeholders   (overwrites the files in assets/images and assets/sounds)
// No dependencies: a minimal PNG encoder on node:zlib and a tiny WAV synthesizer.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const IMAGES = path.join(ROOT, 'images');
const SOUNDS = path.join(ROOT, 'sounds');
mkdirSync(IMAGES, { recursive: true });
mkdirSync(SOUNDS, { recursive: true });

// ---------- PNG ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(img) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    raw[y * (img.w * 4 + 1)] = 0;
    img.data.copy(raw, y * (img.w * 4 + 1) + 1, y * img.w * 4, (y + 1) * img.w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- tiny raster ----------

const hex = (h, a = 255) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];

function image(w, h) {
  return { w, h, data: Buffer.alloc(w * h * 4) };
}

function set(img, x, y, c) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const i = (y * img.w + x) * 4;
  img.data[i] = c[0];
  img.data[i + 1] = c[1];
  img.data[i + 2] = c[2];
  img.data[i + 3] = c[3];
}

function alpha(img, x, y) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return 0;
  return img.data[(y * img.w + x) * 4 + 3];
}

function rect(img, x, y, w, h, c) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(img, i, j, c);
}

function ellipse(img, cx, cy, rx, ry, c) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) set(img, x, y, c);
    }
  }
}

// Paints `color` on every transparent pixel touching an opaque one, `passes` times.
function outline(img, color, passes = 1) {
  for (let p = 0; p < passes; p++) {
    const marks = [];
    for (let y = 0; y < img.h; y++) {
      for (let x = 0; x < img.w; x++) {
        if (alpha(img, x, y)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          if (alpha(img, x + dx, y + dy)) {
            marks.push([x, y]);
            break;
          }
        }
      }
    }
    for (const [x, y] of marks) set(img, x, y, color);
  }
}

function flipVertical(img) {
  const out = image(img.w, img.h);
  for (let y = 0; y < img.h; y++) img.data.copy(out.data, (img.h - 1 - y) * img.w * 4, y * img.w * 4, (y + 1) * img.w * 4);
  return out;
}

// ---------- 5x7 pixel font ----------

const FONT = {
  0: [' ### ', '#   #', '#  ##', '# # #', '##  #', '#   #', ' ### '],
  1: ['  #  ', ' ##  ', '  #  ', '  #  ', '  #  ', '  #  ', ' ### '],
  2: [' ### ', '#   #', '    #', '   # ', '  #  ', ' #   ', '#####'],
  3: ['#####', '   # ', '  #  ', '   # ', '    #', '#   #', ' ### '],
  4: ['   # ', '  ## ', ' # # ', '#  # ', '#####', '   # ', '   # '],
  5: ['#####', '#    ', '#### ', '    #', '    #', '#   #', ' ### '],
  6: ['  ## ', ' #   ', '#    ', '#### ', '#   #', '#   #', ' ### '],
  7: ['#####', '    #', '   # ', '  #  ', ' #   ', ' #   ', ' #   '],
  8: [' ### ', '#   #', '#   #', ' ### ', '#   #', '#   #', ' ### '],
  9: [' ### ', '#   #', '#   #', ' ####', '    #', '   # ', ' ##  '],
  A: [' ### ', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  D: ['#### ', '#   #', '#   #', '#   #', '#   #', '#   #', '#### '],
  E: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'],
  G: [' ### ', '#   #', '#    ', '# ###', '#   #', '#   #', ' ####'],
  J: ['  ###', '   # ', '   # ', '   # ', '   # ', '#  # ', ' ##  '],
  M: ['#   #', '## ##', '# # #', '# # #', '#   #', '#   #', '#   #'],
  O: [' ### ', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  P: ['#### ', '#   #', '#   #', '#### ', '#    ', '#    ', '#    '],
  R: ['#### ', '#   #', '#   #', '#### ', '# #  ', '#  # ', '#   #'],
  S: [' ####', '#    ', '#    ', ' ### ', '    #', '    #', '#### '],
  T: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  '],
  U: ['#   #', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  V: ['#   #', '#   #', '#   #', '#   #', '#   #', ' # # ', '  #  '],
  Y: ['#   #', '#   #', ' # # ', '  #  ', '  #  ', '  #  ', '  #  '],
};

function textWidth(text, scale) {
  return text.length * 6 * scale - scale;
}

function text(img, str, x, y, scale, color) {
  for (const ch of str) {
    const glyph = FONT[ch];
    if (glyph) {
      glyph.forEach((row, gy) => {
        [...row].forEach((px, gx) => {
          if (px === '#') rect(img, x + gx * scale, y + gy * scale, scale, scale, color);
        });
      });
    }
    x += 6 * scale;
  }
}

// ---------- palette ----------

const C = {
  ink: hex('#543847'),
  sky: hex('#4ec0ca'),
  cloud: hex('#e4f8f0'),
  city: hex('#a6dfc9'),
  bush: hex('#5ee270'),
  bushDark: hex('#47c457'),
  grassLight: hex('#9ce659'),
  grassDark: hex('#73bf2e'),
  grassEdge: hex('#558022'),
  dirt: hex('#ded895'),
  dirtDark: hex('#d0c874'),
  pipe: hex('#73bf2e'),
  pipeLight: hex('#9ce659'),
  pipeDark: hex('#558022'),
  yellow: hex('#f8d81f'),
  yellowLight: hex('#fbf0a8'),
  white: hex('#ffffff'),
  wing: hex('#fff6d5'),
  orange: hex('#f7731d'),
  orangeDark: hex('#d84f12'),
  title: hex('#fca048'),
  green: hex('#73d14b'),
};

// ---------- art ----------

function bird(wingDy) {
  const img = image(34, 24);
  ellipse(img, 16, 12, 12, 9.5, C.yellow);
  ellipse(img, 15, 16, 8.5, 4.5, C.yellowLight);
  ellipse(img, 22, 8.5, 4.5, 4.5, C.white);
  rect(img, 23, 7, 2, 3, C.ink);
  rect(img, 22, 13, 10, 2, C.orange);
  rect(img, 22, 15, 9, 1, C.orangeDark);
  rect(img, 22, 16, 8, 2, C.orange);
  ellipse(img, 8.5, 12 + wingDy, 6, 3.5, C.wing);
  // Wing outline drawn inside the body so it reads against the yellow.
  for (let x = 3; x <= 14; x++) {
    for (let y = 7 + wingDy; y <= 17 + wingDy; y++) {
      const inside = (dx, dy) => ((x + 0.5 + dx - 8.5) / 6) ** 2 + ((y + 0.5 + dy - 12 - wingDy) / 3.5) ** 2 <= 1;
      if (!inside(0, 0) && (inside(1, 0) || inside(-1, 0) || inside(0, 1) || inside(0, -1))) set(img, x, y, C.ink);
    }
  }
  outline(img, C.ink);
  return img;
}

function background() {
  const img = image(288, 512);
  rect(img, 0, 0, 288, 512, C.sky);
  // Clouds
  for (let x = -10; x < 300; x += 26) ellipse(img, x, 352 + ((x * 7) % 11), 20, 16, C.cloud);
  rect(img, 0, 360, 288, 40, C.cloud);
  // City silhouette
  const heights = [26, 38, 30, 46, 24, 34, 42, 28, 36, 22, 40, 32];
  let x = 0;
  heights.forEach((h, i) => {
    const w = 18 + ((i * 5) % 9);
    rect(img, x, 384 - h, w, h + 20, C.city);
    for (let wy = 384 - h + 4; wy < 384; wy += 6) {
      for (let wx = x + 3; wx < x + w - 3; wx += 5) rect(img, wx, wy, 2, 3, C.cloud);
    }
    x += w + 2;
  });
  // Bushes
  for (let bx = -6; bx < 300; bx += 18) ellipse(img, bx, 394 + ((bx * 3) % 5), 13, 11, C.bush);
  for (let bx = 3; bx < 300; bx += 18) ellipse(img, bx, 398, 6, 4, C.bushDark);
  rect(img, 0, 396, 288, 4, C.bush);
  return img;
}

function ground() {
  const img = image(336, 112);
  rect(img, 0, 0, 336, 112, C.dirt);
  rect(img, 0, 0, 336, 2, C.ink);
  for (let y = 2; y < 14; y++) {
    for (let x = 0; x < 336; x++) set(img, x, y, (x + y) % 24 < 12 ? C.grassLight : C.grassDark);
  }
  rect(img, 0, 14, 336, 2, C.grassEdge);
  rect(img, 0, 16, 336, 3, C.dirtDark);
  for (let y = 26; y < 112; y += 14) {
    for (let x = (y / 2) % 24; x < 336; x += 24) rect(img, x, y, 6, 2, C.dirtDark);
  }
  return img;
}

function shadePipe(img, x0, width, y0, height) {
  for (let x = x0; x < x0 + width; x++) {
    const f = (x - x0) / width;
    const c = f < 0.1 ? C.pipe : f < 0.28 ? C.pipeLight : f < 0.7 ? C.pipe : f < 0.85 ? C.pipeDark : C.pipe;
    rect(img, x, y0, 1, height, c);
  }
  rect(img, x0, y0, 1, height, C.ink);
  rect(img, x0 + width - 1, y0, 1, height, C.ink);
}

// Bottom pipe: cap at the top (the end that faces the gap).
function pipeBottom() {
  const img = image(52, 320);
  shadePipe(img, 2, 48, 24, 296);
  shadePipe(img, 0, 52, 0, 24);
  rect(img, 0, 0, 52, 1, C.ink);
  rect(img, 0, 23, 52, 1, C.ink);
  return img;
}

function digit(n) {
  const img = image(24, 36);
  text(img, String(n), 2, 4, 4, C.white);
  outline(img, C.ink, 2);
  return img;
}

function getReady() {
  const img = image(184, 267);
  // Two lines: the whole title is too wide for the overlay at this scale.
  const s = 3;
  ['VAMOS A', 'JUGAR'].forEach((line, i) => {
    text(img, line, Math.round((184 - textWidth(line, s)) / 2), 6 + i * 27, s, C.green);
  });
  // Tap hint, kept to the right so it doesn't sit under the bird.
  const ax = 140;
  for (let i = 0; i < 12; i++) rect(img, ax - i, 128 + i, i * 2 + 1, 1, C.white); // arrow head
  rect(img, ax - 4, 140, 9, 22, C.white); // arrow shaft
  text(img, 'TAP', ax - Math.round(textWidth('TAP', 3) / 2), 174, 3, C.white);
  outline(img, C.ink, 2);
  return img;
}

function gameOver() {
  const img = image(192, 42);
  const title = 'GAME OVER';
  const s = 3;
  text(img, title, Math.round((192 - textWidth(title, s)) / 2), 10, s, C.title);
  outline(img, C.white);
  outline(img, C.ink, 2);
  return img;
}

function writePng(name, img) {
  writeFileSync(path.join(IMAGES, name), encodePng(img));
}

writePng('bird-0.png', bird(-3));
writePng('bird-1.png', bird(0));
writePng('bird-2.png', bird(3));
writePng('background.png', background());
writePng('ground.png', ground());
const bottom = pipeBottom();
writePng('pipe-bottom.png', bottom);
writePng('pipe-top.png', flipVertical(bottom));
for (let n = 0; n <= 9; n++) writePng(`digit-${n}.png`, digit(n));
writePng('get-ready.png', getReady());
writePng('game-over.png', gameOver());

// ---------- WAV ----------

const RATE = 22050;

function writeWav(name, seconds, sample) {
  const n = Math.round(RATE * seconds);
  const pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const v = Math.max(-1, Math.min(1, sample(t, t / seconds)));
    pcm.writeInt16LE(Math.round(v * 32767 * 0.8), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  writeFileSync(path.join(SOUNDS, name), Buffer.concat([header, pcm]));
}

// Deterministic noise so regenerating gives identical files.
let seed = 1;
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed / 0x7fffffff) * 2 - 1;
};
const square = (phase) => (phase % 1 < 0.5 ? 1 : -1);

let phase = 0;
writeWav('flap.wav', 0.14, (t, p) => {
  phase += (520 - 300 * p) / RATE;
  return (Math.sin(phase * 2 * Math.PI) * 0.4 + noise() * 0.35) * (1 - p) ** 2;
});
writeWav('point.wav', 0.28, (t) => {
  const f = t < 0.08 ? 988 : 1319;
  const local = t < 0.08 ? t : t - 0.08;
  return square(t * f) * 0.35 * Math.exp(-local * 14);
});
writeWav('hit.wav', 0.16, (t, p) => (noise() * 0.7 + Math.sin(t * 2 * Math.PI * 90) * 0.6) * (1 - p) ** 3);
phase = 0;
writeWav('die.wav', 0.45, (t, p) => {
  phase += (700 - 560 * p) / RATE;
  return square(phase) * 0.3 * (1 - p);
});

console.log(`Wrote placeholders to ${path.relative(process.cwd(), ROOT) || ROOT}`);
