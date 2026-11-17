// Traffic and pedestrians: the everyday life of Port Solano. Traffic cars follow the road
// grid lane by lane (right-hand traffic), choosing turns at intersections; pedestrians
// stroll the sidewalks and run from danger. Both are stepped here; both move through the
// physics in world.js, so a traffic jam and a police chase obey the same rules.
import { AVENUES, BEACH_X, CAR_MODELS, ROAD_W, STREETS, WORLD } from './config.js';
import { carById, moveCar, resolveCircle, roadAt, spawnPed } from './world.js';
import { chance, int, pick, range } from './random.js';

const LANE = 30; // lane offset from a road centre-line, right-hand side
const ROAD_HALF = ROAD_W / 2;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Lane centre coordinate for a car travelling along an axis. dir: -1 north/west, +1 south/east. */
function laneCoord(axis, centre, dir) {
  // Facing north (-y) the right hand is +x; facing east (+x) the right hand is +y.
  if (axis === 'v') return centre + (dir < 0 ? LANE : -LANE);
  return centre + (dir > 0 ? LANE : -LANE);
}

/** Put a car on a road with a first waypoint. axis 'v' = avenue, 'h' = street. */
function placeOnRoad(car, axis, centre, dir, along) {
  car.axis = axis;
  car.centre = centre;
  car.dir = dir;
  if (axis === 'v') {
    car.x = laneCoord('v', centre, dir);
    car.y = along;
    car.angle = dir < 0 ? 0 : Math.PI;
  } else {
    car.x = along;
    car.y = laneCoord('h', centre, dir);
    car.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  car.speed = 0;
  chooseWaypoint(car, true);
}

/** The next decision point ahead: the nearest crossing centre-line in the direction of travel. */
function chooseWaypoint(car, first = false) {
  const crossings = car.axis === 'v' ? STREETS : AVENUES;
  const pos = car.axis === 'v' ? car.y : car.x;
  let best = null;
  for (const c of crossings) {
    const ahead = (c - pos) * car.dir;
    if (ahead > 30 && (best === null || ahead < best.ahead)) best = { centre: c, ahead };
  }
  const limit = car.axis === 'v' ? WORLD.height : BEACH_X + 30;
  const edge = car.dir > 0 ? limit + 80 : -80;
  if (best === null) {
    car.wp = car.axis === 'v' ? { x: car.x, y: edge } : { x: edge, y: car.y };
    car.wpEdge = true;
    return;
  }
  car.wpEdge = false;
  car.wp = car.axis === 'v'
    ? { x: laneCoord('v', car.centre, car.dir), y: best.centre }
    : { x: best.centre, y: laneCoord('h', car.centre, car.dir) };
  car.wpCrossing = best.centre;
}

/** At a crossing: go straight, or turn onto the crossing road in a random direction. */
function decideAtCrossing(state, car) {
  const rng = state.rng;
  const crossing = car.wpCrossing;
  const roll = rng();
  if (roll < 0.45) {
    chooseWaypoint(car);
    return;
  }
  const newDir = chance(rng, 0.5) ? 1 : -1;
  if (car.axis === 'v') {
    car.axis = 'h';
    car.centre = crossing;
    car.dir = newDir;
    car.wp = { x: car.x + newDir * 130, y: laneCoord('h', crossing, newDir) };
    car.wpCrossing = null;
    car.turning = true;
  } else {
    car.axis = 'v';
    car.centre = crossing;
    car.dir = newDir;
    car.wp = { x: laneCoord('v', crossing, newDir), y: car.y + newDir * 130 };
    car.wpCrossing = null;
    car.turning = true;
  }
}

/** Is something slow or stopped in front of this car? Returns 0 (clear) to 1 (bumper to bumper). */
function obstruction(state, car) {
  const fx = Math.sin(car.angle);
  const fy = -Math.cos(car.angle);
  let worst = 0;
  const check = (x, y, radius) => {
    const dx = x - car.x;
    const dy = y - car.y;
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(dx * fy - dy * fx);
    if (ahead > 0 && ahead < 85 && side < radius + 16) worst = Math.max(worst, 1 - ahead / 85);
  };
  for (const other of state.cars) {
    if (other !== car) check(other.x, other.y, CAR_MODELS[other.model].w / 2);
  }
  for (const ped of state.peds) if (!ped.down) check(ped.x, ped.y, 8);
  const p = state.player;
  if (p.carId === null) check(p.x, p.y, 10);
  return worst;
}

/** Steer a car toward a point; returns {steer, throttle} for moveCar. */
export function driveToward(state, car, tx, ty, dt, aggression = 0.8) {
  const want = Math.atan2(tx - car.x, -(ty - car.y));
  const diff = wrapAngle(want - car.angle);
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  const blocked = obstruction(state, car);
  let throttle = aggression;
  if (Math.abs(diff) > 1.1) throttle = 0.25;
  if (blocked > 0.55) throttle = -0.7;
  else if (blocked > 0.15) throttle = Math.min(throttle, 0.15);
  return { steer, throttle };
}

/** Seed the opening traffic: a spread of cars already rolling on the grid. */
export function seedTraffic(state) {
  const rng = state.rng;
  for (let i = 0; i < 15; i += 1) {
    const vertical = chance(rng, 0.55);
    const axis = vertical ? 'v' : 'h';
    const centre = vertical ? pick(rng, AVENUES) : pick(rng, STREETS);
    const dir = chance(rng, 0.5) ? 1 : -1;
    const along = vertical ? range(rng, 120, WORLD.height - 120) : range(rng, 120, BEACH_X - 120);
    const model = int(rng, 0, 5);
    const car = {
      id: 0, model, x: 0, y: 0, angle: 0, speed: 0,
      color: pick(rng, CAR_MODELS[model].colors), hp: CAR_MODELS[model].hp, maxHp: CAR_MODELS[model].hp,
      driver: 'traffic', steerVis: 0, honkT: 0, dead: false, tag: null,
    };
    state.nextCarId += 1;
    car.id = state.nextCarId;
    placeOnRoad(car, axis, centre, dir, along);
    car.speed = range(rng, 120, 200);
    // Keep the player's doorstep clear.
    if (Math.hypot(car.x - state.player.x, car.y - state.player.y) < 190) { car.y += 320; }
    state.cars.push(car);
  }
}

/** Step every traffic-driven car one tick. */
export function stepTraffic(state, dt) {
  const p = state.player;
  for (const car of state.cars) {
    if (car.driver !== 'traffic') continue;
    if (car.dead) {
      car.driver = 'parked';
      spawnPed(state, car.x + 26, car.y + 10, true);
      continue;
    }
    const dx = car.wp.x - car.x;
    const dy = car.wp.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 55) {
      if (car.wpEdge) {
        // Off the map edge: recycle far away from the player to keep the city populated.
        const far = Math.hypot(car.x - p.x, car.y - p.y) > 500;
        if (far) {
          const vertical = chance(state.rng, 0.5);
          placeOnRoad(car, vertical ? 'v' : 'h', vertical ? pick(state.rng, AVENUES) : pick(state.rng, STREETS),
            chance(state.rng, 0.5) ? 1 : -1, vertical ? range(state.rng, 200, WORLD.height - 200) : range(state.rng, 200, BEACH_X - 200));
          car.speed = 150;
        }
        continue;
      }
      if (car.turning) {
        car.turning = false;
        chooseWaypoint(car);
      } else {
        decideAtCrossing(state, car);
      }
      continue;
    }
    const { steer, throttle } = driveToward(state, car, car.wp.x, car.wp.y, dt, 0.72);
    moveCar(state, car, throttle, steer, dt);
    // A traffic car badly blocked for a while sounds its horn.
    if (throttle < 0 && car.speed < 10 && car.honkT <= 0) {
      car.honkT = range(state.rng, 2, 5);
      state.fx.push('horn');
    }
  }
  // Top the traffic up if cars were stolen or wrecked, spawning far from the player.
  const rolling = state.cars.filter((c) => c.driver === 'traffic').length;
  if (rolling < 11 && chance(state.rng, 0.01)) {
    const vertical = chance(state.rng, 0.55);
    const axis = vertical ? 'v' : 'h';
    const centre = vertical ? pick(state.rng, AVENUES) : pick(state.rng, STREETS);
    const dir = chance(state.rng, 0.5) ? 1 : -1;
    const along = vertical ? range(state.rng, 150, WORLD.height - 150) : range(state.rng, 150, BEACH_X - 150);
    const model = int(state.rng, 0, 5);
    const car = {
      id: 0, model, x: 0, y: 0, angle: 0, speed: 0,
      color: pick(state.rng, CAR_MODELS[model].colors), hp: CAR_MODELS[model].hp, maxHp: CAR_MODELS[model].hp,
      driver: 'traffic', steerVis: 0, honkT: 0, dead: false, tag: null,
    };
    state.nextCarId += 1;
    car.id = state.nextCarId;
    placeOnRoad(car, axis, centre, dir, along);
    if (Math.hypot(car.x - p.x, car.y - p.y) < 620) {
      car.driver = 'parked'; // too close to matter: leave it parked instead of popping in
    }
    state.cars.push(car);
  }
}

