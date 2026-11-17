// The screenshot scenes behind ?shot=start|play|mission|chase. Each one builds the real
// world from the seed and plays it forward with scripted drivers for a fixed number of
// steps, so the frame is honest gameplay and the same seed always gives the same frame.
import { PLACES, STEP } from './config.js';
import { makeCar, stepAmbient, stepPlayer } from './world.js';
import { driveToward, stepPeds, stepTraffic } from './traffic.js';
import { stepPolice } from './police.js';
import { stepMissions } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE = {
  direction: () => ({ x: 0, y: 0 }),
  drive: () => ({ throttle: 0, brake: 0, steer: 0, handbrake: false }),
  running: () => false,
  punchHeld: () => false,
};

/** A control that drives the player's car toward a point, reusing the traffic steering. */
function driveTo(state, tx, ty, aggression = 0.85) {
  return {
    direction: () => ({ x: 0, y: 0 }),
    drive: () => {
      const car = state.cars.find((c) => c.id === state.player.carId);
      if (!car) return { throttle: 0, brake: 0, steer: 0, handbrake: false };
      const { steer, throttle } = driveToward(state, car, tx, ty, STEP, aggression);
      return { throttle: Math.max(0, throttle), brake: throttle < 0 ? 1 : 0, steer, handbrake: false };
    },
    running: () => false,
    punchHeld: () => false,
  };
}

/** A control that walks the player toward a point. */
function walkTo(tx, ty) {
  let current = { x: 0, y: 0 };
  return {
    direction: () => current,
    drive: IDLE.drive,
    running: () => false,
    punchHeld: () => false,
    aim(from) {
      const dx = tx - from.x;
      const dy = ty - from.y;
      const d = Math.hypot(dx, dy) || 1;
      current = { x: Math.abs(dx / d) > 0.3 ? Math.sign(dx) : 0, y: Math.abs(dy / d) > 0.3 ? Math.sign(dy) : 0 };
      if (current.x === 0 && current.y === 0) current = { x: Math.sign(dx), y: 0 };
    },
  };
}

function stepScene(state, ctrl, seconds, { police = false, missions = false } = {}) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (ctrl.aim) ctrl.aim(state.player);
    stepPlayer(state, STEP, ctrl, 0);
    stepTraffic(state, STEP);
    if (police) stepPolice(state, STEP);
    stepPeds(state, STEP);
    if (missions) stepMissions(state, STEP, 0);
    stepAmbient(state, STEP);
    state.fx.length = 0;
  }
}

/** Keep stepping in short bursts until a pose condition holds (or the patience runs out). */
function stepUntil(state, ctrl, opts, cond, maxSeconds) {
  let t = 0;
  while (!cond() && t < maxSeconds) {
    stepScene(state, ctrl, 0.25, opts);
    t += 0.25;
  }
}

/** Put the player behind the wheel of a fresh car of their own, at a pose. */
function giveCar(state, model, x, y, angle, color) {
  const car = makeCar(state, model, x, y, angle, color);
  car.driver = 'player';
  car.speed = 0;
  state.cars.push(car);
  state.player.carId = car.id;
  state.player.x = x;
  state.player.y = y;
  return car;
}

/**
 * Stage the named scene in `state` (freshly created and seeded by main) and return the
 * screen to draw. Unknown names fall back to the title.
 */
export function stageShot(name, state) {
  if (name === 'play') {
    // Mid-drive on the beachfront avenue: the player in a Vista Sedan rolling south
    // past Harbor Park, traffic around, the city awake.
    const car = giveCar(state, 1, 3300, 250, Math.PI, '#33526e');
    car.speed = 280;
    // Clear the avenue corridor ahead: a staged drive needs an open road, not a queue.
    state.cars = state.cars.filter((c) => c === car || Math.abs(c.x - 3300) > 210 || c.y > 1350);
    const ctrl = driveTo(state, 3300, 1100);
    stepScene(state, ctrl, 2.4);
    stepUntil(state, ctrl, {}, () => Math.abs(car.speed) > 120, 2.5);
    state.heat = 0; // posed clean: an ordinary drive, no record
    return SCREEN_PLAY;
  }
  if (name === 'mission') {
    // Mara's first job, moments in: the talk is over, the package marker burns ahead.
    // The player is pinned at Mara's door and unhurtable while the talk plays out —
    // a standing pedestrian at that corner otherwise collects traffic.
    state.player.hp = 100000;
    for (let i = 0; i < 17; i += 1) {
      state.player.x = PLACES.playerStart.x;
      state.player.y = PLACES.playerStart.y;
      stepScene(state, IDLE, 0.5, { missions: true });
    }
    state.player.hp = 100;
    state.over = null;
    state.player.x = 470;
    state.player.y = 2440;
    stepScene(state, walkTo(PLACES.packageSpot.x, PLACES.packageSpot.y), 0.8, { missions: true });
    return SCREEN_PLAY;
  }
  if (name === 'chase') {
    // Three stars over the docks road: a golden coupe running north, the law behind it.
    const car = giveCar(state, 4, 2820, 2560, 0, '#d4a017');
    car.speed = 300;
    state.heat = 300;
    state.spawnT = 9999; // the two staged units are the whole response in this frame
    for (const [px, py] of [[2805, 2670], [2850, 2725]]) {
      const cop = makeCar(state, 1, px, py, 0, '#22303e');
      cop.driver = 'police';
      cop.tag = 'police';
      cop.hp += 40;
      cop.maxHp += 40;
      cop.speed = 360;
      state.cars.push(cop);
    }
    // A short, fixed burst: the coupe is faster than the law, so the frame is taken
    // while the pack is still close behind, before the gap opens.
    stepScene(state, driveTo(state, 2820, 700, 1), 1.1, { police: true });
    state.heat = 300; // the frame is a three-star chase, whatever the bumpers traded
    return SCREEN_PLAY;
  }
  // start: the city idles behind the title.
  stepScene(state, IDLE, 5);
  return SCREEN_TITLE;
}
