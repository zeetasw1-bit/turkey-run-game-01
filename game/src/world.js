// The whole simulation: the turkey, the farmer's pursuit, the hazards and
// pickups, the three stages and the win/lose rules. No drawing here, no input
// here — step() takes an action bitmask and returns an event bitmask.

import {
  ESCAPE_DISTANCE,
  FARMER,
  FIELD,
  LIVES,
  PICKUP,
  SPAWN,
  SPEED,
  STAGES,
  STEP,
  TURKEY,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_PICKUP = 4;
export const EVENT_STAGE = 8;
export const EVENT_FEATHER = 16;
export const EVENT_SPOTTED = 32;
export const EVENT_SLOW = 64;

export const KIND_HAY = 'hay';
export const KIND_FENCE = 'fence';
export const KIND_MUD = 'mud';
export const KIND_CRATE = 'crate';
export const KIND_PITCHFORK = 'pitchfork';
export const KIND_OVEN = 'oven';
export const KIND_KNIFE_FALL = 'knifeFall';
export const KIND_KNIFE_FLY = 'knifeFly';
export const KIND_HAYSTACK = 'haystack';

export const PICKUP_CORN = 'corn';
export const PICKUP_FEATHER = 'feather';
export const PICKUP_PIE = 'pie';

const HAZARD_TABLE = [
  // kind, width, height, weight by stage (farmyard, barn, kitchen)
  [KIND_HAY, 92, 46, [3, 2, 0]],
  [KIND_FENCE, 26, 64, [3, 2, 0]],
  [KIND_MUD, 130, 14, [2, 1, 0]],
  [KIND_CRATE, 70, 70, [1, 3, 2]],
  [KIND_PITCHFORK, 30, 92, [0, 3, 1]],
  [KIND_OVEN, 122, 82, [0, 0, 3]],
  [KIND_KNIFE_FALL, 26, 64, [0, 1, 3]],
  [KIND_KNIFE_FLY, 62, 20, [0, 1, 3]],
  [KIND_HAYSTACK, 110, 84, [1, 2, 0]],
];

function stageIndexFor(distance) {
  let index = 0;
  for (let i = 0; i < STAGES.length; i += 1) {
    if (distance >= STAGES[i].from) index = i;
  }
  return index;
}

function speedFor(distance) {
  return Math.min(SPEED.max, SPEED.start + distance * SPEED.perMetre);
}

function spawnIntervalFor(distance) {
  return Math.max(
    SPAWN.minInterval,
    SPAWN.startInterval - distance * SPAWN.intervalPerMetre,
  );
}

export function createWorld(random) {
  const state = {
    time: 0,
    distance: 0,
    score: 0,
    pickupPoints: 0,
    lives: LIVES,
    pursuit: FARMER.start,
    speed: SPEED.start,
    stage: 0,
    stageBanner: 0,
    shake: 0,
    slowTimer: 0,
    hideCooldown: 0,
    nextFeatherAt: PICKUP.featherEveryMetres,
    pieSpawned: false,
    outcome: null,
    spotted: false,
    player: {
      x: TURKEY.x,
      y: FIELD.groundY - TURKEY.height,
      vy: 0,
      onGround: true,
      /** Jumps used in this airtime: 1 for the take-off, 2 after a double jump. */
      jumps: 0,
      sliding: 0,
      hiding: 0,
      hideStack: null,
      invulnerable: 0,
      runPhase: 0,
    },
    hazards: [],
    pickups: [],
    particles: [],
  };

  function reset() {
    state.time = 0;
    state.distance = 0;
    state.score = 0;
    state.pickupPoints = 0;
    state.lives = LIVES;
    state.pursuit = FARMER.start;
    state.speed = SPEED.start;
    state.stage = 0;
    state.stageBanner = 0;
    state.shake = 0;
    state.slowTimer = 0;
    state.hideCooldown = 0;
    state.nextFeatherAt = PICKUP.featherEveryMetres;
    state.pieSpawned = false;
    state.outcome = null;
    state.spotted = false;
    state.player.x = TURKEY.x;
    state.player.y = FIELD.groundY - TURKEY.height;
    state.player.vy = 0;
    state.player.onGround = true;
    state.player.jumps = 0;
    state.player.sliding = 0;
    state.player.hiding = 0;
    state.player.hideStack = null;
    state.player.invulnerable = 0;
    state.player.runPhase = 0;
    state.hazards.length = 0;
    state.pickups.length = 0;
    state.particles.length = 0;
  }

  /** Jump the world forward to a distance, for screenshot staging. */
  function warpTo(distance) {
    reset();
    state.distance = distance;
    state.stage = stageIndexFor(distance);
    state.speed = speedFor(distance);
    state.score = Math.floor(distance);
  }

  function burst(x, y, color, count, power) {
    for (let i = 0; i < count; i += 1) {
      state.particles.push({
        x,
        y,
        vx: random.range(-power, power),
        vy: random.range(-power * 1.4, -power * 0.2),
        life: random.range(0.4, 0.9),
        maxLife: 0.9,
        color,
        size: random.range(3, 7),
      });
    }
  }

  function playerBox() {
    const p = state.player;
    const height = p.sliding > 0 ? TURKEY.slideHeight : TURKEY.height;
    // The box follows the turkey's real top (p.y), so a jump really clears a
    // hazard: a box pinned to the ground would be hit mid-air.
    return {
      x: p.x + 8,
      y: p.sliding > 0 ? FIELD.groundY - height : p.y,
      width: TURKEY.width - 16,
      height,
    };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function hazardBox(hazard) {
    // Forgiving boxes: hazards bite a little less than they look.
    return {
      x: hazard.x + 8,
      y: hazard.y + 4,
      width: hazard.width - 16,
      height: hazard.height - 6,
    };
  }

  function pickHazardKind() {
    const stage = state.stage;
    let total = 0;
    for (const row of HAZARD_TABLE) total += row[3][stage];
    let roll = random.next() * total;
    for (const row of HAZARD_TABLE) {
      roll -= row[3][stage];
      if (roll <= 0) return row;
    }
    return HAZARD_TABLE[0];
  }

  let spawnTimer = 0.8;
  let cornTimer = 1.2;
  let pxSinceSpawn = 0;

  function spawnHazard() {
    const [kind, width, height] = pickHazardKind();
    const hazard = { kind, width, height, x: FIELD.width + 60, y: FIELD.groundY - height, vy: 0, landed: kind !== KIND_KNIFE_FALL, rest: 0 };
    if (kind === KIND_KNIFE_FALL) {
      hazard.y = -80;
      hazard.vy = 0;
      hazard.landX = FIELD.width + 120;
    }
    if (kind === KIND_KNIFE_FLY) {
      // Thrown at neck height: a standing turkey is clipped, a sliding one ducks under it.
      hazard.y = FIELD.groundY - 88;
    }
    if (kind === KIND_MUD) hazard.y = FIELD.groundY - height;
    state.hazards.push(hazard);
    pxSinceSpawn = 0;
  }

  function spawnCornArc() {
    // Three to five cobs in an arc that rewards a jump, above the ground.
    const count = random.int(3, 5);
    const baseX = FIELD.width + 80;
    const overHazard = random.next() < 0.45;
    for (let i = 0; i < count; i += 1) {
      const arc = Math.sin((i / (count - 1)) * Math.PI);
      state.pickups.push({
        kind: PICKUP_CORN,
        x: baseX + i * 46,
        y: FIELD.groundY - (overHazard ? 150 : 90) - arc * 46,
        taken: false,
      });
    }
  }

  function spawnFeather() {
    state.pickups.push({
      kind: PICKUP_FEATHER,
      x: FIELD.width + 80,
      y: FIELD.groundY - 190,
      taken: false,
    });
    state.nextFeatherAt += PICKUP.featherEveryMetres;
  }

  function spawnPie() {
    state.pickups.push({ kind: PICKUP_PIE, x: FIELD.width + 80, y: FIELD.groundY - 110, taken: false });
    state.pieSpawned = true;
  }

  function stumble(events) {
    const p = state.player;
    if (p.invulnerable > 0) return events;
    state.lives -= 1;
    state.pursuit = Math.min(1, state.pursuit + FARMER.hitGain);
    p.invulnerable = TURKEY.invulnerable;
    state.shake = 0.35;
    burst(p.x + TURKEY.width / 2, p.y + 30, '#e8a33c', 10, 260);
    burst(p.x + TURKEY.width / 2, p.y + 30, '#fff3d6', 6, 200);
    if (state.lives <= 0) {
      state.outcome = 'caught';
      return events | EVENT_HIT | EVENT_OVER;
    }
    return events | EVENT_HIT;
  }

  function step(dt, actions, titleMode) {
    let events = 0;
    const p = state.player;
    state.time += dt;

    // Timers always tick down.
    if (p.invulnerable > 0) p.invulnerable -= dt;
    if (p.sliding > 0) p.sliding -= dt;
    if (state.shake > 0) state.shake -= dt;
    if (state.slowTimer > 0) state.slowTimer -= dt;
    if (state.hideCooldown > 0) state.hideCooldown -= dt;
    if (state.stageBanner > 0) state.stageBanner -= dt;

    const effectiveSpeed = state.slowTimer > 0 ? state.speed * 0.5 : state.speed;
    p.runPhase += dt * (effectiveSpeed / 34);

    if (titleMode) {
      // Idle title animation: the turkey jogs in place, the farmer dozes far off.
      state.pursuit = FARMER.start;
      return events;
    }

    // --- Player actions ---
    const jumpPressed = (actions & 1) !== 0;
    const slidePressed = (actions & 2) !== 0;
    const hidePressed = (actions & 4) !== 0;

    if (jumpPressed && p.hiding <= 0) {
      if (p.onGround) {
        // Take-off.
        p.vy = -TURKEY.jumpSpeed;
        p.onGround = false;
        p.jumps = 1;
        p.sliding = 0;
      } else if (p.jumps < 2) {
        // Double jump: a second flap mid-air, for wide hazards and late timing.
        p.vy = -TURKEY.jumpSpeed * 0.85;
        p.jumps = 2;
        burst(p.x + TURKEY.width / 2, p.y + TURKEY.height, '#fff3d6', 5, 120);
      }
    }
    if (slidePressed && p.onGround && p.hiding <= 0) {
      p.sliding = TURKEY.slideTime;
    }
    if (hidePressed && p.hideCooldown <= 0 && p.hiding <= 0 && p.onGround) {
      for (const hazard of state.hazards) {
        if (hazard.kind === KIND_HAYSTACK && Math.abs(hazard.x - p.x) < 120) {
          p.hiding = TURKEY.hideTime;
          p.hideStack = hazard;
          p.hideCooldown = TURKEY.hideTime + 3;
          state.pursuit = Math.max(0, state.pursuit - 0.12);
          burst(p.x + 30, p.y + 20, '#d9b98a', 8, 120);
          break;
        }
      }
    }

    // --- Vertical physics ---
    if (!p.onGround) {
      p.vy += TURKEY.gravity * dt;
      p.y += p.vy * dt;
      if (p.y >= FIELD.groundY - TURKEY.height) {
        p.y = FIELD.groundY - TURKEY.height;
        p.vy = 0;
        p.onGround = true;
        p.jumps = 0;
      }
    }

    if (p.hiding > 0) {
      p.hiding -= dt;
      // The haystack carries the hidden turkey along with the world.
      if (p.hideStack) p.x = p.hideStack.x + 24;
      if (p.hiding <= 0) {
        p.x = TURKEY.x;
        p.hideStack = null;
      }
    }

    // --- Forward motion, pursuit, stages ---
    state.distance += (effectiveSpeed * dt) / 40;
    state.score = Math.floor(state.distance) + state.pickupPoints;
    state.speed = speedFor(state.distance);

    const wasSpotted = state.spotted;
    if (state.pursuit >= 0.7) state.spotted = true;
    else if (state.pursuit < 0.5) state.spotted = false;
    if (state.spotted && !wasSpotted) events |= EVENT_SPOTTED;

    // Clean running slowly wins ground back; the farmer never stops gaining.
    state.pursuit += (FARMER.gainPerSecond - FARMER.cleanRelief) * dt;
    state.pursuit = Math.max(0, Math.min(1, state.pursuit));
    if (state.pursuit >= FARMER.catchAt) {
      state.outcome = 'caught';
      return events | EVENT_OVER;
    }
    if (state.distance >= ESCAPE_DISTANCE) {
      state.outcome = 'escaped';
      return events | EVENT_OVER;
    }

    const newStage = stageIndexFor(state.distance);
    if (newStage !== state.stage) {
      state.stage = newStage;
      state.stageBanner = 2.2;
      events |= EVENT_STAGE;
    }

    // --- Spawning ---
    spawnTimer -= dt;
    pxSinceSpawn += effectiveSpeed * dt;
    if (spawnTimer <= 0 && pxSinceSpawn >= SPAWN.minGap) {
      spawnHazard();
      spawnTimer = spawnIntervalFor(state.distance) * random.range(0.85, 1.25);
    }
    cornTimer -= dt;
    if (cornTimer <= 0) {
      spawnCornArc();
      cornTimer = PICKUP.cornInterval * random.range(0.8, 1.3);
    }
    if (state.distance >= state.nextFeatherAt) spawnFeather();
    if (!state.pieSpawned && state.distance > 400 && state.distance < 800 && random.next() < 0.004) spawnPie();

    // --- Move hazards and pickups ---
    for (const hazard of state.hazards) {
      if (hazard.kind === KIND_KNIFE_FALL && !hazard.landed) {
        hazard.vy += 1800 * dt;
        hazard.y += hazard.vy * dt;
        hazard.x -= effectiveSpeed * dt * 0.4;
        if (hazard.y >= FIELD.groundY - hazard.height) {
          hazard.y = FIELD.groundY - hazard.height;
          hazard.landed = true;
          hazard.rest = 1.2;
          state.shake = Math.max(state.shake, 0.12);
        }
      } else if (hazard.kind === KIND_KNIFE_FLY) {
        hazard.x -= effectiveSpeed * dt * 1.45;
      } else if (hazard.landed) {
        hazard.x -= effectiveSpeed * dt;
        if (hazard.kind === KIND_KNIFE_FALL && hazard.rest > 0) hazard.rest -= dt;
      }
    }
    state.hazards = state.hazards.filter(
      (h) => h.x > -220 && !(h.kind === KIND_KNIFE_FALL && h.landed && h.rest <= 0),
    );
    for (const pickup of state.pickups) pickup.x -= effectiveSpeed * dt;
    state.pickups = state.pickups.filter((pk) => pk.x > -60 && !pk.taken);

    // --- Pickups ---
    if (p.hiding <= 0) {
      const box = playerBox();
      for (const pickup of state.pickups) {
        if (pickup.taken) continue;
        const pkBox = { x: pickup.x, y: pickup.y, width: 30, height: 30 };
        if (overlaps(box, pkBox)) {
          pickup.taken = true;
          if (pickup.kind === PICKUP_CORN) {
            state.pickupPoints += PICKUP.cornPoints;
            state.pursuit = Math.max(0, state.pursuit - PICKUP.cornRelief);
            burst(pickup.x, pickup.y, '#f2c94c', 6, 140);
            events |= EVENT_PICKUP;
          } else if (pickup.kind === PICKUP_FEATHER) {
            state.pickupPoints += PICKUP.featherPoints;
            state.pursuit = Math.max(0, state.pursuit - PICKUP.featherRelief);
            burst(pickup.x, pickup.y, '#ffd94d', 12, 200);
            events |= EVENT_PICKUP | EVENT_FEATHER;
          } else if (pickup.kind === PICKUP_PIE) {
            state.lives = Math.min(LIVES, state.lives + 1);
            burst(pickup.x, pickup.y, '#e5534b', 10, 180);
            events |= EVENT_PICKUP;
          }
        }
      }
    }

    // --- Hazard collisions ---
    if (p.hiding <= 0 && p.invulnerable <= 0) {
      const box = playerBox();
      for (const hazard of state.hazards) {
        if (hazard.kind === KIND_HAYSTACK) continue;
        if (hazard.kind === KIND_KNIFE_FALL && !hazard.landed) {
          // A falling knife can only clip the turkey mid-air; on the ground it
          // is a normal obstacle once it lands.
          if (!overlaps(box, hazardBox(hazard))) continue;
        }
        if (overlaps(box, hazardBox(hazard))) {
          if (hazard.kind === KIND_MUD) {
            state.slowTimer = 1.5;
            state.pursuit = Math.min(1, state.pursuit + 0.1);
            state.hazards.splice(state.hazards.indexOf(hazard), 1);
            events |= EVENT_SLOW;
          } else {
            events = stumble(events);
            state.hazards.splice(state.hazards.indexOf(hazard), 1);
          }
          break;
        }
      }
    }

    // --- Particles ---
    for (const particle of state.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 900 * dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);

    return events;
  }

  return { state, reset, step, warpTo, playerBox };
}
