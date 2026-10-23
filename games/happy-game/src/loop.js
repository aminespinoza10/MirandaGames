// Fixed-timestep accumulator: the simulation always advances in STEP_MS increments,
// so the bird follows the same trajectory on 60 Hz and 144 Hz displays.

const EPSILON = 1e-6;

export function createStepper(stepMs, maxFrameMs) {
  let accumulator = 0;
  return {
    // Returns how many fixed steps to run for a frame that took dtMs.
    advance(dtMs) {
      accumulator += Math.min(Math.max(dtMs, 0), maxFrameMs);
      let steps = 0;
      while (accumulator + EPSILON >= stepMs) {
        accumulator -= stepMs;
        steps++;
      }
      return steps;
    },
    reset() {
      accumulator = 0;
    },
  };
}

export function startLoop({ stepMs, maxFrameMs, step, render, raf = requestAnimationFrame }) {
  const stepper = createStepper(stepMs, maxFrameMs);
  let last = null;
  const frame = (now) => {
    const dt = last === null ? 0 : now - last;
    last = now;
    const steps = stepper.advance(dt);
    for (let i = 0; i < steps; i++) step();
    render();
    raf(frame);
  };
  raf(frame);
}
