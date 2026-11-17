// The screenshot scenes behind ?shot=start|play|chase|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple driving
// autopilot that follows road waypoints, so the frame is what a short game really looks
// like and the same seed always gives the same frame.
import { STEP, ROADS_H, ROADS_V } from './config.js';
import { SCREEN_END, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 24;
const CHASE_SECONDS = 10;
const END_SECONDS = 5;

/** Waypoints on road centrelines, so the autopilot never has to cross a building. */
const PLAY_LOOP = [
  { x: 2200, y: 1550 }, { x: 2200, y: 950 }, { x: 1600, y: 950 }, { x: 1600, y: 1550 },
];
const CHASE_PATH = [
  { x: 3400, y: 2650 }, { x: 3400, y: 2720 },
];

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Drive toward the current waypoint; returns the input vector for this step. */
function drivePilot(game, waypoints, state) {
  const car = game.world.state.player.inCar;
  if (!car) return { move: { x: 0, y: 0 }, sprint: false, handbrake: false };
  // Advance the waypoint when reached, or when the next one is already closer
  // (the car cut the corner and will not come back for this one).
  let wp = waypoints[state.wp];
  let distToWp = Math.hypot(wp.x - car.x, wp.y - car.y);
  const nextIdx = state.loop ? (state.wp + 1) % waypoints.length : Math.min(state.wp + 1, waypoints.length - 1);
  if (nextIdx !== state.wp) {
    const distToNext = Math.hypot(waypoints[nextIdx].x - car.x, waypoints[nextIdx].y - car.y);
    if (distToWp < 70 || distToNext < distToWp) state.wp = nextIdx;
  } else if (distToWp < 70) {
    return { move: { x: 0, y: 0 }, sprint: false, handbrake: true };
  }
  wp = waypoints[state.wp];
  distToWp = Math.hypot(wp.x - car.x, wp.y - car.y);
  // Corner anticipation: near a waypoint, aim at the next one so the turn starts early
  // and the car stays on the road instead of cutting through a block.
  const aheadIdx = distToWp < 220 && nextIdx !== state.wp ? nextIdx : state.wp;
  const target = waypoints[aheadIdx];
  // Stuck against something: back up briefly, then try again.
  state.stuckTime = Math.abs(car.speed) < 30 ? (state.stuckTime || 0) + 1 / 60 : 0;
  if (state.stuckTime > 2.5) {
    state.reverseTime = 0.6;
    state.stuckTime = 0;
  }
  if (state.reverseTime > 0) {
    state.reverseTime -= 1 / 60;
    return { move: { x: 0, y: 0.8 }, sprint: false, handbrake: false };
  }
  let tx = target.x;
  let ty = target.y;
  // Off the road (shoved into a block or the docks): get back to the nearest road first.
  let nearestRoadD = Infinity;
  let nearestRoadX = tx;
  let nearestRoadY = ty;
  for (const rx of ROADS_V) {
    const d = Math.abs(car.x - rx);
    if (d < nearestRoadD) { nearestRoadD = d; nearestRoadX = rx; nearestRoadY = car.y; }
  }
  for (const ry of ROADS_H) {
    const d = Math.abs(car.y - ry);
    if (d < nearestRoadD) { nearestRoadD = d; nearestRoadX = car.x; nearestRoadY = ry; }
  }
  if (nearestRoadD > 90) {
    tx = nearestRoadX;
    ty = nearestRoadY;
  }
  // Obstacle avoidance: if a car sits on the line ahead, aim around it.
  const aheadX = car.x + Math.cos(car.angle) * 160;
  const aheadY = car.y + Math.sin(car.angle) * 160;
  for (const other of game.world.state.cars) {
    if (other === car || other.hp <= 0) continue;
    const od = Math.hypot(other.x - aheadX, other.y - aheadY);
    if (od < 100) {
      const side = (other.x - car.x) * Math.sin(car.angle) - (other.y - car.y) * Math.cos(car.angle) > 0 ? 1 : -1;
      tx += -Math.sin(car.angle) * side * 70;
      ty += Math.cos(car.angle) * side * 70;
      break;
    }
  }
  // And do not run a pedestrian over: steer around anyone in the way.
  const pedAheadX = car.x + Math.cos(car.angle) * 200;
  const pedAheadY = car.y + Math.sin(car.angle) * 200;
  for (const ped of game.world.state.peds) {
    if (ped.hp <= 0) continue;
    const od = Math.hypot(ped.x - pedAheadX, ped.y - pedAheadY);
    if (od < 80) {
      const side = (ped.x - car.x) * Math.sin(car.angle) - (ped.y - car.y) * Math.cos(car.angle) > 0 ? 1 : -1;
      tx += -Math.sin(car.angle) * side * 100;
      ty += Math.cos(car.angle) * side * 100;
      break;
    }
  }
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(car.angle, want);
  const steer = Math.max(-1, Math.min(1, diff * 1.6));
  let forward;
  if (Math.abs(diff) > 2.0) forward = 0;
  else if (distToWp < 130) forward = 0;
  else forward = -1;
  return { move: { x: steer, y: forward }, sprint: false, handbrake: Math.abs(diff) > 2.8 && Math.abs(car.speed) > 300 };
}

function putPlayerInCar(game, x, y, angle, modelName) {
  const { world } = game;
  const car = {
    id: 9001, x, y, angle, speed: 0,
    model: { name: modelName, color: '#4f7ac9', top: 560 }, color: '#4f7ac9', top: 560,
    parked: false, traffic: false, police: false, racer: false, escort: false, attacker: false,
    gold: false, damage: 0, smoke: 0, hp: 100, driver: true,
    roadAxis: 'h', road: 1550, dir: 1, targetAngle: 0, cruise: 300, stopTimer: 0,
  };
  world.state.cars.push(car);
  world.state.player.inCar = car;
  world.state.player.x = x;
  world.state.player.y = y;
  world.state.player.angle = angle;
  return car;
}

/**
 * Set the game to the named scene and return the screen to draw over it.
 * Unknown names stage the title scene.
 */
export function stageShot(name, game) {
  const { world, police, missions } = game;
  world.reset();
  if (name === 'play') {
    putPlayerInCar(game, 1600, 1550, 0, 'Dune Runner');
    const pilot = { wp: 0, loop: true };
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      game.step(STEP, drivePilot(game, PLAY_LOOP, pilot));
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    // A staged pursuit: the player is already speeding south down the dock road with
    // three police cars in formation behind — no random pile-up at a standstill.
    const car = putPlayerInCar(game, 3400, 2350, Math.PI / 2, 'Vesper Sedan');
    car.speed = 500;
    police.addHeat(3);
    police.spawnPoliceCar({ x: 3400, y: 2050, angle: Math.PI / 2, speed: 500 });
    police.spawnPoliceCar({ x: 3360, y: 2150, angle: Math.PI / 2, speed: 480 });
    police.spawnPoliceCar({ x: 3440, y: 1950, angle: Math.PI / 2, speed: 520 });
    // Clear moving traffic off the dock road so the pursuit has a clean run.
    for (let i = world.state.cars.length - 1; i >= 0; i -= 1) {
      const c = world.state.cars[i];
      if (!c.police && !c.parked && c !== car && Math.abs(c.x - 3400) < 200 && c.y > 2250 && c.y < 2800) {
        world.state.cars.splice(i, 1);
      }
    }
    const pilot = { wp: 0, loop: false };
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      game.step(STEP, drivePilot(game, CHASE_PATH, pilot));
    }
    // Keep the wanted level visible even if the heat cooled during the drive.
    if (world.state.wanted < 3) police.addHeat(3 - world.state.wantedHeat);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'end') {
    missions.ctrl.index = 6;
    missions.ctrl.completed = [1, 2, 3, 4, 5, 6];
    world.state.flags.storyComplete = true;
    world.state.stats.missionsDone = 6;
    world.state.stats.cashEarned = 3150;
    world.state.player.cash = 2140;
    world.state.player.x = 3500;
    world.state.player.y = 2720;
    world.state.player.angle = -Math.PI / 2;
    for (let i = 0; i < END_SECONDS / STEP; i += 1) {
      game.step(STEP, { move: { x: 0, y: 0 }, sprint: false, handbrake: false });
    }
    return { screen: SCREEN_END };
  }
  // start: the title over a living downtown.
  world.state.player.x = 1600;
  world.state.player.y = 1550;
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    game.stepAmbient(STEP);
  }
  return { screen: SCREEN_TITLE };
}
