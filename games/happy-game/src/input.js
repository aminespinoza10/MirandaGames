// Turns clicks, taps, Space and Up Arrow into a single "flap" callback.

const FLAP_KEYS = new Set(['Space', 'ArrowUp']);

export function attachInput(target, onFlap) {
  target.addEventListener('pointerdown', (event) => {
    if (event.button > 0) return; // ignore right/middle clicks
    event.preventDefault();
    onFlap();
  });
  // Stop long-press menus and double-tap zoom from hijacking taps on mobile.
  target.addEventListener('contextmenu', (event) => event.preventDefault());
  target.addEventListener('touchstart', (event) => event.preventDefault(), { passive: false });

  window.addEventListener('keydown', (event) => {
    if (!FLAP_KEYS.has(event.code)) return;
    event.preventDefault(); // Space would otherwise scroll the page
    if (!event.repeat) onFlap();
  });
}
