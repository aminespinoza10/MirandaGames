// Generates the game's art (PNG) and sounds (WAV) in assets/. The puppy sprites (happy-*.png) are not made here.
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
  white: hex('#ffffff'),
  title: hex('#fca048'),
  green: hex('#73d14b'),
  mint0: hex('#a6e3c8'),
  mint1: hex('#bdecd6'),
  mint2: hex('#d3f3e2'),
  mint3: hex('#e9faef'),
  cottonCandy: hex('#f5bccb'),
  cottonCandyLight: hex('#fde0e8'),
  farHill: hex('#e7b0bc'),
  farHillDark: hex('#d899a8'),
  cream: hex('#fbe8c8'),
  creamDark: hex('#eccfa3'),
  icing: hex('#fff6f2'),
  gold: hex('#e9b949'),
  goldDark: hex('#c08a2c'),
  caramel: hex('#dc8c5b'),
  caramelDark: hex('#b9643e'),
  choco: hex('#86493a'),
  chocoDark: hex('#643225'),
  frostingPink: hex('#f7a6c1'),
  frostingPinkDark: hex('#e584a5'),
  river: hex('#9b3a45'),
  riverLight: hex('#c25a63'),
  lollyMint: hex('#8fdcbc'),
  lollyPink: hex('#ff8fb1'),
  caneRed: hex('#e3343f'),
  caneRedLight: hex('#ff6f78'),
  caneRedDark: hex('#a91d2a'),
  caneWhiteDark: hex('#e2d3da'),
  sprinkles: [hex('#ff5c8a'), hex('#5cc8ff'), hex('#ffe066'), hex('#7be08f'), hex('#ffffff')],
};

// ---------- art ----------

// ---------- candy land background ----------

// Fixed seed so regenerating always gives the same picture.
function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

// Upper half of an ellipse standing on baseY.
function dome(img, cx, baseY, rx, ry, c) {
  for (let y = Math.floor(baseY - ry); y <= baseY; y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - baseY) / ry) ** 2 <= 1) set(img, x, y, c);
    }
  }
}

// Gumdrop hill: shaded body, swirl bands, a drippy frosting cap with sprinkles.
function candyHill(img, rng, { cx, baseY, rx, ry, body, shade, cap, capShade, bands = true }) {
  dome(img, cx, baseY, rx, ry, shade);
  dome(img, cx - rx * 0.12, baseY, rx * 0.82, ry * 0.96, body);
  const capLine = (x) => baseY - ry * 0.62 + Math.round(Math.sin(x * 0.9) * 2 + Math.sin(x * 0.37) * 2);
  for (let y = Math.floor(baseY - ry); y <= baseY; y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - baseY) / ry;
      if (dx * dx + dy * dy > 1) continue;
      if (y < capLine(x)) {
        set(img, x, y, dx > 0.45 ? capShade : cap);
        if (rng() < 0.05) set(img, x, y, C.sprinkles[Math.floor(rng() * C.sprinkles.length)]);
      } else if (bands && (y - Math.round(dx * 6)) % 9 < 2) {
        set(img, x, y, shade);
      }
    }
  }
}

function cloudPuff(img, x, y, w) {
  const puffs = [[0, 4, 0.30], [0.22, 0, 0.32], [0.48, -2, 0.36], [0.74, 2, 0.30], [1, 5, 0.24]];
  for (const [fx, dy, fr] of puffs) ellipse(img, x + fx * w, y + dy, w * fr, w * fr * 0.7, C.cottonCandy);
  for (const [fx, dy, fr] of puffs) ellipse(img, x + fx * w - 1, y + dy - 3, w * fr * 0.8, w * fr * 0.5, C.cottonCandyLight);
}

function tower(img, x, top, w, h) {
  rect(img, x, top, w, h, C.icing);
  rect(img, x + w - 1, top, 1, h, C.creamDark);
  for (let i = 0; i < 7; i++) rect(img, x + w / 2 - Math.floor(i / 2), top - 7 + i, Math.floor(i / 2) * 2 + 1, 1, i < 2 ? C.gold : C.icing);
  rect(img, x + Math.floor(w / 2), top - 9, 1, 2, C.gold); // spire tip
  rect(img, x + Math.floor(w / 2) - 1, top + 4, 2, 3, C.goldDark); // window
}

