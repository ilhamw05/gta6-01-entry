// Port Solano itself: the seeded city, the player, the cars and the pedestrians, and the
// rules that move them — no drawing and no sound here. The city is a road grid with named
// districts; every building, tree and parked car is placed by the seeded generator, so the
// same seed always builds the same streets.
import {
  CAR, CAR_MODELS, DISTRICTS, LANE, PALETTE, PED, PLAYER, ROADS_H, ROADS_V, ROAD_WIDTH, TRAFFIC, WORLD,
} from './config.js';
import { intRange, pick, range } from './random.js';

export const EVENT_PUNCH_HIT = 1;
export const EVENT_PED_DOWN = 2;
export const EVENT_CAR_HIT = 4;
export const EVENT_STEAL = 8;
export const EVENT_BUSTED = 16;
export const EVENT_WASTED = 32;

const TWO_PI = Math.PI * 2;

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

/** Build the city from a seed: buildings, trees, lamps, dock containers, cranes and landmarks. */
export function createCity(random) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const containers = [];
  const cranes = [];
  const colStarts = [60, ...ROADS_V.map((x) => x + ROAD_WIDTH / 2 + 14)];
  const rowStarts = [60, ...ROADS_H.map((y) => y + ROAD_WIDTH / 2 + 14)];
  const parkBlock = { col: 3, row: 3 };

  for (let col = 0; col < colStarts.length; col += 1) {
    for (let row = 0; row < rowStarts.length; row += 1) {
      const x0 = colStarts[col];
      const x1 = (col + 1 < colStarts.length ? ROADS_V[col] - ROAD_WIDTH / 2 : WORLD.width - 60) - 14;
      const y0 = rowStarts[row];
      const y1 = (row + 1 < rowStarts.length ? ROADS_H[row] - ROAD_WIDTH / 2 : WORLD.beachY - 14) - 14;
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 90 || h < 90) continue;
      // The docks corner (south-east) holds containers and cranes, not houses.
      if (x0 > 2800 && y0 > 2150) continue;
      // Harbor Park: lawn and trees, no buildings.
      if (col === parkBlock.col && row === parkBlock.row) {
        for (let t = 0; t < 26; t += 1) {
          trees.push({ x: range(random, x0 + 20, x1 - 20), y: range(random, y0 + 20, y1 - 20), r: range(random, 10, 18) });
        }
        continue;
      }
      const downtown = x0 > 1250 && x0 < 2500 && y0 < 800;
      const count = downtown ? intRange(random, 2, 4) : intRange(random, 1, 3);
      for (let b = 0; b < count; b += 1) {
        const bw = downtown ? range(random, 120, 210) : range(random, 90, 170);
        const bh = downtown ? range(random, 120, 200) : range(random, 80, 150);
        const bx = range(random, x0 + 8, Math.max(x0 + 9, x1 - bw - 8));
        const by = range(random, y0 + 8, Math.max(y0 + 9, y1 - bh - 8));
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: downtown && random() < 0.5 ? PALETTE.downtownGlass : pick(random, PALETTE.buildingRoof),
          tall: downtown,
        });
      }
      for (let t = 0; t < intRange(random, 1, 4); t += 1) {
        trees.push({ x: range(random, x0 + 16, x1 - 16), y: range(random, y0 + 16, y1 - 16), r: range(random, 8, 14) });
      }
    }
  }

  // Dock containers in neat rows, and two gantry cranes over the quay. No container may
  // sit on a road: the dock roads stay drivable.
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      if (random() < 0.22) continue;
      const cx = 3080 + col * 125;
      const cy = 2260 + row * 120;
      let onRoad = false;
      for (const rx of ROADS_V) if (cx + 105 > rx - 85 && cx < rx + 85) onRoad = true;
      for (const ry of ROADS_H) if (cy + 62 > ry - 85 && cy < ry + 85) onRoad = true;
      if (onRoad) continue;
      containers.push({
        x: cx, y: cy, w: 105, h: 62,
        color: pick(random, PALETTE.container),
      });
    }
  }
  cranes.push({ x: 3150, y: 2760 }, { x: 3650, y: 2760 });

  // Street lamps along every road, on both sides.
  for (const x of ROADS_V) {
    for (let y = 200; y < WORLD.beachY; y += 320) {
      lamps.push({ x: x - ROAD_WIDTH / 2 - 8, y });
      lamps.push({ x: x + ROAD_WIDTH / 2 + 8, y: y + 160 });
    }
  }
  for (const y of ROADS_H) {
    for (let x = 200; x < WORLD.width; x += 320) {
      lamps.push({ x, y: y - ROAD_WIDTH / 2 - 8 });
      lamps.push({ x: x + 160, y: y + ROAD_WIDTH / 2 + 8 });
    }
  }

  // Landmarks: the nearest building to each fixed point becomes that place.
  function nearestBuilding(px, py) {
    let best = null;
    let bestD = Infinity;
    for (const b of buildings) {
      const d = dist(px, py, b.x + b.w / 2, b.y + b.h / 2);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }
  const hospital = nearestBuilding(700, 1250);
  const policeStation = nearestBuilding(2500, 650);
  const maraOffice = nearestBuilding(1900, 650);
  const hideout = nearestBuilding(700, 2400);
  const boat = { x: 3620, y: 2845 };

  return {
    buildings, trees, lamps, containers, cranes,
    hospital, policeStation, maraOffice, hideout, boat,
    park: { x: colStarts[parkBlock.col], y: rowStarts[parkBlock.row], w: 460, h: 460 },
  };
}

