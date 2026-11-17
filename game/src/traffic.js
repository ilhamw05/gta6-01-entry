// Traffic and pedestrians: the cars that drive the road network and the people on the
// sidewalks. Traffic cars follow lanes, stop for the car ahead, and turn at intersections;
// pedestrians stroll along sidewalks and run away from danger. All of it is seeded, so the
// same seed drives the same streets.
import { CAR, LANE, PED, ROADS_H, ROADS_V, ROAD_WIDTH, WORLD } from './config.js';
import { clamp, dist } from './world.js';

const TWO_PI = Math.PI * 2;

function angleDiff(a, b) {
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

function nearestRoad(value, roads) {
  let best = roads[0];
  let bestD = Infinity;
  for (const r of roads) {
    const d = Math.abs(value - r);
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

/** Advance one traffic car: lane following, turning at intersections, stopping behind traffic. */
export function stepTrafficCar(car, dt, world, random) {
  if (car.police || car.racer || car.escort || car.attacker) return;
  if (car === world.state.player.inCar) return;
  if (car.parked || car.hp <= 0) return;
  const speedTarget = car.cruise;
  // Stop for the car ahead on the same road and direction.
  let blocked = false;
  for (const other of world.state.cars) {
    if (other === car || other.hp <= 0) continue;
    if (other.roadAxis !== car.roadAxis || other.road !== car.road || other.dir !== car.dir) continue;
    const along = car.roadAxis === 'v' ? other.y - car.y : other.x - car.x;
    const across = car.roadAxis === 'v' ? Math.abs(other.x - car.x) : Math.abs(other.y - car.y);
    if (along * car.dir > 0 && along * car.dir < 86 && across < 40) { blocked = true; break; }
  }
  // Yield to any car (the player's included) right in front, whatever road it is on.
  if (!blocked) {
    const fx = car.x + Math.cos(car.angle) * 70;
    const fy = car.y + Math.sin(car.angle) * 70;
    for (const other of world.state.cars) {
      if (other === car || other.hp <= 0) continue;
      if (Math.hypot(other.x - fx, other.y - fy) < 55) { blocked = true; break; }
    }
  }
  if (blocked) {
    car.speed = Math.max(0, car.speed - 500 * dt);
  } else {
    car.speed += Math.sign(speedTarget - car.speed) * 220 * dt;
    car.speed = clamp(car.speed, 0, speedTarget);
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // At an intersection, sometimes turn onto the crossing road.
  const cross = car.roadAxis === 'v' ? ROADS_H : ROADS_V;
  for (const c of cross) {
    const along = car.roadAxis === 'v' ? car.y : car.x;
    if (Math.abs(along - c) < 4 && car.speed > 40 && random() < 0.012) {
      const turnLeft = random() < 0.5;
      const newDir = turnLeft ? -1 : 1;
      const newAxis = car.roadAxis === 'v' ? 'h' : 'v';
      const lane = newDir > 0 ? LANE : -LANE;
      car.roadAxis = newAxis;
      car.road = c;
      car.dir = newDir;
      if (newAxis === 'h') {
        car.y = c + lane;
        car.angle = newDir > 0 ? 0 : Math.PI;
      } else {
        car.x = c + lane;
        car.angle = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      break;
    }
  }
  // Wrap around the far edge so the streets never empty out.
  if (car.roadAxis === 'v') {
    if (car.y < -80) car.y = WORLD.height + 60;
    if (car.y > WORLD.height + 80) car.y = -60;
    car.x = car.road + (car.dir > 0 ? LANE : -LANE);
  } else {
    if (car.x < -80) car.x = WORLD.width + 60;
    if (car.x > WORLD.width + 80) car.x = -60;
    car.y = car.road + (car.dir > 0 ? LANE : -LANE);
  }
  // Nudge back onto the lane after a turn.
  const want = car.roadAxis === 'v'
    ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
    : (car.dir > 0 ? 0 : Math.PI);
  car.angle += angleDiff(car.angle, want) * Math.min(1, 6 * dt);
}

/** Advance one pedestrian: stroll the sidewalk, turn at intersections, flee from danger. */
export function stepPed(ped, dt, world, random) {
  if (ped.hp <= 0) return;
  // Dodge a fast car bearing down: step sideways off its path, not straight ahead of it.
  if (ped.flee <= 0) {
    for (const car of world.state.cars) {
      if (car.hp <= 0 || Math.abs(car.speed) < 60) continue;
      const d = dist(ped.x, ped.y, car.x, car.y);
      if (d < 150) {
        ped.flee = 1.2;
        const px = -Math.sin(car.angle);
        const py = Math.cos(car.angle);
        const side = (ped.x - car.x) * px + (ped.y - car.y) * py >= 0 ? 1 : -1;
        ped.fleeX = px * side;
        ped.fleeY = py * side;
        break;
      }
    }
  }
  if (ped.flee > 0) {
    ped.flee -= dt;
    const len = Math.hypot(ped.fleeX, ped.fleeY) || 1;
    ped.x += (ped.fleeX / len) * PED.fleeSpeed * dt;
    ped.y += (ped.fleeY / len) * PED.fleeSpeed * dt;
    ped.angle = Math.atan2(ped.fleeY, ped.fleeX);
  } else {
    ped.wander -= dt;
    if (ped.wander <= 0) {
      ped.wander = random() * 6 + 2;
      if (random() < 0.35) ped.dir *= -1;
    }
    const speed = ped.speed;
    if (ped.roadAxis === 'v') {
      ped.y += ped.dir * speed * dt;
      const cross = nearestRoad(ped.y, ROADS_H);
      if (Math.abs(ped.y - cross) < 3 && random() < 0.02) {
        ped.roadAxis = 'h';
        ped.road = cross;
        ped.y = cross + (random() < 0.5 ? -1 : 1) * (ROAD_WIDTH / 2 + 22);
      }
      if (ped.y < 80) ped.dir = 1;
      if (ped.y > WORLD.height - 80) ped.dir = -1;
    } else {
      ped.x += ped.dir * speed * dt;
      const cross = nearestRoad(ped.x, ROADS_V);
      if (Math.abs(ped.x - cross) < 3 && random() < 0.02) {
        ped.roadAxis = 'v';
        ped.road = cross;
        ped.x = cross + (random() < 0.5 ? -1 : 1) * (ROAD_WIDTH / 2 + 22);
      }
      if (ped.x < 80) ped.dir = 1;
      if (ped.x > WORLD.width - 80) ped.dir = -1;
    }
    ped.angle = ped.roadAxis === 'v' ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
  }
  ped.x = clamp(ped.x, 40, WORLD.width - 40);
  ped.y = clamp(ped.y, 40, WORLD.waterY - 20);
  // A scared pedestrian shouts and runs; a calm one just walks.
  const player = world.state.player;
  if (!player.inCar && ped.flee <= 0 && dist(ped.x, ped.y, player.x, player.y) < 120 && player.punchAnim > 0) {
    ped.flee = 2;
    ped.fleeX = ped.x - player.x;
    ped.fleeY = ped.y - player.y;
  }
}

/**
 * Car-vs-car and car-vs-pedestrian collisions for the whole street. Returns an event mask
 * (EVENT_CAR_HIT when the player's car is involved) and raises wanted heat for run-overs.
 */
export function stepCollisions(world, events) {
  const { state } = world;
  const cars = state.cars;
  for (const c of cars) c.hitTimer = Math.max(0, (c.hitTimer || 0) - 1 / 60);
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.hp <= 0) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.hp <= 0) continue;
      const d = dist(a.x, a.y, b.x, b.y);
      if (d >= CAR.radius * 2 || d === 0) continue;
      const push = (CAR.radius * 2 - d) / 2;
      const nx = (b.x - a.x) / d;
      const ny = (b.y - a.y) / d;
      // The player's car is heavy: traffic and police bounce off it instead of shoving it.
      const aWeight = a === state.player.inCar ? 0.1 : 1;
      const bWeight = b === state.player.inCar ? 0.1 : 1;
      if (!a.parked) { a.x -= nx * push * 2 * aWeight; a.y -= ny * push * 2 * aWeight; }
      if (!b.parked) { b.x += nx * push * 2 * bWeight; b.y += ny * push * 2 * bWeight; }
      const impact = Math.abs(a.speed - b.speed);
      if (impact > 150 && a.hitTimer <= 0 && b.hitTimer <= 0) {
        a.hitTimer = 0.5;
        b.hitTimer = 0.5;
        a.damage += 3;
        b.damage += 3;
        if (a === state.player.inCar || b === state.player.inCar) {
          world.addParticles((a.x + b.x) / 2, (a.y + b.y) / 2, '#ffd75e', 8, 180);
        }
      }
    }
  }
  // The player's car running a pedestrian over.
  const playerCar = state.player.inCar;
  if (playerCar && Math.abs(playerCar.speed) > 60) {
    for (const ped of state.peds) {
      if (ped.hp <= 0) continue;
      if (dist(playerCar.x, playerCar.y, ped.x, ped.y) < CAR.radius + PED.radius + 4) {
        ped.hp = 0;
        state.stats.pedsHit += 1;
        state.wantedHeat = Math.min(5, state.wantedHeat + 1);
        world.addParticles(ped.x, ped.y, '#ff5a4a', 12, 220);
        events |= 64; // EVENT_RUNOVER, handled by the caller as a crime.
      }
    }
  }
  return events;
}

export const EVENT_RUNOVER = 64;
