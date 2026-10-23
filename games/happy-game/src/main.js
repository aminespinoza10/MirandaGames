// Boot: size the canvas, load build id + manifest + assets, then start the loop.

import * as cfg from './config.js';
import { loadAssets, validateManifest, unlockAudio } from './assets.js';
import { createGame, flap, step, drainEvents } from './game.js';
import { createBestStore } from './score.js';
import { attachInput } from './input.js';
import { startLoop } from './loop.js';
import { render, renderLoading } from './render.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const message = document.getElementById('message');

function showMessage(html) {
  message.innerHTML = html;
  message.hidden = false;
}

// Largest size that fits the window at the game's aspect ratio, rendered at device resolution.
function fit() {
  const viewport = window.visualViewport ?? { width: innerWidth, height: innerHeight };
  const scale = Math.min(viewport.width / cfg.WIDTH, viewport.height / cfg.HEIGHT);
  canvas.style.width = `${Math.floor(cfg.WIDTH * scale)}px`;
  canvas.style.height = `${Math.floor(cfg.HEIGHT * scale)}px`;
  const k = Math.max(1, Math.round(scale * (window.devicePixelRatio || 1)));
  canvas.width = cfg.WIDTH * k;
  canvas.height = cfg.HEIGHT * k;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${url} is not valid JSON`);
  }
}

// Deployed builds stamp build.json; locally it holds null, so every load is fresh.
async function buildId() {
  try {
    const { build } = await fetchJson('build.json');
    if (build) return String(build);
  } catch {
    // No stamp available: fall through.
  }
  return String(Date.now());
}

function localStorageOrNull() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function boot() {
  if (location.protocol === 'file:') {
    showMessage(
      'This game has to be served over HTTP. From <code>games/happy-game</code> run ' +
        '<code>npx serve</code> or <code>python3 -m http.server</code> and open the address it prints.',
    );
    return;
  }

  fit();
  renderLoading(ctx);
  window.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('resize', fit);

  let assets;
  try {
    const build = await buildId();
    const manifest = await fetchJson(`assets/manifest.json?v=${encodeURIComponent(build)}`);
    const problems = validateManifest(manifest);
    if (problems.length) throw new Error(`assets/manifest.json has problems:<br>• ${problems.join('<br>• ')}`);
    assets = await loadAssets(manifest, { build });
  } catch (error) {
    showMessage(`Could not start the game. ${error.message}`);
    return;
  }

  const { images, sounds } = assets;
  const game = createGame({
    cfg,
    dims: {
      bird: { width: images.bird.width, height: images.bird.height },
      pipeWidth: images.pipeTop.width,
      groundY: cfg.HEIGHT - images.ground.height,
    },
    bestStore: createBestStore(localStorageOrNull(), cfg.BEST_SCORE_KEY),
  });

  const playEvents = () => {
    for (const event of drainEvents(game)) sounds[event]?.play();
  };

  attachInput(stage, () => {
    unlockAudio();
    flap(game);
    playEvents(); // inside the input handler, so mobile browsers allow the sound
  });

  startLoop({
    stepMs: cfg.STEP_MS,
    maxFrameMs: cfg.MAX_FRAME_MS,
    step: () => {
      step(game);
      playEvents();
    },
    render: () => render(ctx, game, assets),
  });

  // Exposed for debugging in the browser console.
  window.happyGame = { game, assets };
}

boot();
