// The Port Solano police: patrol cars that hunt by wanted level, officers on foot near the
// action, and the arrest itself. Police presence scales with the stars; lose their sight
// and the heat cools (world.js does the cooling — this module only reports what they see).
import { AVENUES, CAR_MODELS, PLACES, STREETS, WORLD, BEACH_X } from './config.js';
import { carById, hurtPlayer, moveCar, resolveCircle, wantedStars } from './world.js';
import { driveToward } from './traffic.js';
import { chance, pick, range } from './random.js';

const POLICE_MODEL = 1; // Vista Sedan, painted dark
const POLICE_COLOR = '#22303e';
const SPAWN_EVERY = 1.1; // seconds between reinforcements
const SIGHT = 540;

function spawnPoliceCar(state) {
  const p = state.player;
  // Arrive on a road a few blocks away, on the side the player is heading toward.
  const vertical = chance(state.rng, 0.5);
  const centre = vertical ? pick(state.rng, AVENUES) : pick(state.rng, STREETS);
  const off = range(state.rng, 640, 860) * (chance(state.rng, 0.5) ? 1 : -1);
  let x;
  let y;
  if (vertical) { x = centre; y = Math.max(60, Math.min(WORLD.height - 60, p.y + off)); }
  else { x = Math.max(60, Math.min(BEACH_X - 80, p.x + off)); y = centre; }
  state.nextCarId += 1;
  const car = {
    id: state.nextCarId, model: POLICE_MODEL, x, y, angle: 0, speed: 0,
    color: POLICE_COLOR, hp: CAR_MODELS[POLICE_MODEL].hp + 40, maxHp: CAR_MODELS[POLICE_MODEL].hp + 40,
    driver: 'police', steerVis: 0, honkT: 0, dead: false, tag: 'police',
  };
  car.angle = Math.atan2(p.x - x, -(p.y - y));
  state.cars.push(car);
  return car;
}

function spawnFootCop(state, nearX, nearY) {
  state.nextPedId += 1;
  const spot = resolveCircle(state.city, nearX + range(state.rng, -40, 40), nearY + range(state.rng, -40, 40), 11);
  const cop = {
    id: state.nextPedId, x: spot.x, y: spot.y, angle: 0, hp: 90, down: false, downT: 0,
    fleeT: 0, cop: true, target: null, retargetT: 0, shirt: '#22303e', speed: 205,
    punchCd: 0,
  };
  state.peds.push(cop);
  return cop;
}

