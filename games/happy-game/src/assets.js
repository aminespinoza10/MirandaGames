// Loads the images and sounds declared in assets/manifest.json.
// Anything that fails to load is replaced by a fallback so the game stays playable.

export const IMAGE_KEYS = ['bird', 'background', 'ground', 'pipeTop', 'pipeBottom', 'digits', 'getReady', 'gameOver'];
export const SOUND_KEYS = ['flap', 'point', 'hit', 'die'];
// May be left out of the manifest; the game then reuses another image (see render.js).
export const OPTIONAL_IMAGE_KEYS = ['birdDead'];

const FALLBACK_COLORS = {
  bird: '#f8d81f',
  birdDead: '#f8d81f',
  background: '#4ec0ca',
  ground: '#ded895',
  pipeTop: '#73bf2e',
  pipeBottom: '#73bf2e',
  digits: '#ffffff',
  getReady: '#73d14b',
  gameOver: '#fca048',
};

export function assetUrl(base, path, build) {
  return `${base}${path}?v=${encodeURIComponent(build)}`;
}

// Every image entry becomes { frames: [path, ...], width, height }.
export function normalizeImage(entry) {
  const frames = Array.isArray(entry?.frames) ? entry.frames : entry?.src ? [entry.src] : [];
  return { frames, width: entry?.width, height: entry?.height };
}

// Returns a list of human-readable problems; empty when the manifest is usable.
export function validateManifest(manifest) {
  const problems = [];
  if (!manifest || typeof manifest !== 'object') return ['manifest is not a JSON object'];
  for (const key of [...IMAGE_KEYS, ...OPTIONAL_IMAGE_KEYS]) {
    const entry = manifest.images?.[key];
    if (!entry) {
      if (IMAGE_KEYS.includes(key)) problems.push(`images.${key} is missing`);
      continue;
    }
    const { frames, width, height } = normalizeImage(entry);
    if (frames.length === 0) problems.push(`images.${key} needs "src" or a non-empty "frames" list`);
    if (!(width > 0) || !(height > 0)) problems.push(`images.${key} needs positive "width" and "height"`);
  }
  const digits = normalizeImage(manifest.images?.digits);
  if (manifest.images?.digits && digits.frames.length !== 10) problems.push('images.digits needs exactly 10 frames (0-9)');
  for (const key of SOUND_KEYS) {
    if (typeof manifest.sounds?.[key] !== 'string') problems.push(`sounds.${key} is missing`);
  }
  return problems;
}

function defaultCreateCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Plain stand-in drawn at the declared size. Text-based keys keep their meaning so the game stays readable.
function fallbackImage(key, index, width, height, createCanvas) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const color = FALLBACK_COLORS[key] ?? '#ff00ff';
  const label = key === 'digits' ? String(index) : key === 'getReady' ? 'GET READY' : key === 'gameOver' ? 'GAME OVER' : null;
  if (label) {
    ctx.fillStyle = color;
    ctx.strokeStyle = '#543847';
    ctx.lineWidth = 3;
    ctx.font = `bold ${Math.min(height * 0.8, 32)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = key === 'getReady' ? 'top' : 'middle';
    const y = key === 'getReady' ? 4 : height / 2;
    ctx.strokeText(label, width / 2, y);
    ctx.fillText(label, width / 2, y);
  } else if (key === 'bird' || key === 'birdDead') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
  }
  return canvas;
}

function defaultLoadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
    // Also fires when the server answers a bad path with an HTML page: it can't decode as an image.
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Resolves to a playable source URL or null. Rejects HTML bodies served for missing files.
async function defaultLoadSound(url) {
  try {
    const response = await fetch(url);
    const type = response.headers.get('content-type') ?? '';
    if (!response.ok || type.includes('text/html')) return null;
    return URL.createObjectURL(await response.blob());
  } catch {
    return null;
  }
}

let audioUnlocked = false;

// Browsers block audio until the player interacts; call this from the first input event.
export function unlockAudio() {
  audioUnlocked = true;
}

function makeSound(src) {
  if (!src) return { play() {} };
  const base = new Audio(src);
  base.preload = 'auto';
  return {
    play() {
      if (!audioUnlocked) return;
      try {
        const instance = base.cloneNode();
        instance.play()?.catch?.(() => {});
      } catch {
        // A sound failing must never interrupt the game.
      }
    },
  };
}

// Returns { images: { key: { frames: [drawable], width, height } }, sounds: { key: { play() } } }.
export async function loadAssets(manifest, options = {}) {
  const {
    base = 'assets/',
    build = String(Date.now()),
    log = (msg) => console.warn(msg),
    createCanvas = defaultCreateCanvas,
    loadImage = defaultLoadImage,
    loadSound = defaultLoadSound,
    createSound = makeSound,
  } = options;

  const images = {};
  const declared = [...IMAGE_KEYS, ...OPTIONAL_IMAGE_KEYS.filter((key) => manifest.images[key])];
  const imageJobs = declared.map(async (key) => {
    const { frames, width, height } = normalizeImage(manifest.images[key]);
    const loaded = await Promise.all(
      frames.map(async (path, index) => {
        const img = await loadImage(assetUrl(base, path, build));
        if (img) return img;
        log(`[assets] ${key}: failed to load or decode "${path}", using a fallback`);
        return fallbackImage(key, index, width, height, createCanvas);
      }),
    );
    images[key] = { frames: loaded, width, height };
  });

  const sounds = {};
  const soundJobs = SOUND_KEYS.map(async (key) => {
    const path = manifest.sounds[key];
    const src = await loadSound(assetUrl(base, path, build));
    if (!src) log(`[assets] ${key}: failed to load sound "${path}", it will be silent`);
    sounds[key] = createSound(src);
  });

  await Promise.all([...imageJobs, ...soundJobs]);
  return { images, sounds };
}
