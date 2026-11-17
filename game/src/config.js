// Solano Vice — every tuning number, colour and world constant in one place.
// Port Solano is a 4000x3000 coastal grid city. All names, districts and characters are
// original inventions for this game; nothing here comes from any existing franchise.

export const WORLD = { width: 4000, height: 3000, waterY: 2900, beachY: 2820 };

export const VIEW = { width: 1280, height: 720 };

/** Fixed simulation step: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** Vertical and horizontal road centre lines; roads are ROAD_WIDTH wide. */
export const ROADS_V = [400, 1000, 1600, 2200, 2800, 3400];
export const ROADS_H = [350, 950, 1550, 2150, 2650];
export const ROAD_WIDTH = 110;
export const LANE = 27;

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  sprintSpeed: 330,
  accel: 1500,
  health: 100,
  punchRange: 46,
  punchArc: 1.1,
  punchDamage: 34,
  punchCooldown: 0.38,
};

export const CAR = {
  length: 64,
  width: 30,
  radius: 24,
  accel: 340,
  brake: 620,
  reverseAccel: 220,
  maxSpeed: 560,
  maxReverse: 170,
  turnRate: 2.6,
  handbrakeTurn: 3.6,
  damagePerHit: 14,
};

export const WANTED = {
  max: 5,
  decayDelay: 9,
  decayStep: 14,
  policeCarPerStar: 1,
  maxPoliceCars: 6,
  spawnDistance: 620,
};

export const TRAFFIC = { cars: 26, peds: 42, pedSpeed: 62 };

export const PED = { radius: 11, health: 50, fleeSpeed: 190 };

export const MISSION_REWARDS = [300, 450, 500, 600, 650, 1000];

export const PALETTE = {
  backdrop: '#0d1117',
  grass: '#3d6b35',
  grassDark: '#33592d',
  park: '#4a7a3f',
  sand: '#c9b078',
  water: '#1d5f7a',
  waterDeep: '#144a61',
  road: '#2b2f36',
  roadEdge: '#3a3f47',
  lane: '#d8c95a',
  sidewalk: '#565b63',
  buildingRoof: ['#7a5a4a', '#5a6a7a', '#6a5a7a', '#4a6a5a', '#8a6a3a', '#5a5a6a'],
  buildingEdge: '#22262d',
  downtownGlass: '#3f6a8a',
  dockConcrete: '#6a6a62',
  container: ['#b8542e', '#2e7ab8', '#3f9a4a', '#c9a52e', '#8a3a5a'],
  tree: '#2e5a26',
  treeLight: '#3f7a33',
  player: '#e8b13c',
  playerDark: '#8a6a1a',
  pedShirt: ['#c94f4f', '#4f7ac9', '#4fc97a', '#c9a54f', '#9a4fc9', '#4fc9c9', '#e8e8e8'],
  police: '#2e4a8a',
  policeLight: '#d84a4a',
  gold: '#f2c94c',
  text: '#eef1f5',
  muted: '#9aa3b0',
  panel: 'rgba(16, 20, 28, 0.92)',
  hudBack: 'rgba(10, 14, 20, 0.62)',
  objective: '#ffd75e',
  danger: '#ff5a4a',
  ok: '#58d68a',
  night: 'rgba(8, 12, 40, 0.34)',
  dusk: 'rgba(40, 20, 60, 0.18)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where a run is kept between visits (this browser only). */
export const SAVE_KEY = 'solano-vice.save.v1';
export const BEST_KEY = 'solano-vice.best';

/** Fixed seed for the screenshot scenes, so every render shows the same frame. */
export const SHOT_SEED = 20261117;

/** Named car models, all invented for Port Solano. */
export const CAR_MODELS = [
  { name: 'Kelpie Compact', color: '#c94f4f', top: 520 },
  { name: 'Dune Runner', color: '#4f7ac9', top: 540 },
  { name: 'Harbor Taxi', color: '#e8c93c', top: 500 },
  { name: 'Vesper Sedan', color: '#8a8f96', top: 560 },
  { name: 'Cinder Pickup', color: '#3f9a4a', top: 480 },
  { name: 'Marlin Coupe', color: '#9a4fc9', top: 590 },
  { name: 'Tide Van', color: '#e8e8e8', top: 460 },
];

export const DISTRICTS = [
  { name: 'Downtown', x: 1300, y: 100, w: 1200, h: 700 },
  { name: 'The Docks', x: 3000, y: 2200, w: 950, h: 620 },
  { name: 'Beachfront', x: 100, y: 2700, w: 3800, h: 200 },
  { name: 'North Suburbs', x: 100, y: 100, w: 1100, h: 700 },
  { name: 'Old Town', x: 100, y: 1000, w: 1100, h: 1100 },
  { name: 'Harbor Park', x: 1750, y: 1700, w: 550, h: 550 },
];