export function createWorld(random) {
  const city = createCity(random);
  const state = {
    city,
    player: {
      x: 1600, y: 1550, angle: 0, vx: 0, vy: 0, hp: PLAYER.health,
      cash: 120, inCar: null, punchTimer: 0, punchAnim: 0, invuln: 0, moving: false,
    },
    cars: [],
    peds: [],
    particles: [],
    camera: { x: 0, y: 0 },
    clockHours: 8.0,
    elapsed: 0,
    wantedHeat: 0,
    wanted: 0,
    lastSeenTimer: 0,
    bustedTimer: 0,
    stats: { carsStolen: 0, pedsHit: 0, missionsDone: 0, cashEarned: 0 },
    flags: { busted: false, wasted: false, storyComplete: false },
  };

  function spawnCars() {
    for (let i = 0; i < TRAFFIC.cars; i += 1) {
      const vertical = random() < 0.5;
      const road = vertical ? pick(random, ROADS_V) : pick(random, ROADS_H);
      const along = range(random, 150, (vertical ? WORLD.height : WORLD.width) - 150);
      const dir = random() < 0.5 ? 1 : -1;
      const lane = (random() < 0.5 ? -LANE : LANE);
      const model = pick(random, CAR_MODELS);
      const parked = random() < 0.3;
      // Parked cars sit at the curb, off the driving lane, so they never block traffic.
      const lateral = parked ? (random() < 0.5 ? -1 : 1) * (ROAD_WIDTH / 2 + 16) : (dir > 0 ? lane : -lane);
      state.cars.push({
        id: i, x: vertical ? road + lateral : along,
        y: vertical ? along : road + lateral,
        angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
        speed: parked ? 0 : range(random, 130, 220),
        model, color: model.color, top: model.top,
        parked, traffic: !parked, police: false, racer: false, escort: false, attacker: false,
        gold: false, damage: 0, smoke: 0, hp: 100, driver: !parked,
        roadAxis: vertical ? 'v' : 'h', road, dir, targetAngle: 0,
        cruise: range(random, 130, 220), stopTimer: 0,
      });
    }
  }

  function spawnPeds() {
    for (let i = 0; i < TRAFFIC.peds; i += 1) {
      const vertical = random() < 0.5;
      const road = vertical ? pick(random, ROADS_V) : pick(random, ROADS_H);
      const along = range(random, 120, (vertical ? WORLD.height : WORLD.width) - 120);
      const off = (random() < 0.5 ? -1 : 1) * (ROAD_WIDTH / 2 + 22 + random() * 26);
      state.peds.push({
        x: vertical ? road + off : along,
        y: vertical ? along : road + off,
        angle: random() * TWO_PI, speed: range(random, 40, 85),
        hp: PED.health, shirt: pick(random, PALETTE.pedShirt),
        flee: 0, fleeX: 0, fleeY: 0, roadAxis: vertical ? 'v' : 'h', road, dir: random() < 0.5 ? 1 : -1,
        wander: range(random, 2, 8),
      });
    }
  }

  function reset() {
    state.cars.length = 0;
    state.peds.length = 0;
    state.particles.length = 0;
    spawnCars();
    spawnPeds();
    const p = state.player;
    p.x = 1600; p.y = 1550; p.angle = 0; p.vx = 0; p.vy = 0;
    p.hp = PLAYER.health; p.cash = 120; p.inCar = null;
    p.punchTimer = 0; p.punchAnim = 0; p.invuln = 0;
    state.clockHours = 8.0;
    state.elapsed = 0;
    state.wantedHeat = 0;
    state.wanted = 0;
    state.lastSeenTimer = 0;
    state.bustedTimer = 0;
    state.stats = { carsStolen: 0, pedsHit: 0, missionsDone: 0, cashEarned: 0 };
    state.flags = { busted: false, wasted: false, storyComplete: false };
    updateCamera();
  }

  function buildingHit(x, y, r) {
    for (const b of city.buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    for (const c of city.containers) {
      if (x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h) return c;
    }
    return null;
  }

  function resolveCircle(pos, r) {
    const hit = buildingHit(pos.x, pos.y, r);
    if (!hit) return false;
    const cx = clamp(pos.x, hit.x, hit.x + hit.w);
    const cy = clamp(pos.y, hit.y, hit.y + hit.h);
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const d = Math.hypot(dx, dy);
    if (d >= r || d === 0) {
      // Centre inside the box: push out along the smallest penetration axis.
      const left = pos.x - hit.x + r;
      const right = hit.x + hit.w - pos.x + r;
      const top = pos.y - hit.y + r;
      const bottom = hit.y + hit.h - pos.y + r;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = hit.x - r;
      else if (m === right) pos.x = hit.x + hit.w + r;
      else if (m === top) pos.y = hit.y - r;
      else pos.y = hit.y + hit.h + r;
      return true;
    }
    pos.x = cx + (dx / d) * r;
    pos.y = cy + (dy / d) * r;
    return true;
  }

  function inWater(x, y) {
    return y >= WORLD.waterY;
  }

  function addParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * TWO_PI;
      const s = range(random, speed * 0.3, speed);
      state.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: range(random, 0.25, 0.6), maxLife: 0.6, color, size: range(random, 2, 5),
      });
    }
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
  }

  /** Move the player on foot; returns events. `move` is {x, y} in -1..1, sprint a boolean. */
  function stepPlayer(dt, move, sprint, punch) {
    const p = state.player;
    let events = 0;
    if (p.punchTimer > 0) p.punchTimer -= dt;
    if (p.punchAnim > 0) p.punchAnim -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(move.x, move.y);
    p.moving = len > 0;
    if (len > 0) {
      const nx = move.x / len;
      const ny = move.y / len;
      p.vx += nx * PLAYER.accel * dt;
      p.vy += ny * PLAYER.accel * dt;
      p.angle = Math.atan2(ny, nx);
    } else {
      p.vx *= Math.max(0, 1 - 10 * dt);
      p.vy *= Math.max(0, 1 - 10 * dt);
    }
    const vlen = Math.hypot(p.vx, p.vy);
    if (vlen > speed) {
      p.vx = (p.vx / vlen) * speed;
      p.vy = (p.vy / vlen) * speed;
    }
    p.x += p.vx * dt;
    resolveCircle(p, PLAYER.radius);
    p.y += p.vy * dt;
    resolveCircle(p, PLAYER.radius);
    p.x = clamp(p.x, 30, WORLD.width - 30);
    if (inWater(p.x, p.y)) p.y = WORLD.waterY - PLAYER.radius - 1;
    p.y = clamp(p.y, 30, WORLD.waterY - PLAYER.radius - 1);

    if (punch && p.punchTimer <= 0) {
      p.punchTimer = PLAYER.punchCooldown;
      p.punchAnim = 0.22;
      for (const ped of state.peds) {
        if (ped.hp <= 0) continue;
        const d = dist(p.x, p.y, ped.x, ped.y);
        if (d > PLAYER.punchRange + PED.radius) continue;
        const a = Math.abs(angleDiff(p.angle, angleTo(p.x, p.y, ped.x, ped.y)));
        if (a > PLAYER.punchArc) continue;
        ped.hp -= PLAYER.punchDamage;
        ped.flee = 2.5;
        ped.fleeX = ped.x - p.x;
        ped.fleeY = ped.y - p.y;
        addParticles(ped.x, ped.y, '#ffd75e', 8, 160);
        events |= EVENT_PUNCH_HIT;
        if (ped.hp <= 0) events |= EVENT_PED_DOWN;
      }
      for (const car of state.cars) {
        if (!car.police || car.hp <= 0) continue;
        const d = dist(p.x, p.y, car.x, car.y);
        if (d > PLAYER.punchRange + CAR.radius) continue;
        car.hp -= PLAYER.punchDamage;
        car.damage += 12;
        addParticles(car.x, car.y, '#ffb84d', 6, 140);
        events |= EVENT_PUNCH_HIT;
      }
    }
    return events;
  }

  /** Drive the car the player sits in; returns events. */
  function stepDriving(dt, move, handbrake, horn) {
    const p = state.player;
    const car = p.inCar;
    if (!car) return 0;
    let events = 0;
    const forward = move.y < 0 ? 1 : move.y > 0 ? -1 : 0;
    const steer = move.x;
    if (forward > 0) car.speed += CAR.accel * dt;
    else if (forward < 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
    else car.speed *= Math.max(0, 1 - 0.9 * dt);
    if (handbrake) car.speed *= Math.max(0, 1 - 3.2 * dt);
    car.speed = clamp(car.speed, -CAR.maxReverse, car.top);
    const turn = steer * CAR.turnRate * (handbrake ? CAR.handbrakeTurn / CAR.turnRate : 1)
      * clamp(Math.abs(car.speed) / 160, 0, 1) * (car.speed < 0 ? -1 : 1);
    car.angle += turn * dt;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const before = { x: car.x, y: car.y };
    car.x = nx;
    car.y = ny;
    car.bumpTimer = Math.max(0, (car.bumpTimer || 0) - dt);
    const hitBuilding = resolveCircle(car, CAR.radius);
    if (hitBuilding && Math.abs(car.speed) > 120 && car.bumpTimer <= 0) {
      car.bumpTimer = 0.6;
      car.damage += 8;
      if (Math.abs(car.speed) > 200) car.hp -= 4;
      addParticles(car.x, car.y, '#c9c9c9', 10, 200);
      events |= EVENT_CAR_HIT;
    }
    if (hitBuilding) car.speed *= 0.4;
    car.x = clamp(car.x, 30, WORLD.width - 30);
    if (inWater(car.x, car.y)) { car.x = before.x; car.y = before.y; car.speed *= -0.3; }
    car.y = clamp(car.y, 30, WORLD.waterY - CAR.radius - 1);
    if (car.damage > 55) car.smoke = Math.min(1, (car.damage - 55) / 45);
    if (car.damage >= 100 || car.hp <= 0) {
      car.speed *= Math.max(0, 1 - 4 * dt);
      if (Math.abs(car.speed) < 5) car.speed = 0;
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (horn) addParticles(car.x + Math.cos(car.angle) * 40, car.y + Math.sin(car.angle) * 40, '#ffd75e', 2, 60);
    return events;
  }

  /** Enter the nearest car within reach; returns the car or null. */
  function tryEnterCar() {
    const p = state.player;
    if (p.inCar) return null;
    let best = null;
    let bestD = 78;
    for (const car of state.cars) {
      if (car.hp <= 0) continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (!best) return null;
    p.inCar = best;
    best.parked = false;
    best.traffic = false;
    // Taking a car that still has its driver counts as a theft and raises the heat.
    if (best.driver) {
      best.driver = false;
      state.stats.carsStolen += 1;
      state.wantedHeat = Math.min(WANTED.max, state.wantedHeat + 1);
    }
    return best;
  }

  function exitCar() {
    const p = state.player;
    const car = p.inCar;
    if (!car) return;
    p.inCar = null;
    const side = Math.cos(car.angle + Math.PI / 2);
    const sideY = Math.sin(car.angle + Math.PI / 2);
    p.x = clamp(car.x + side * 34, 30, WORLD.width - 30);
    p.y = clamp(car.y + sideY * 34, 30, WORLD.waterY - 20);
    resolveCircle(p, PLAYER.radius);
    p.vx = 0;
    p.vy = 0;
    if (car.speed < 30) car.speed = 0;
  }

  function updateCamera() {
    const p = state.player;
    const tx = clamp(p.x - 640, 0, WORLD.width - 1280);
    const ty = clamp(p.y - 360, 0, WORLD.waterY + 120 - 720);
    state.camera.x += (tx - state.camera.x) * 0.12;
    state.camera.y += (ty - state.camera.y) * 0.12;
  }

  function stepClock(dt) {
    state.elapsed += dt;
    state.clockHours = (8 + state.elapsed / 90) % 24;
  }

  /** 0 = night, 1 = full day. */
  function daylight() {
    const h = state.clockHours;
    if (h < 5.5 || h > 20.5) return 0.12;
    if (h < 7.5) return 0.12 + ((h - 5.5) / 2) * 0.88;
    if (h > 18.5) return 1 - ((h - 18.5) / 2) * 0.88;
    return 1;
  }

  reset();
  return {
    state, reset, stepPlayer, stepDriving, tryEnterCar, exitCar, updateCamera,
    stepClock, stepParticles, daylight, buildingHit, resolveCircle, addParticles,
    inWater, dist, angleTo, angleDiff, clamp,
  };
}
