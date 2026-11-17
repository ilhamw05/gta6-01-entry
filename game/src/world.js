// The world: Port Solano itself (streets, blocks, buildings, the pier) and the physics that
// moves the player and every car through it. The city is generated once from the seed, so the
// traffic module, the police and the missions all reason about the same streets.
//
// This module owns: city generation, the shared game state, the player on foot and in a car,
// car movement and collisions, crime heat, pickups and particles. Traffic AI, police AI and
// the mission script live in their own modules and drive cars through moveCar below.
import {
  AVENUES, BEACH_X, CAR_MODELS, DISTRICTS, FOOT, HEAT, HEAT_MAX, HEAT_PER_STAR, PLACES,
  ROAD_W, SEA_X, SIDEWALK_W, STEP, STREETS, WORLD, DAY_START,
} from './config.js';
import { chance, int, pick, range } from './random.js';

const ROAD_HALF = ROAD_W / 2;
const WALK_HALF = ROAD_HALF + SIDEWALK_W; // road + sidewalk span around a centre-line

/** The wooden pier at the docks: the one place feet and wheels may cross onto the water. */
export const PIER = { x: BEACH_X, y: 2648, w: 340, h: 104 };

/** Spots that must stay clear of buildings: mission stages, doors and spawn points. */
const CLEARINGS = [
  { x: PLACES.maraOffice.x, y: PLACES.maraOffice.y, r: 60 },
  { x: PLACES.policeStation.x, y: PLACES.policeStation.y, r: 130 },
  { x: PLACES.hospital.x, y: PLACES.hospital.y, r: 70 },
  { x: PLACES.safehouse.x, y: PLACES.safehouse.y, r: 70 },
  { x: PLACES.docksGarage.x, y: PLACES.docksGarage.y, r: 90 },
  { x: PLACES.packageSpot.x, y: PLACES.packageSpot.y, r: 60 },
  { x: PLACES.coupeSpot.x, y: PLACES.coupeSpot.y, r: 80 },
  { x: PLACES.truckStart.x, y: PLACES.truckStart.y, r: 100 },
  { x: PLACES.truckDest.x, y: PLACES.truckDest.y, r: 70 },
  { x: PLACES.playerStart.x, y: PLACES.playerStart.y, r: 60 },
];

const ROOFS = ['#8a4b3a', '#6e5a4e', '#7d6a58', '#94552f', '#5d6d7e', '#77685a', '#86594f'];
const WALLS = ['#cbb59a', '#b7a48c', '#d3c2ab', '#a89a86', '#c2b096'];

/** Free intervals along one axis: the spans between road+sidewalk bands and the world edges. */
function freeIntervals(centres, limit) {
  const out = [];
  let from = 0;
  for (const c of centres) {
    out.push([from, c - WALK_HALF]);
    from = c + WALK_HALF;
  }
  out.push([from, limit]);
  return out.filter(([a, b]) => b - a > 90);
}

function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[DISTRICTS.length - 1];
}

function nearClearing(x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return CLEARINGS.some((c) => Math.abs(cx - c.x) < c.r + w / 2 && Math.abs(cy - c.y) < c.r + h / 2);
}

