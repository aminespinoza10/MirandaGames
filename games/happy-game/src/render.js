// Draws the game from its state. The only module that touches the canvas.

import { WIDTH, HEIGHT, PIPE_GAP } from './config.js';
import { READY, PLAYING, GAME_OVER, canRestart } from './game.js';
import { frameIndex } from './bird.js';

const INK = '#543847';
const LABEL = '#e86101';

function drawBackground(ctx, bg) {
  for (let x = 0; x < WIDTH; x += bg.width) ctx.drawImage(bg.frames[0], x, 0, bg.width, bg.height);
}

function drawGround(ctx, ground, offset, groundY) {
  const start = -(offset % ground.width);
  for (let x = start; x < WIDTH; x += ground.width) ctx.drawImage(ground.frames[0], x, groundY, ground.width, ground.height);
}

// Pipes are anchored at the gap; longer than the art means stretching it to fit.
function drawPipes(ctx, pipes, images, groundY) {
  const top = images.pipeTop;
  const bottom = images.pipeBottom;
  for (const pipe of pipes) {
    if (pipe.gapY <= top.height) ctx.drawImage(top.frames[0], pipe.x, pipe.gapY - top.height, top.width, top.height);
    else ctx.drawImage(top.frames[0], pipe.x, 0, top.width, pipe.gapY);

    const bottomY = pipe.gapY + PIPE_GAP;
    const length = groundY - bottomY;
    ctx.drawImage(bottom.frames[0], pipe.x, bottomY, bottom.width, Math.max(length, bottom.height));
  }
}

function drawBird(ctx, bird, image) {
  const frame = image.frames[frameIndex(bird, image.frames.length)];
  ctx.save();
  ctx.translate(Math.round(bird.x), Math.round(bird.y));
  ctx.rotate((bird.rotation * Math.PI) / 180);
  ctx.drawImage(frame, -image.width / 2, -image.height / 2, image.width, image.height);
  ctx.restore();
}

// After a crash: upright (no nose-dive), centered on the bird and standing on the bird's bottom edge,
// so art taller than the bird (a halo, say) grows upward.
function drawDeadBird(ctx, bird, image) {
  const bottom = bird.y + bird.height / 2;
  ctx.drawImage(image.frames[0], Math.round(bird.x - image.width / 2), Math.round(bottom - image.height), image.width, image.height);
}

// Draws a number with the digit sprites. align: 'center' | 'right'.
function drawNumber(ctx, digits, value, x, y, scale = 1, align = 'center') {
  const text = String(value);
  const w = digits.width * scale;
  const h = digits.height * scale;
  const spacing = -2 * scale;
  const total = text.length * w + (text.length - 1) * spacing;
  let cx = align === 'center' ? x - total / 2 : x - total;
  for (const ch of text) {
    ctx.drawImage(digits.frames[Number(ch)], Math.round(cx), Math.round(y), w, h);
    cx += w + spacing;
  }
}

function centered(ctx, image, y) {
  ctx.drawImage(image.frames[0], Math.round((WIDTH - image.width) / 2), y, image.width, image.height);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function label(ctx, text, x, y, color = LABEL, align = 'right', outline = '#ffffff') {
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.lineWidth = 3;
  ctx.strokeStyle = outline;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawGameOver(ctx, game, images) {
  centered(ctx, images.gameOver, 110);

  const w = 226;
  const h = 114;
  const x = (WIDTH - w) / 2;
  const y = 170;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = '#ded895';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();

  const right = x + w - 18;
  label(ctx, 'SCORE', right, y + 12);
  drawNumber(ctx, images.digits, game.score, right, y + 28, 0.7, 'right');
  label(ctx, 'BEST', right, y + 60);
  drawNumber(ctx, images.digits, game.best, right, y + 76, 0.7, 'right');
  if (game.newBest) {
    ctx.fillStyle = '#ff3b30';
    roundRect(ctx, right - 96, y + 60, 34, 16, 3);
    ctx.fill();
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('NEW', right - 79, y + 68);
  }

  if (canRestart(game)) label(ctx, 'TAP TO PLAY AGAIN', WIDTH / 2, y + h + 16, '#ffffff', 'center', INK);
}

export function render(ctx, game, assets) {
  const { images } = assets;
  const groundY = game.dims.groundY;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  drawBackground(ctx, images.background);
  drawPipes(ctx, game.pipes.list, images, groundY);
  drawGround(ctx, images.ground, game.groundOffset, groundY);
  if (game.phase === GAME_OVER && images.birdDead) drawDeadBird(ctx, game.bird, images.birdDead);
  else drawBird(ctx, game.bird, images.bird);

  if (game.phase === READY) centered(ctx, images.getReady, 80);
  if (game.phase === PLAYING) drawNumber(ctx, images.digits, game.score, WIDTH / 2, 30);
  if (game.phase === GAME_OVER) drawGameOver(ctx, game, images);
}

export function renderLoading(ctx) {
  ctx.fillStyle = '#4ec0ca';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Loading…', WIDTH / 2, HEIGHT / 2);
}
