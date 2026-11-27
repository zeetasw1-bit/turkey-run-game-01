// Every tuning number and colour in one place. The playfield is a fixed 1280x720
// logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. Gobble Run: a turkey flees the farm, the barn and the
// kitchen, outrunning the farmer for 1000 metres to the forest gate.

export const FIELD = { width: 1280, height: 720, groundY: 620 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The finish line, in metres. Reach it and the turkey escapes. */
export const ESCAPE_DISTANCE = 1000;

export const TURKEY = {
  x: 250,
  width: 64,
  height: 78,
  slideHeight: 40,
  gravity: 3000,
  jumpSpeed: 1100,
  /** Seconds of mercy after a hit, during which nothing can hurt the turkey. */
  invulnerable: 1.6,
  /** Seconds a slide lasts once started. */
  slideTime: 0.55,
  /** Seconds the turkey can stay hidden in a haystack. */
  hideTime: 2.2,
};

export const LIVES = 3;

/** The farmer's pursuit meter, 0 (far behind) to 1 (he has you). */
export const FARMER = {
  start: 0.35,
  /** How fast he closes in while the turkey runs, per second. */
  gainPerSecond: 0.012,
  /** How much closer he gets when the turkey stumbles. */
  hitGain: 0.22,
  /** How much ground the turkey wins back per clean second at full speed. */
  cleanRelief: 0.02,
  /** He grabs the turkey at this meter value. */
  catchAt: 1,
};

export const SPEED = {
  start: 380,
  perMetre: 0.26,
  max: 660,
};

/** Spawning: seconds between hazards, shrinking as the run goes on. */
export const SPAWN = {
  startInterval: 1.45,
  minInterval: 0.7,
  intervalPerMetre: 0.00045,
  /** Minimum gap, in pixels, between two hazards so a jump is always possible. */
  minGap: 380,
};

export const PICKUP = {
  cornPoints: 10,
  featherPoints: 50,
  /** How much a corn cob distracts the farmer (he stops to peck at it). */
  cornRelief: 0.04,
  featherRelief: 0.16,
  cornInterval: 1.7,
  featherEveryMetres: 260,
};

/** The three stages of the escape, by distance in metres. */
export const STAGES = [
  { name: 'THE FARMYARD', from: 0, sky: ['#e89a3e', '#d97b29'], ground: '#8a6b3f', grass: '#7da05c' },
  { name: 'THE BARN', from: 300, sky: ['#e08e5a', '#b25a3c'], ground: '#6e4a2f', grass: '#8a7a4a' },
  { name: 'THE KITCHEN', from: 650, sky: ['#d97b4f', '#8f3b2e'], ground: '#7a4636', grass: '#a86a4a' },
];

/** Coherent autumn palette for the whole game. */
export const PALETTE = {
  backdrop: '#2b1d12',
  panel: '#241a10',
  panelEdge: '#f2c94c',
  text: '#fff3d6',
  muted: '#d9b98a',
  turkeyBody: '#7a4a26',
  turkeyBelly: '#a9713f',
  turkeyHead: '#e8d9c0',
  tail: ['#b5541e', '#d97b29', '#e8a33c', '#8f3b2e', '#c96a2e'],
  wattle: '#e5534b',
  beak: '#f2a93b',
  farmerShirt: '#4a6fa5',
  farmerOveralls: '#3b5a8a',
  farmerHat: '#e8c96a',
  farmerSkin: '#e8b98a',
  knifeBlade: '#dfe5ec',
  knifeHandle: '#5a3a22',
  ovenBody: '#4a4a52',
  ovenGlow: '#ff9a3c',
  corn: '#f2c94c',
  feather: '#ffd94d',
  heart: '#e5534b',
  heartEmpty: '#5a4632',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gobble-run.best';