/** Fill one city block with buildings or trees, in the style of its district. */
function fillBlock(rng, city, bx, by, bw, bh) {
  const district = districtAt(bx + bw / 2, by + bh / 2);
  const inset = 16;
  const x0 = bx + inset;
  const y0 = by + inset;
  const w = bw - inset * 2;
  const h = bh - inset * 2;
  if (w < 60 || h < 60) return;
  const addBuilding = (x, y, bw2, bh2, kind) => {
    if (nearClearing(x, y, bw2, bh2)) return;
    city.buildings.push({
      x, y, w: bw2, h: bh2, kind,
      roof: pick(rng, ROOFS), wall: pick(rng, WALLS),
      floors: kind === 'tower' ? int(rng, 6, 14) : int(rng, 1, 4),
    });
  };
  if (district.name === 'Harbor Park') {
    for (let i = 0; i < 26; i += 1) {
      city.trees.push({ x: range(rng, x0, x0 + w), y: range(rng, y0, y0 + h), r: range(rng, 13, 22) });
    }
    return;
  }
  if (district.name === 'The Docks') {
    addBuilding(x0, y0, w * 0.62, h * 0.4, 'warehouse');
    addBuilding(x0, y0 + h * 0.55, w * 0.45, h * 0.38, 'warehouse');
    for (let i = 0; i < 7; i += 1) {
      city.crates.push({ x: range(rng, x0 + w * 0.55, x0 + w - 26), y: range(rng, y0, y0 + h - 26), s: range(rng, 18, 28) });
    }
    return;
  }
  if (district.name === 'North Suburbs') {
    const cols = Math.max(2, Math.floor(w / 130));
    const rows = Math.max(2, Math.floor(h / 120));
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        if (chance(rng, 0.18)) continue;
        addBuilding(x0 + (cx * w) / cols + 14, y0 + (cy * h) / rows + 14, w / cols - 34, h / rows - 36, 'house');
      }
    }
    for (let i = 0; i < 4; i += 1) city.trees.push({ x: range(rng, x0, x0 + w), y: range(rng, y0, y0 + h), r: range(rng, 10, 16) });
    return;
  }
  if (district.name === 'Downtown') {
    const cols = bw > 300 ? 2 : 1;
    const rows = bh > 300 ? 2 : 1;
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        addBuilding(x0 + (cx * w) / cols + 10, y0 + (cy * h) / rows + 10, w / cols - 22, h / rows - 22, 'tower');
      }
    }
    return;
  }
  // Old Town, Beachfront and anywhere else: mid-size buildings on a jittered 2×2 grid,
  // one per cell at most, so neighbours never overlap.
  for (let cx = 0; cx < 2; cx += 1) {
    for (let cy = 0; cy < 2; cy += 1) {
      if (chance(rng, 0.22)) continue;
      const cellW = w / 2;
      const cellH = h / 2;
      addBuilding(
        x0 + cx * cellW + range(rng, 4, Math.max(6, cellW - 150)),
        y0 + cy * cellH + range(rng, 4, Math.max(6, cellH - 140)),
        range(rng, 90, Math.min(150, cellW - 14)),
        range(rng, 80, Math.min(140, cellH - 14)),
        'block',
      );
    }
  }
}

/** Generate the whole city: blocks, buildings, trees, lamps, the special service buildings. */
export function buildCity(rng) {
  const city = { buildings: [], trees: [], crates: [], lamps: [] };
  const xs = freeIntervals(AVENUES, BEACH_X);
  const ys = freeIntervals(STREETS, WORLD.height);
  for (const [x0, x1] of xs) {
    for (const [y0, y1] of ys) fillBlock(rng, city, x0, y0, x1 - x0, y1 - y0);
  }
  // The two service buildings the story leans on, placed by hand in their plazas.
  city.buildings.push({ x: 2380, y: 1240, w: 240, h: 140, kind: 'station', roof: '#33526e', wall: '#9fb4c4', floors: 3, label: 'POLICE' });
  city.buildings.push({ x: 580, y: 1900, w: 250, h: 160, kind: 'hospital', roof: '#b8452f', wall: '#e8e2d6', floors: 4, label: 'HOSPITAL' });
  city.buildings.push({ x: 2960, y: 2560, w: 300, h: 130, kind: 'warehouse', roof: '#5d6d7e', wall: '#a89a86', floors: 1, label: 'GARAGE' });
  // Lamp posts at every intersection corner.
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      city.lamps.push({ x: ax - WALK_HALF - 6, y: sy - WALK_HALF - 6 }, { x: ax + WALK_HALF + 6, y: sy + WALK_HALF + 6 });
    }
  }
  return city;
}

