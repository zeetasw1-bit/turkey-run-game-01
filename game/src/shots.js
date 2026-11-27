// The screenshot scenes behind ?shot=start|play|kitchen|end. Each one plays the
// real rules forward from a fresh world for a fixed time, steered by a simple
// autopilot (jump the hazard ahead, slide under a thrown knife, hide in a
// haystack when the farmer is close, chase the lowest corn when that is safe),
// so the frame is what a short game really looks like and the same seed always
// gives the same frame.
import { STEP, TURKEY } from './config.js';
import { EVENT_OVER, KIND_HAYSTACK, KIND_KNIFE_FLY } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 16;
const KITCHEN_SECONDS = 9;
const END_LIMIT_SECONDS = 120;
/**
 * The pilot jumps when a hazard is about this many seconds away: late enough
 * that one jump carries the turkey over it at full height (the jump peaks
 * about 0.37 s after take-off), never so early that it lands on top of it
 * and has to jump twice for the same hazard.
 */
const JUMP_ARCS = 0.5;

function nextHazard(state) {
  let best = null;
  for (const hazard of state.hazards) {
    if (hazard.kind === KIND_HAYSTACK) continue;
    if (hazard.x + hazard.width < TURKEY.x) continue;
    if (best === null || hazard.x < best.x) best = hazard;
  }
  return best;
}

function nearestHaystack(state) {
  for (const hazard of state.hazards) {
    if (hazard.kind === KIND_HAYSTACK && Math.abs(hazard.x - TURKEY.x) < 120) return hazard;
  }
  return null;
}

/** The autopilot's move: 1 jump, 2 slide, 4 hide, 0 run on. */
function autopilot(state) {
  const player = state.player;
  const hazard = nextHazard(state);
  if (hazard) {
    const gap = hazard.x - (TURKEY.x + TURKEY.width);
    if (hazard.kind === KIND_KNIFE_FLY && gap < 220 && gap > -40 && player.onGround) return 2;
    // Time, not distance: the same jump works at every speed.
    const timeToArrive = gap / state.speed;
    if (timeToArrive < JUMP_ARCS && timeToArrive > -0.05 && player.onGround && player.sliding <= 0) return 1;
    // Double jump: flapping again while coming down over a wide hazard, so
    // the turkey stays up until the hazard has passed underneath.
    if (!player.onGround && player.vy > 0 && player.jumps < 2 && gap < 200 && gap > -80) return 1;
  }
  if (state.pursuit > 0.62 && nearestHaystack(state) && player.hideCooldown <= 0) return 4;
  return 0;
}

/**
 * Set `world` to the named scene (start, play, kitchen or end; any other name
 * is start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'kitchen' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, 0, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'kitchen') {
    world.warpTo(700);
    // Play until a hot oven is in frame (the kitchen's signature hazard), so
    // the shot shows what the stage is about; give up after 25 seconds.
    for (let index = 0; index < 25 / STEP; index += 1) {
      if (world.step(STEP, autopilot(world.state), false) & EVENT_OVER) break;
      const ovenInFrame = world.state.hazards.some(
        (hazard) => hazard.kind === 'oven' && hazard.x > 350 && hazard.x < 1000,
      );
      if (ovenInFrame && index > KITCHEN_SECONDS / STEP) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  for (let index = 0; index < limit / STEP; index += 1) {
    if (world.step(STEP, autopilot(world.state), false) & EVENT_OVER) break;
  }
  const over = world.state.outcome !== null;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