/** Step the whole police response for one tick. Sets state.seenByPolice and state.over. */
export function stepPolice(state, dt) {
  const p = state.player;
  const stars = wantedStars(state);
  state.spawnT = (state.spawnT ?? 0) - dt;
  state.bustT = state.bustT ?? 0;

  const policeCars = state.cars.filter((c) => c.driver === 'police');
  const footCops = state.peds.filter((pd) => pd.cop && !pd.down);

  // Reinforcements and stand-downs.
  const wantedCars = [0, 1, 2, 3, 4, 5][stars];
  if (!state.over && stars > 0 && policeCars.length < wantedCars && state.spawnT <= 0) {
    spawnPoliceCar(state);
    state.spawnT = SPAWN_EVERY;
  }
  if (stars >= 2 && p.carId === null && footCops.length < Math.min(3, stars) && state.spawnT <= 0) {
    spawnFootCop(state, p.x + range(state.rng, -300, 300), p.y + range(state.rng, -300, 300));
    state.spawnT = SPAWN_EVERY;
  }
  // Distant units give up when the heat is gone or they fall too far behind.
  for (const car of policeCars) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if ((stars === 0 && d > 420) || d > 1500) car.driver = 'parked';
  }
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    const cop = state.peds[i];
    if (cop.cop && !cop.post && (stars === 0 || Math.hypot(cop.x - p.x, cop.y - p.y) > 1200)) state.peds.splice(i, 1);
  }

  // Sight: any unit with a clear-ish line (distance only — buildings are low in Port Solano).
  let seen = false;
  for (const car of state.cars) {
    if (car.driver === 'police' && Math.hypot(car.x - p.x, car.y - p.y) < SIGHT) seen = true;
  }
  for (const cop of state.peds) {
    if (cop.cop && !cop.down && Math.hypot(cop.x - p.x, cop.y - p.y) < SIGHT * 0.7) seen = true;
  }
  state.seenByPolice = seen && stars > 0;

  if (state.over) return;

  // Cars hunt the player's position; on foot they box in and stop close.
  for (const car of state.cars) {
    if (car.driver !== 'police') continue;
    if (car.dead) { car.driver = 'parked'; continue; }
    const d = Math.hypot(p.x - car.x, p.y - car.y);
    let tx = p.x;
    let ty = p.y;
    if (p.carId !== null) {
      const playerCar = carById(state, p.carId);
      if (playerCar) { tx += Math.sin(playerCar.angle) * playerCar.speed * 0.45; ty += -Math.cos(playerCar.angle) * playerCar.speed * 0.45; }
    }
    // Stuck recovery: a unit wedged on a building reverses out before trying again.
    if (Math.abs(car.speed) < 25 && d > 90) car.stuckT = (car.stuckT ?? 0) + dt;
    else car.stuckT = 0;
    if (car.stuckT > 1.2) { car.stuckT = 0; car.reverseT = 0.7; }
    if ((car.reverseT ?? 0) > 0) {
      car.reverseT -= dt;
      const { steer } = driveToward(state, car, tx, ty, dt, 1.0);
      moveCar(state, car, -1, -steer, dt);
    } else if (p.carId === null && d < 130) {
      // Arrive and hold: aim at a point beside the player and ease off.
      const { steer } = driveToward(state, car, tx, ty, dt, 0.4);
      moveCar(state, car, d < 60 ? 0 : 0.35, steer, dt);
    } else {
      const { steer, throttle } = driveToward(state, car, tx, ty, dt, 1.0);
      moveCar(state, car, throttle, steer, dt);
    }
  }

  // Officers on foot run the player down and swing when close.
  let arresting = false;
  for (const cop of state.peds) {
    if (!cop.cop || cop.down) continue;
    if (cop.post && stars === 0) continue; // on post at the station while the city is calm
    const d = Math.hypot(p.x - cop.x, p.y - cop.y);
    if (cop.punchCd > 0) cop.punchCd -= dt;
    if (p.carId !== null) {
      // Step out of the road, officers are not suicidal.
      if (d < 90) {
        const a = Math.atan2(cop.x - p.x, -(cop.y - p.y));
        const spot = resolveCircle(state.city, cop.x + Math.sin(a) * 150 * dt, cop.y - Math.cos(a) * 150 * dt, 11);
        cop.x = spot.x; cop.y = spot.y;
      }
      continue;
    }
    if (d > 26) {
      const a = Math.atan2(p.x - cop.x, -(p.y - cop.y));
      cop.angle = a;
      const spot = resolveCircle(state.city, cop.x + Math.sin(a) * cop.speed * dt, cop.y - Math.cos(a) * cop.speed * dt, 11);
      cop.x = spot.x; cop.y = spot.y;
    } else {
      cop.angle = Math.atan2(p.x - cop.x, -(p.y - cop.y));
      if (cop.punchCd <= 0) {
        cop.punchCd = 0.7;
        hurtPlayer(state, 7, cop.x, cop.y);
      }
      if (p.hp > 0) arresting = true;
    }
  }

  // The arrest: on foot with an officer's hands on you for a held moment, you are caught.
  if (arresting && p.carId === null) {
    state.bustT += dt;
    if (state.bustT > 1.5) {
      state.over = 'busted';
      state.overT = 0;
      state.fx.push('busted');
    }
  } else {
    state.bustT = Math.max(0, state.bustT - dt * 2);
  }
}

/** Officers waiting at the station when the city is calm — set dressing for the plaza. */
export function seedStationCops(state) {
  spawnFootCop(state, PLACES.policeStation.x - 30, PLACES.policeStation.y + 10).post = true;
  spawnFootCop(state, PLACES.policeStation.x + 34, PLACES.policeStation.y - 14).post = true;
}
