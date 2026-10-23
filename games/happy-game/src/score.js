// Scoring and best-score persistence.

// Awards one point per pipe pair whose center the bird's center has passed. Returns points gained.
export function collectPoints(pipes, birdX, pipeWidth) {
  let gained = 0;
  for (const pipe of pipes) {
    if (!pipe.scored && birdX >= pipe.x + pipeWidth / 2) {
      pipe.scored = true;
      gained++;
    }
  }
  return gained;
}

// storage: a Storage-like object (getItem/setItem) that may be missing or throw.
// Falls back to an in-memory best for the session.
export function createBestStore(storage, key) {
  let best = 0;
  try {
    const stored = Number.parseInt(storage?.getItem(key) ?? '0', 10);
    if (Number.isFinite(stored) && stored > 0) best = stored;
  } catch {
    // Storage unavailable (private mode, blocked cookies): keep the in-memory value.
  }
  return {
    get: () => best,
    // Records a finished round. Returns true when it set a new best.
    submit(score) {
      if (score <= best) return false;
      best = score;
      try {
        storage?.setItem(key, String(best));
      } catch {
        // Same as above: the session still remembers it.
      }
      return true;
    },
  };
}
