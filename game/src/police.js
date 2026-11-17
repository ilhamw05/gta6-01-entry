// The wanted system and the Solano Police Department. Crimes raise heat; heat becomes
// stars; stars bring police cars that chase and ram, and foot officers near the station.
// Out of sight long enough and the heat cools off. Get caught with no health and it is
// busted; get beaten down with no stars and it is wasted.
import { CAR, CAR_MODELS, WANTED } from './config.js';
import { clamp, dist } from './world.js';

const TWO_PI = Math.PI * 2;

function angleDiff(a, b) {
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

export function createPolice(world, random) {
  const { state } = world;
  const officers = [];
  for (let i = 0; i < 6; i += 1) {
    officers.push({
      x: 0, y: 0, angle: 0, hp: 80, active: false, speed: 0,
      shirt: '#2e4a8a', wander: 0, dir: 1, roadAxis: 'v', road: 2200,
    });
  }

  function wantedLevel() {
    return Math.min(WANTED.max, Math.floor(state.wantedHeat));
  }

  function spawnPoliceCar(placed) {
    const p = state.player;
    let x;
    let y;
    let angle;
    let speed = 0;
    if (placed) {
      x = placed.x;
      y = placed.y;
      angle = placed.angle;
      speed = placed.speed || 0;
    } else {
      // Pursuit starts from behind the player, not as a head-on roadblock in their path.
      const behind = p.inCar ? p.angle + Math.PI + (random() - 0.5) * 1.2 : random() * TWO_PI;
      x = clamp(p.x + Math.cos(behind) * WANTED.spawnDistance, 80, 3920);
      y = clamp(p.y + Math.sin(behind) * WANTED.spawnDistance, 80, 2820);
      angle = Math.atan2(p.y - y, p.x - x);
    }
    const model = CAR_MODELS[3];
    const car = {
      id: 1000 + Math.floor(random() * 9000), x, y, angle,
      speed, model, color: '#1d2f5a', top: 620,
      parked: false, traffic: false, police: true, racer: false, escort: false, attacker: false,
      gold: false, damage: 0, smoke: 0, hp: 120, driver: true,
      roadAxis: 'v', road: 2200, dir: 1, targetAngle: 0, cruise: 300, stopTimer: 0,
    };
    state.cars.push(car);
    return car;
  }

  function policeCars() {
    return state.cars.filter((c) => c.police && c.hp > 0);
  }

  /** Keep the right number of police cars on the street for the current wanted level. */
  function maintain() {
    const want = Math.min(WANTED.maxPoliceCars, wantedLevel() * WANTED.policeCarPerStar);
    const have = policeCars().length;
    if (have < want) spawnPoliceCar();
    // Too many: the furthest one gives up and drives away.
    if (have > want + 1) {
      const p = state.player;
      const list = policeCars().sort((a, b) => dist(b.x, b.y, p.x, p.y) - dist(a.x, a.y, p.x, p.y));
      const far = list[0];
      far.hp = 0;
      far.police = false;
      far.parked = true;
      far.speed = 0;
    }
  }

  /** One police car chasing the player: steer at them, ram, and push their car around. */
  function stepPoliceCar(car, dt) {
    const p = state.player;
    const target = p.inCar ? p.inCar : p;
    const d = dist(car.x, car.y, target.x, target.y);
    // Close in, then hold a ring around the player instead of pressing into them.
    // Very close: back off so the player's path stays clear.
    let wantAngle;
    let desired;
    if (d < 110) {
      wantAngle = Math.atan2(car.y - target.y, car.x - target.x);
      desired = 320;
    } else if (d < 130) {
      const orbit = (car.id % 2 === 0 ? 1 : -1) * (Math.PI / 2);
      wantAngle = Math.atan2(target.y - car.y, target.x - car.x) + orbit;
      desired = 260;
    } else {
      wantAngle = Math.atan2(target.y - car.y, target.x - car.x);
      desired = d > 420 ? car.top : 430;
    }
    car.speed += (desired - car.speed) * Math.min(1, 1.6 * dt);
    car.angle += clamp(angleDiff(car.angle, wantAngle), -2.8 * dt, 2.8 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 30, 3970);
    car.y = clamp(car.y, 30, 2875);
    world.resolveCircle(car, 24);
    car.ramTimer = Math.max(0, (car.ramTimer || 0) - dt);
    if (d < 66 && car.ramTimer <= 0 && car.speed > 150) {
      // Ram: one shove per cooldown, only at speed — a parked ring car never rams.
      car.ramTimer = 1.2;
      if (p.inCar) {
        const pc = p.inCar;
        pc.speed *= 0.86;
        pc.damage += 1;
        pc.hp -= 1;
        pc.x += Math.cos(car.angle) * 8;
        pc.y += Math.sin(car.angle) * 8;
        world.resolveCircle(pc, 24);
        car.speed *= 0.7;
      } else if (p.invuln <= 0) {
        p.hp -= 12;
        p.invuln = 0.5;
        world.addParticles(p.x, p.y, '#ff5a4a', 6, 160);
      }
    }
    if (car.damage > 60) car.smoke = Math.min(1, (car.damage - 60) / 40);
    if (car.hp <= 0 || car.damage >= 120) {
      car.speed *= Math.max(0, 1 - 3 * dt);
    }
  }

  /** Foot officers patrol near the station and chase the player when wanted. */
  function stepOfficers(dt) {
    const station = state.city.policeStation;
    const sx = station.x + station.w / 2;
    const sy = station.y + station.h / 2;
    const p = state.player;
    let active = 0;
    for (const o of officers) {
      if (wantedLevel() >= 2 && active < wantedLevel()) {
        if (!o.active) {
          o.active = true;
          o.x = sx + (random() - 0.5) * 300;
          o.y = sy + (random() - 0.5) * 300;
          o.hp = 80;
        }
        active += 1;
        const d = dist(o.x, o.y, p.x, p.y);
        if (d < 520 && !p.inCar) {
          const a = Math.atan2(p.y - o.y, p.x - o.x);
          o.x += Math.cos(a) * 185 * dt;
          o.y += Math.sin(a) * 185 * dt;
          o.angle = a;
          if (d < 34 && p.invuln <= 0) {
            p.hp -= 14;
            p.invuln = 0.6;
            world.addParticles(p.x, p.y, '#ff5a4a', 5, 140);
          }
        } else {
          o.wander -= dt;
          if (o.wander <= 0) {
            o.wander = 2 + random() * 3;
            o.angle = random() * TWO_PI;
          }
          o.x += Math.cos(o.angle) * 70 * dt;
          o.y += Math.sin(o.angle) * 70 * dt;
        }
        world.resolveCircle(o, 12);
      } else {
        o.active = false;
      }
    }
  }

  function step(dt) {
    state.wanted = wantedLevel();
    const p = state.player;
    // Can any police see the player?
    let seen = false;
    for (const car of policeCars()) {
      if (dist(car.x, car.y, p.x, p.y) < 460) { seen = true; break; }
    }
    if (!seen) {
      for (const o of officers) {
        if (o.active && dist(o.x, o.y, p.x, p.y) < 260) { seen = true; break; }
      }
    }
    if (seen) state.lastSeenTimer = 0;
    else state.lastSeenTimer += dt;
    if (state.wantedHeat > 0 && state.lastSeenTimer > WANTED.decayDelay) {
      state.wantedHeat = Math.max(0, state.wantedHeat - dt / (WANTED.decayStep / 1));
      if (state.lastSeenTimer > WANTED.decayDelay + WANTED.decayStep) state.lastSeenTimer = WANTED.decayDelay;
    }
    if (state.wantedHeat > 0) maintain();
    for (const car of policeCars()) stepPoliceCar(car, dt);
    stepOfficers(dt);
    // Busted: stopped, surrounded, and wanted.
    if (state.wanted > 0 && !p.inCar) {
      const near = policeCars().filter((c) => dist(c.x, c.y, p.x, p.y) < 130).length
        + officers.filter((o) => o.active && dist(o.x, o.y, p.x, p.y) < 110).length;
      if (near >= 2) {
        state.bustedTimer += dt;
        if (state.bustedTimer > 2.5) state.flags.busted = true;
      } else {
        state.bustedTimer = 0;
      }
    } else {
      state.bustedTimer = 0;
    }
    if (p.hp <= 0) {
      if (state.wanted > 0) state.flags.busted = true;
      else state.flags.wasted = true;
    }
  }

  function clearWanted() {
    state.wantedHeat = 0;
    state.wanted = 0;
    state.lastSeenTimer = 0;
    for (const car of state.cars) {
      if (car.police) { car.police = false; car.hp = 0; car.speed = 0; }
    }
    for (const o of officers) o.active = false;
  }

  function addHeat(amount) {
    state.wantedHeat = clamp(state.wantedHeat + amount, 0, WANTED.max);
  }

  return { step, clearWanted, addHeat, wantedLevel, policeCars, officers, spawnPoliceCar };
}
