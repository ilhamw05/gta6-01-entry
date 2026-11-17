// Solano Vice — shared constants: the shape of Port Solano and the tuning of everything in it.
// Every module imports from here so the city the world builds is the city the renderer draws,
// the police patrol and the missions point at.

/** Fixed simulation step, in seconds. The loop never advances the world by any other amount. */
export const STEP = 1 / 60;

/** World size in pixels. Port Solano is a coastal grid: land runs west, the sea is the east edge. */
export const WORLD = { width: 4000, height: 3000 };

/** The sea starts here; between BEACH_X and SEA_X is sand, east of SEA_X is water. */
export const BEACH_X = 3548;
export const SEA_X = 3660;

/** Road centre-lines. Avenues run north–south, streets run east–west; roads are ROAD_W wide. */
export const AVENUES = [420, 1020, 1620, 2220, 2820, 3300];
export const STREETS = [420, 1080, 1740, 2400];
export const ROAD_W = 120;
/** Sidewalks ring every road: the band this wide on each side of the asphalt. */
export const SIDEWALK_W = 20;

/** The six districts, as rectangles tested in order; the first match names the ground. */
export const DISTRICTS = [
  { name: 'Harbor Park', x: 2820, y: 0, w: 728, h: 1080, ground: '#3f7a3a' },
  { name: 'North Suburbs', x: 0, y: 0, w: 1620, h: 1080, ground: '#4c8143' },
  { name: 'Beachfront', x: 3300, y: 0, w: 248, h: 2400, ground: '#578a48' },
  { name: 'Downtown', x: 1620, y: 420, w: 1200, h: 1980, ground: '#5b8a4c' },
  { name: 'Old Town', x: 0, y: 1740, w: 1620, h: 1260, ground: '#54824a' },
  { name: 'The Docks', x: 1620, y: 2400, w: 1928, h: 600, ground: '#6b7a52' },
  { name: 'Port Solano', x: 0, y: 0, w: 4000, h: 3000, ground: '#4c8143' },
];

/** Named places the story and the services use. All invented, all on sidewalks or open ground. */
export const PLACES = {
  maraOffice: { x: 2310, y: 990, label: "Mara's office" },
  policeStation: { x: 2500, y: 1470, label: 'Police station' },
  hospital: { x: 905, y: 2310, label: 'Hospital' },
  safehouse: { x: 2960, y: 560, label: 'Safehouse' },
  docksGarage: { x: 3120, y: 2745, label: 'Docks garage' },
  boat: { x: 3790, y: 2700, label: 'The boat' },
  packageSpot: { x: 330, y: 2530, label: 'Package' },
  coupeSpot: { x: 700, y: 690, label: 'Golden coupe' },
  raceStart: { x: 3300, y: 1290, label: 'Race start' },
  truckStart: { x: 2520, y: 2710, label: 'Cargo truck' },
  truckDest: { x: 1980, y: 1170, label: 'Depot' },
  playerStart: { x: 2320, y: 990, label: 'Start' },
};

/** Car models invented for Port Solano: name, size, pace, toughness and the colours they wear. */
export const CAR_MODELS = [
  { name: 'Kelpie Compact', w: 34, l: 58, top: 330, accel: 260, hp: 90, colors: ['#c94f42', '#4a7fb5', '#d9d9d9', '#5aa469'] },
  { name: 'Vista Sedan', w: 36, l: 66, top: 380, accel: 300, hp: 110, colors: ['#33526e', '#7a4a8c', '#b5bdc4', '#274156'] },
  { name: 'Bison Pickup', w: 38, l: 70, top: 350, accel: 270, hp: 150, colors: ['#8c5a2b', '#546e7a', '#77353a', '#3d5a45'] },
  { name: 'Tortuga Van', w: 38, l: 74, top: 320, accel: 230, hp: 160, colors: ['#cfd4d8', '#8795a1', '#b5893c', '#4f6157'] },
  { name: 'Marlin Coupe', w: 35, l: 64, top: 460, accel: 380, hp: 100, colors: ['#d4a017', '#a31f34', '#20242c', '#e8e8ec'] },
  { name: 'Osprey Roadster', w: 34, l: 60, top: 490, accel: 410, hp: 85, colors: ['#e07b2a', '#2a9d8f', '#e8e8ec', '#5a3d8c'] },
  { name: 'Hauler Truck', w: 42, l: 96, top: 300, accel: 200, hp: 260, colors: ['#7a4a21', '#5d6d7e'] },
];

/** The player on foot. */
export const FOOT = { radius: 11, walk: 155, run: 250, hp: 100, punchRange: 50, punchDamage: 34, punchCooldown: 0.38 };

/** Wanted tuning: heat is earned per crime, one star per HEAT_PER_STAR, and it cools when unseen. */
export const HEAT_PER_STAR = 100;
export const HEAT_MAX = 500;
export const HEAT = { steal: 60, hitPed: 120, hitCar: 25, punch: 30, missionCrime: 80 };
export const HEAT_COOL = 6; // per second while no police can see the player
export const HEAT_COOL_SEEN = 1.2; // per second while watched

/** In-game clock: one real second is one game minute; a day is 24 minutes at the keyboard. */
export const MINUTES_PER_SECOND = 1;
export const DAY_START = 10 * 60; // 10:00

/** localStorage key for the save game (cash, mission progress, position). */
export const SAVE_KEY = 'solano-vice-save-v1';

/** Viewport the game is composed for (the canvas scales to the window, this is the design size). */
export const VIEW = { width: 1280, height: 720 };
