// Game state machine: Ready → Playing → Game Over → Ready.
// Pure: input arrives through flap(), time through step(), sounds leave through `events`.

import * as birdLogic from './bird.js';
import { createPipes, updatePipes } from './pipes.js';
import { findCollision } from './collision.js';
import { collectPoints } from './score.js';

export const READY = 'ready';
export const PLAYING = 'playing';
export const GAME_OVER = 'over';

// dims: { bird: {width, height}, pipeWidth, groundY } from the manifest's declared sizes.
export function createGame({ cfg, dims, bestStore, rng = Math.random }) {
  const game = {
    cfg,
    dims,
    bestStore,
    rng,
    phase: READY,
    bird: null,
    pipes: null,
    score: 0,
    best: bestStore.get(),
    newBest: false,
    overMs: 0,
    hitPipe: false,
    groundOffset: 0,
    events: [],
  };
  reset(game);
  return game;
}

function reset(game) {
  game.phase = READY;
  game.bird = birdLogic.createBird(game.cfg, game.dims.bird);
  game.pipes = createPipes();
  game.score = 0;
  game.newBest = false;
  game.overMs = 0;
  game.hitPipe = false;
}

export function flap(game) {
  const { cfg } = game;
  if (game.phase === READY) {
    game.phase = PLAYING;
    birdLogic.flap(game.bird, cfg);
    game.events.push('flap');
  } else if (game.phase === PLAYING) {
    birdLogic.flap(game.bird, cfg);
    game.events.push('flap');
  } else if (canRestart(game)) {
    reset(game);
  }
}

function endRound(game, cause) {
  game.phase = GAME_OVER;
  game.overMs = 0;
  game.hitPipe = cause === 'pipe';
  game.events.push('hit');
  game.newBest = game.bestStore.submit(game.score);
  game.best = game.bestStore.get();
}

export function step(game) {
  const { cfg, dims, bird } = game;

  if (game.phase === READY) {
    birdLogic.updateIdle(bird, cfg);
    game.groundOffset += cfg.SCROLL_SPEED;
    return;
  }

  if (game.phase === PLAYING) {
    birdLogic.updatePhysics(bird, cfg, dims.groundY);
    updatePipes(game.pipes, cfg, { pipeWidth: dims.pipeWidth, groundY: dims.groundY, rng: game.rng });
    game.groundOffset += cfg.SCROLL_SPEED;

    const gained = collectPoints(game.pipes.list, bird.x, dims.pipeWidth);
    if (gained) {
      game.score += gained;
      game.events.push('point');
    }

    const box = birdLogic.hitbox(bird, cfg.BIRD_HITBOX_INSET);
    const hit = findCollision(box, game.pipes.list, cfg, dims);
    if (hit) endRound(game, hit);
    return;
  }

  // Game over: the world is frozen, the bird falls to the ground after a pipe hit.
  game.overMs += cfg.STEP_MS;
  if (!birdLogic.isOnGround(bird, cfg, dims.groundY)) {
    birdLogic.updatePhysics(bird, cfg, dims.groundY);
    if (game.hitPipe && birdLogic.isOnGround(bird, cfg, dims.groundY)) game.events.push('die');
  }
}

export function canRestart(game) {
  // Tolerance: overMs is a sum of 1000/60 steps and can land a hair under the delay.
  return game.phase === GAME_OVER && game.overMs + 1e-6 >= game.cfg.RESTART_DELAY_MS;
}

// Hands queued sound events to the caller and clears the queue.
export function drainEvents(game) {
  const events = game.events;
  game.events = [];
  return events;
}