/** A random point on a sidewalk band, for pedestrian strolls. */
function sidewalkTarget(state) {
  const rng = state.rng;
  const vertical = chance(rng, 0.5);
  const centre = vertical ? pick(rng, AVENUES) : pick(rng, STREETS);
  const side = chance(rng, 0.5) ? 1 : -1;
  const off = ROAD_HALF + 10;
  if (vertical) {
    return { x: centre + side * off, y: range(rng, 60, WORLD.height - 60) };
  }
  return { x: range(rng, 60, BEACH_X - 40), y: centre + side * off };
}

/** Step the pedestrians: stroll, flee, and stay out of the morgue queue management. */
export function stepPeds(state, dt) {
  const p = state.player;
  // Keep a living crowd around the player.
  const alive = state.peds.filter((pd) => !pd.cop);
  if (alive.length < 24 && chance(state.rng, 0.05)) {
    const t = sidewalkTarget(state);
    if (Math.hypot(t.x - p.x, t.y - p.y) > 420) spawnPed(state, t.x, t.y);
  }
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    const ped = state.peds[i];
    if (ped.cop) continue; // the police module walks its own
    if (ped.down) {
      ped.downT += dt;
      if (ped.downT > 25) state.peds.splice(i, 1);
      continue;
    }
    if (Math.hypot(ped.x - p.x, ped.y - p.y) > 1500) { state.peds.splice(i, 1); continue; }
    // Danger sense: a fast car close by, or the player swinging nearby.
    let danger = null;
    for (const car of state.cars) {
      if (car.dead) continue;
      if (Math.abs(car.speed) > 130 && Math.hypot(car.x - ped.x, car.y - ped.y) < 95) { danger = car; break; }
    }
    if (danger || ped.fleeT > 0) {
      ped.fleeT = Math.max(0, ped.fleeT - dt);
      const from = danger ?? p;
      const a = Math.atan2(ped.x - from.x, -(ped.y - from.y));
      ped.angle = a;
      const nx = ped.x + Math.sin(a) * 175 * dt;
      const ny = ped.y - Math.cos(a) * 175 * dt;
      const spot = resolveCircle(state.city, nx, ny, 11);
      ped.x = spot.x;
      ped.y = spot.y;
      continue;
    }
    ped.retargetT -= dt;
    if (!ped.target || ped.retargetT <= 0 || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 18) {
      ped.target = sidewalkTarget(state);
      ped.retargetT = range(state.rng, 6, 14);
    }
    const a = Math.atan2(ped.target.x - ped.x, -(ped.target.y - ped.y));
    ped.angle = a;
    const nx = ped.x + Math.sin(a) * ped.speed * dt;
    const ny = ped.y - Math.cos(a) * ped.speed * dt;
    const spot = resolveCircle(state.city, nx, ny, 11);
    ped.x = spot.x;
    ped.y = spot.y;
  }
}

export { roadAt };