function castle(img, cx, baseY) {
  rect(img, cx - 20, baseY - 16, 40, 16, C.icing);
  rect(img, cx - 20, baseY - 2, 40, 2, C.creamDark);
  tower(img, cx - 24, baseY - 26, 7, 26);
  tower(img, cx + 17, baseY - 26, 7, 26);
  tower(img, cx - 13, baseY - 34, 7, 18);
  tower(img, cx + 6, baseY - 34, 7, 18);
  tower(img, cx - 4, baseY - 46, 9, 30);
  rect(img, cx - 5, baseY - 9, 10, 9, C.gold); // gate
  rect(img, cx - 3, baseY - 7, 6, 7, C.goldDark);
  for (let x = cx - 19; x < cx + 20; x += 4) rect(img, x, baseY - 18, 2, 2, C.icing); // battlements
}

function lollipop(img, x, baseY, h, color) {
  rect(img, x, baseY - h, 1, h, C.icing);
  ellipse(img, x + 0.5, baseY - h, 4.5, 4.5, color);
  set(img, x - 1, baseY - h - 2, C.icing);
  set(img, x + 2, baseY - h, C.icing);
}

function background() {
  const img = image(288, 512);
  const rng = seeded(7);

  // Mint sky in bands, dithered at each step like old consoles did.
  const bands = [[0, C.mint0], [110, C.mint1], [200, C.mint2], [260, C.mint3]];
  for (let y = 0; y < 512; y++) {
    const i = bands.findLastIndex(([start]) => y >= start);
    const next = bands[i + 1];
    for (let x = 0; x < 288; x++) {
      const near = next && next[0] - y <= 3 && (x + y) % 2 === 0;
      set(img, x, y, near ? next[1] : bands[i][1]);
    }
  }

  cloudPuff(img, 12, 52, 70);
  cloudPuff(img, 170, 34, 90);
  cloudPuff(img, 120, 132, 46);
  cloudPuff(img, 230, 178, 40);

  // Far pink hills.
  for (const [cx, rx, ry] of [[-10, 46, 70], [60, 40, 52], [120, 50, 82], [235, 48, 88], [300, 40, 60]]) {
    dome(img, cx, 340, rx, ry, C.farHillDark);
    dome(img, cx - 4, 340, rx * 0.85, ry * 0.95, C.farHill);
  }

  // Castle on a cream hill.
  dome(img, 168, 352, 58, 50, C.creamDark);
  dome(img, 162, 352, 50, 48, C.cream);
  castle(img, 166, 306);

  // Candy hills, back to front.
  candyHill(img, rng, { cx: 92, baseY: 392, rx: 30, ry: 44, body: C.frostingPink, shade: C.frostingPinkDark, cap: C.icing, capShade: C.cream });
  candyHill(img, rng, { cx: 18, baseY: 392, rx: 46, ry: 88, body: C.caramel, shade: C.caramelDark, cap: C.icing, capShade: C.cream });
  candyHill(img, rng, { cx: 214, baseY: 392, rx: 26, ry: 40, body: C.choco, shade: C.chocoDark, cap: C.frostingPink, capShade: C.frostingPinkDark });
  candyHill(img, rng, { cx: 268, baseY: 392, rx: 44, ry: 78, body: C.caramel, shade: C.caramelDark, cap: C.frostingPink, capShade: C.frostingPinkDark });
  candyHill(img, rng, { cx: 150, baseY: 392, rx: 22, ry: 26, body: C.choco, shade: C.chocoDark, cap: C.icing, capShade: C.cream, bands: false });

  for (const [x, h, color] of [[58, 18, C.lollyMint], [122, 14, C.lollyPink], [180, 20, C.lollyMint], [190, 12, C.lollyPink], [238, 16, C.lollyMint]]) {
    lollipop(img, x, 386, h, color);
  }

  // Strawberry-chocolate river with a frosting bank, just above the ground.
  for (let x = 0; x < 288; x++) {
    const bank = 383 + Math.round(Math.sin(x * 0.21) * 1.5);
    rect(img, x, bank, 1, 4, C.frostingPink);
    rect(img, x, bank + 4, 1, 400 - bank - 4 + 112, C.river);
  }
  for (let x = 4; x < 288; x += 22) rect(img, x + (x % 3), 393, 8, 1, C.riverLight);
  return img;
}