/** Is this point on asphalt? Returns the road it belongs to, or null. */
export function roadAt(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_HALF && y >= 0 && y <= WORLD.height) return { kind: 'avenue', centre: ax };
  for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_HALF && x >= 0 && x <= BEACH_X + 40) return { kind: 'street', centre: sy };
  return null;
}

/** Is this point on a sidewalk band (where pedestrians prefer to walk)? */
export function onSidewalk(x, y) {
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d > ROAD_HALF && d <= WALK_HALF && y >= 0 && y <= WORLD.height) return true;
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d > ROAD_HALF && d <= WALK_HALF && x >= 0 && x <= BEACH_X + 40) return true;
  }
  return false;
}

function circleVsBuildings(city, x, y, r) {
  let hit = null;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < r * r) { hit = { nx, ny, dx, dy, b }; break; }
  }
  return hit;
}

/**
 * Push a circle at (x, y) out of every building and back inside the world (and out of the
 * sea, unless it is over the pier). Returns the corrected position.
 */
export function resolveCircle(city, x, y, r) {
  for (let pass = 0; pass < 2; pass += 1) {
    const hit = circleVsBuildings(city, x, y, r);
    if (!hit) break;
    if (hit.dx === 0 && hit.dy === 0) {
      // Centre inside the rect: leave by the nearest face.
      const left = x - hit.b.x;
      const right = hit.b.x + hit.b.w - x;
      const top = y - hit.b.y;
      const bottom = hit.b.y + hit.b.h - y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x = hit.b.x - r;
      else if (m === right) x = hit.b.x + hit.b.w + r;
      else if (m === top) y = hit.b.y - r;
      else y = hit.b.y + hit.b.h + r;
    } else {
      const d = Math.hypot(hit.dx, hit.dy) || 1;
      x = hit.nx + (hit.dx / d) * r;
      y = hit.ny + (hit.dy / d) * r;
    }
  }
  x = Math.max(r, Math.min(x, WORLD.width - r));
  y = Math.max(r, Math.min(y, WORLD.height - r));
  const onPier = x >= PIER.x && x <= PIER.x + PIER.w && y >= PIER.y && y <= PIER.y + PIER.h;
  if (x > SEA_X - r && !onPier) x = SEA_X - r;
  return { x, y };
}

/** A fresh car of the given model index, standing at a pose. Ids are handed out by the state. */
export function makeCar(state, modelIndex, x, y, angle, color) {
  const model = CAR_MODELS[modelIndex];
  state.nextCarId += 1;
  return {
    id: state.nextCarId, model: modelIndex, x, y, angle, speed: 0,
    color: color ?? model.colors[0], hp: model.hp, maxHp: model.hp,
    driver: 'parked', // parked | traffic | player | police | mission
    steerVis: 0, honkT: 0, dead: false, tag: null,
  };
}

/** Create the full game state around a generated city. */
export function createWorld(rng) {
  const city = buildCity(rng);
  const state = {
    rng,
    city,
    time: 0,
    clock: DAY_START,
    player: {
      x: PLACES.playerStart.x, y: PLACES.playerStart.y, angle: -Math.PI / 2,
      hp: FOOT.hp, cash: 120, carId: null, punchCd: 0, hurtT: 0,
    },
    cars: [],
    peds: [],
    nextCarId: 0,
    nextPedId: 0,
    heat: 0,
    seenByPolice: false,
    seenT: 0,
    over: null, // null | 'wasted' | 'busted'
    overT: 0,
    pickups: [],
    particles: [],
    fx: [], // one-step event names for sound and announcements, drained by main
    shake: 0,
    storyDone: false,
  };
  // The golden coupe the second mission is about, parked in the North Suburbs.
  const coupe = makeCar(state, 4, PLACES.coupeSpot.x, PLACES.coupeSpot.y, Math.PI / 2, '#d4a017');
  coupe.tag = 'coupe';
  state.cars.push(coupe);
  // A scatter of parked cars on block edges and parking bays.
  for (let i = 0; i < 34; i += 1) {
    const ax = pick(rng, AVENUES);
    const sy = pick(rng, STREETS);
    const side = chance(rng, 0.5) ? 1 : -1;
    const along = range(rng, -900, 900);
    const vertical = chance(rng, 0.5);
    const x = vertical ? ax + side * (ROAD_HALF + 26) : ax + along * 0.4;
    const y = vertical ? sy + along : sy + side * (ROAD_HALF + 26);
    if (x < 40 || x > BEACH_X - 30 || y < 40 || y > WORLD.height - 40) continue;
    if (circleVsBuildings(city, x, y, 30)) continue;
    const car = makeCar(state, int(rng, 0, 5), x, y, vertical ? 0 : Math.PI / 2);
    car.color = pick(rng, CAR_MODELS[car.model].colors);
    state.cars.push(car);
  }
  return state;
}