// Candy floor: candy-cane stripes, dripping frosting, layered chocolate cake. Every pattern repeats
// every 24px (336 = 14 x 24), so the left and right edges match when it scrolls.
function ground() {
  const img = image(336, 112);
  const rng = seeded(11);
  rect(img, 0, 0, 336, 112, C.choco);
  rect(img, 0, 0, 336, 2, C.ink);
  for (let y = 2; y < 14; y++) {
    for (let x = 0; x < 336; x++) set(img, x, y, (x + y) % 24 < 12 ? C.icing : C.lollyPink);
  }
  rect(img, 0, 14, 336, 2, C.frostingPinkDark);
  for (let x = 0; x < 336; x++) {
    const drip = 3 + Math.round(Math.max(0, Math.sin((x * 2 * Math.PI) / 24)) * 5);
    rect(img, x, 16, 1, drip, C.frostingPink);
  }
  rect(img, 0, 52, 336, 6, C.cream);
  rect(img, 0, 57, 336, 1, C.creamDark);
  rect(img, 0, 88, 336, 3, C.chocoDark);
  for (let i = 0; i < 140; i++) {
    const x = Math.floor(rng() * 334);
    const y = 26 + Math.floor(rng() * 84);
    if (y >= 51 && y <= 58) continue;
    rect(img, x, y, 2, 1, C.sprinkles[Math.floor(rng() * C.sprinkles.length)]);
  }
  return img;
}

// Paints one red-and-white striped column of a round candy stick: highlight on the left, shadow on the right.
function caneColumn(img, x, x0, width, y0, height, slope) {
  const f = (x - x0 + 0.5) / width;
  for (let y = y0; y < y0 + height; y++) {
    const red = (((x + slope * y) % 16) + 16) % 16 < 8;
    let c = red ? C.caneRed : C.white;
    if (f > 0.16 && f < 0.32) c = red ? C.caneRedLight : C.white;
    else if (f > 0.74 || f < 0.06) c = red ? C.caneRedDark : C.caneWhiteDark;
    set(img, x, y, c);
  }
}

// Bottom candy stick (the manifest's pipeBottom): 52px wide like the pipe hitbox, with a wider cap at the end that faces the gap.
function candyStickBottom() {
  const img = image(52, 320);
  for (let x = 2; x < 50; x++) caneColumn(img, x, 2, 48, 24, 296, 1);
  rect(img, 2, 24, 1, 296, C.ink);
  rect(img, 49, 24, 1, 296, C.ink);
  for (let x = 0; x < 52; x++) caneColumn(img, x, 0, 52, 1, 22, -1);
  // Ink border around the cap, with the corners rounded off.
  rect(img, 2, 0, 48, 1, C.ink);
  rect(img, 2, 23, 48, 1, C.ink);
  rect(img, 0, 2, 1, 20, C.ink);
  rect(img, 51, 2, 1, 20, C.ink);
  for (const [x, y] of [[1, 1], [50, 1], [1, 22], [50, 22]]) set(img, x, y, C.ink);
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [50, 0], [51, 0], [51, 1], [0, 22], [0, 23], [1, 23], [51, 22], [51, 23], [50, 23]]) {
    set(img, x, y, [0, 0, 0, 0]);
  }
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

writePng('background.png', background());
writePng('ground.png', ground());
const stick = candyStickBottom();
writePng('candy-stick-bottom.png', stick);
writePng('candy-stick-top.png', flipVertical(stick));
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