export function carById(state, id) {
  return state.cars.find((c) => c.id === id) ?? null;
}

/** Current wanted stars, 0–5, derived from heat. */
export function wantedStars(state) {
  if (state.heat <= 0) return 0;
  return Math.min(5, Math.ceil(state.heat / HEAT_PER_STAR));
}

/** Commit a crime: add heat (witness rules are the caller's simplification) and note the fx. */
export function commitCrime(state, amount) {
  state.heat = Math.min(HEAT_MAX, state.heat + amount);
}

/** Anyone close enough to see a crime at (x, y): a pedestrian or any police presence. */
export function witnessedBy(state, x, y, radius = 300) {
  for (const p of state.peds) {
    if (!p.down && Math.hypot(p.x - x, p.y - y) < radius) return true;
  }
  for (const c of state.cars) {
    if (c.driver === 'police' && Math.hypot(c.x - x, c.y - y) < radius + 60) return true;
  }
  return false;
}

function spawnParticles(state, x, y, n, color, speed, life) {
  for (let i = 0; i < n; i += 1) {
    const a = state.rng() * Math.PI * 2;
    const s = speed * (0.3 + state.rng() * 0.7);
    state.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: life * (0.5 + state.rng() * 0.5), maxLife: life, color,
      size: 2 + state.rng() * 3,
    });
  }
}

/**
 * Drive one car for a step: throttle -1..1, steer -1..1. Handles acceleration, steering,
 * building and car collisions, damage and running over pedestrians (a crime). The traffic,
 * police, mission and player drivers all move through here.
 */
export function moveCar(state, car, throttle, steer, dt, opts = {}) {
  if (car.dead) return;
  const model = CAR_MODELS[car.model];
  const onSand = car.x > BEACH_X - 10;
  const topSpeed = model.top * (onSand ? 0.45 : 1) * (car.hp < model.hp * 0.3 ? 0.6 : 1);
  if (throttle > 0) car.speed += model.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 8) car.speed -= model.accel * 1.6 * dt; // braking
    else car.speed -= model.accel * 0.45 * dt; // reverse
  }
  const drag = car.speed * (opts.handbrake ? 1.4 : 0.45) * dt;
  car.speed -= drag;
  car.speed = Math.max(-topSpeed * 0.35, Math.min(topSpeed, car.speed));
  if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 90) * (opts.handbrake ? 1.7 : 1);
  car.angle += steer * 1.9 * steerAuthority * dt * (car.speed < 0 ? -1 : 1);
  car.steerVis = steer;
  const vx = Math.sin(car.angle) * car.speed;
  const vy = -Math.cos(car.angle) * car.speed;
  let nx = car.x + vx * dt;
  let ny = car.y + vy * dt;
  // Buildings: stop hard and take damage.
  const r = model.w / 2 + 8;
  const before = { x: nx, y: ny };
  const resolved = resolveCircle(state.city, nx, ny, r);
  if ((resolved.x !== before.x || resolved.y !== before.y) && Math.abs(car.speed) > 120) {
    const dmg = Math.min(30, Math.abs(car.speed) * 0.06);
    damageCar(state, car, dmg, car.x, car.y);
    car.speed *= -0.25;
    state.fx.push('crash');
    if (car.driver === 'player') state.shake = Math.min(10, Math.abs(car.speed) * 0.02 + 4);
  } else if (resolved.x !== before.x || resolved.y !== before.y) {
    car.speed *= 0.6;
  }
  nx = resolved.x;
  ny = resolved.y;
  // Other cars: a shove and shared damage.
  for (const other of state.cars) {
    if (other === car || other.dead) continue;
    const dx = nx - other.x;
    const dy = ny - other.y;
    const rr = r + CAR_MODELS[other.model].w / 2 + 8;
    const d2 = dx * dx + dy * dy;
    if (d2 < rr * rr && d2 > 0.01) {
      const d = Math.sqrt(d2);
      nx = other.x + (dx / d) * rr;
      ny = other.y + (dy / d) * rr;
      const impact = Math.abs(car.speed - other.speed);
      if (impact > 90) {
        damageCar(state, car, impact * 0.05, car.x, car.y);
        damageCar(state, other, impact * 0.05, other.x, other.y);
        state.fx.push('crash');
        if (car.driver === 'player' || other.driver === 'player') {
          commitCrime(state, HEAT.hitCar);
          state.shake = Math.min(10, impact * 0.03);
        }
      }
      car.speed *= 0.55;
      other.speed *= 0.7;
    }
  }
  car.x = nx;
  car.y = ny;
  // Pedestrians in the path of a moving car go down; if it is the player's car, it is a crime.
  if (Math.abs(car.speed) > 55) {
    for (const ped of state.peds) {
      if (ped.down) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < r + 8) {
        knockDownPed(state, ped, car.speed);
        if (car.driver === 'player') {
          commitCrime(state, HEAT.hitPed);
          state.fx.push('hitped');
          state.shake = Math.min(8, 5);
        }
      }
    }
  }
  // The player on foot can be run down too (by anyone but themselves).
  const p = state.player;
  if (p.carId === null && car.driver !== 'player' && Math.abs(car.speed) > 70) {
    if (Math.hypot(p.x - car.x, p.y - car.y) < r + 10) {
      hurtPlayer(state, Math.min(40, Math.abs(car.speed) * 0.12), car.x, car.y);
    }
  }
  if (car.honkT > 0) car.honkT -= dt;
}

export function damageCar(state, car, amount, x, y) {
  if (car.dead) return;
  car.hp -= amount;
  spawnParticles(state, x, y, 4, '#ffb347', 60, 0.35);
  if (car.hp <= 0) {
    car.hp = 0;
    car.dead = true;
    car.speed = 0;
    spawnParticles(state, x, y, 18, '#555c66', 40, 1.4);
    state.fx.push('cardestroyed');
  }
}

/** A pedestrian goes down (from a punch or a car). They stay down; the city replaces them later. */
export function knockDownPed(state, ped, force = 60) {
  if (ped.down) return;
  ped.down = true;
  ped.hp = 0;
  ped.downT = 0;
  spawnParticles(state, ped.x, ped.y, 5, '#c94f42', force * 0.6, 0.4);
}

/** Damage the player, with knockback away from (fromX, fromY). Death is resolved by main. */
export function hurtPlayer(state, amount, fromX, fromY) {
  const p = state.player;
  if (state.over) return;
  p.hp -= amount;
  p.hurtT = 0.25;
  const d = Math.hypot(p.x - fromX, p.y - fromY) || 1;
  if (p.carId === null) {
    const pushed = resolveCircle(state.city, p.x + ((p.x - fromX) / d) * 16, p.y + ((p.y - fromY) / d) * 16, FOOT.radius);
    p.x = pushed.x;
    p.y = pushed.y;
  }
  state.fx.push('hurt');
  if (p.hp <= 0) {
    p.hp = 0;
    state.over = 'wasted';
    state.overT = 0;
    state.fx.push('wasted');
  }
}

/** The nearest car the player could get into (or the one they are in). */
export function nearestCar(state, maxDist = 52) {
  const p = state.player;
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/**
 * Step the player: on foot (walk, run, punch, pick things up) or behind the wheel (drive the
 * car they are in). `ctrl` is the input object from input.js; actions are its action bits.
 */
export function stepPlayer(state, dt, ctrl, actions) {
  const p = state.player;
  if (state.over) return;
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.hurtT > 0) p.hurtT -= dt;

  if (p.carId !== null) {
    const car = carById(state, p.carId);
    if (!car || car.dead) {
      p.carId = null;
    } else {
      const drive = ctrl.drive();
      // One signed throttle for moveCar: forward pedal, else the brake/reverse pedal.
      const signed = drive.throttle > 0 ? drive.throttle : -drive.brake;
      moveCar(state, car, signed, drive.steer, dt, { handbrake: drive.handbrake });
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      if (actions & 4) { // ACTION_ENTER: get out
        const side = { x: p.x + Math.cos(car.angle) * 30, y: p.y + Math.sin(car.angle) * 30 };
        const spot = resolveCircle(state.city, side.x, side.y, FOOT.radius);
        p.x = spot.x;
        p.y = spot.y;
        car.driver = car.wasStolen ? 'parked' : car.driver;
        if (car.driver === 'player') car.driver = 'parked';
        p.carId = null;
        state.fx.push('exit');
      }
      return;
    }
  }

  // On foot.
  const dir = ctrl.direction();
  const moving = dir.x !== 0 || dir.y !== 0;
  if (moving) {
    const len = Math.hypot(dir.x, dir.y);
    const speed = ctrl.running() ? FOOT.run : FOOT.walk;
    p.angle = Math.atan2(dir.x / len, -(dir.y / len));
    const nx = p.x + (dir.x / len) * speed * dt;
    const ny = p.y + (dir.y / len) * speed * dt;
    const resolved = resolveCircle(state.city, nx, ny, FOOT.radius);
    p.x = resolved.x;
    p.y = resolved.y;
  }
  // Punch: a short arc in front, against pedestrians and foot police alike.
  if (ctrl.punchHeld() && p.punchCd <= 0) {
    p.punchCd = FOOT.punchCooldown;
    state.fx.push('punch');
    const fx = Math.sin(p.angle);
    const fy = -Math.cos(p.angle);
    for (const ped of state.peds) {
      if (ped.down) continue;
      const dx = ped.x - p.x;
      const dy = ped.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < FOOT.punchRange && (d < 14 || (dx * fx + dy * fy) / (d || 1) > 0.35)) {
        ped.hp -= FOOT.punchDamage;
        spawnParticles(state, ped.x, ped.y, 3, '#ffd166', 50, 0.3);
        state.fx.push('punchhit');
        if (ped.hp <= 0) knockDownPed(state, ped);
        else ped.fleeT = 2.5;
        if (witnessedBy(state, p.x, p.y)) commitCrime(state, HEAT.punch);
      }
    }
  }
  // Getting into a car.
  if (actions & 4) { // ACTION_ENTER
    const car = nearestCar(state);
    if (car) {
      if (car.driver === 'traffic') {
        // The driver is thrown out and runs off.
        spawnPed(state, car.x + 24, car.y, true);
        commitCrime(state, witnessedBy(state, car.x, car.y) ? HEAT.steal : 10);
        car.wasStolen = true;
      } else if (car.driver === 'parked') {
        if (witnessedBy(state, car.x, car.y)) commitCrime(state, HEAT.steal);
        car.wasStolen = true;
      }
      car.driver = 'player';
      p.carId = car.id;
      p.x = car.x;
      p.y = car.y;
      state.fx.push('enter');
      state.fx.push(`car:${CAR_MODELS[car.model].name}`);
    }
  }
  // Pickups underfoot.
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 24) {
      pk.taken = true;
      if (pk.kind === 'cash') p.cash += pk.amount;
      else p.hp = Math.min(FOOT.hp, p.hp + pk.amount);
      state.fx.push('pickup');
    }
  }
}

/** Spawn a pedestrian at a point (used for ejected drivers and city life). */
export function spawnPed(state, x, y, fleeing = false) {
  state.nextPedId += 1;
  const spot = resolveCircle(state.city, x, y, FOOT.radius);
  const ped = {
    id: state.nextPedId, x: spot.x, y: spot.y, angle: state.rng() * Math.PI * 2,
    hp: 60, down: false, downT: 0, fleeT: fleeing ? 3 : 0,
    cop: false, target: null, retargetT: 0,
    shirt: pick(state.rng, ['#d9d9d9', '#7fb069', '#e0a458', '#6d8ea0', '#bc4b51', '#8e7cc3', '#4ecdc4']),
    speed: range(state.rng, 55, 85),
  };
  state.peds.push(ped);
  return ped;
}

/** Ambient step: the clock, particles, pickup upkeep and the heat cooldown. */
export function stepAmbient(state, dt) {
  state.time += dt;
  state.clock = (state.clock + dt * 1) % 1440; // one game minute per real second
  if (state.seenByPolice) state.seenT = 0;
  else state.seenT += dt;
  const cool = state.seenByPolice ? 1.2 : 6;
  if (!state.over) state.heat = Math.max(0, state.heat - cool * dt);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) { state.particles.splice(i, 1); continue; }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
  }
  // Smoking wrecks keep smoking.
  for (const car of state.cars) {
    if (!car.dead && car.hp < car.maxHp * 0.35 && chance(state.rng, 0.06)) {
      spawnParticles(state, car.x, car.y, 1, '#6b7280', 16, 1.1);
    }
  }
  // Cash drops appear on sidewalks now and then; a health pack waits at the hospital door.
  state.pickups = state.pickups.filter((pk) => !pk.taken);
  if (state.pickups.length < 5 && chance(state.rng, 0.004)) {
    const ax = pick(state.rng, AVENUES);
    const sy = pick(state.rng, STREETS);
    const x = ax + (chance(state.rng, 0.5) ? -1 : 1) * (ROAD_HALF + 12);
    const y = Math.max(30, Math.min(WORLD.height - 30, sy + range(state.rng, -700, 700)));
    state.pickups.push({ x, y, kind: 'cash', amount: int(state.rng, 10, 45), taken: false });
  }
  if (!state.pickups.some((pk) => pk.kind === 'health')) {
    state.pickups.push({ x: PLACES.hospital.x, y: PLACES.hospital.y, kind: 'health', amount: 45, taken: false });
  }
}

/** Respawn after an arrest or a wreck: the city takes its cut and the record is wiped clean. */
export function respawn(state, kind) {
  const p = state.player;
  if (p.carId !== null) {
    const car = carById(state, p.carId);
    if (car && car.driver === 'player') car.driver = 'parked';
    p.carId = null;
  }
  if (kind === 'busted') {
    p.cash = Math.max(0, p.cash - Math.round(p.cash * 0.15) - 25);
    p.x = PLACES.policeStation.x;
    p.y = PLACES.policeStation.y;
  } else {
    p.cash = Math.max(0, p.cash - Math.round(p.cash * 0.1) - 15);
    p.x = PLACES.hospital.x;
    p.y = PLACES.hospital.y;
  }
  p.hp = FOOT.hp;
  state.heat = 0;
  state.over = null;
  state.overT = 0;
}

/** Day fraction 0..1 and the darkness that comes with the hour (0 at noon, up to 0.38 at night). */
export function darkness(state) {
  const hour = state.clock / 60;
  if (hour >= 7 && hour <= 17) return 0;
  if (hour > 17 && hour < 20) return (hour - 17) / 3 * 0.38;
  if (hour >= 20 || hour <= 4) return 0.38;
  return (1 - (hour - 4) / 3) * 0.38;
}

export { STEP };
