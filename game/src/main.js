// Boot and the one loop for Solano Vice: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves between five
// screens: title, play, paused, busted and wasted (plus the story-complete panel).
//
// ?seed=N fixes the city and the traffic. ?shot=start|play|chase|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady for
// a screenshot. No network request is ever made; every file is local.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAR_HIT, EVENT_PED_DOWN, EVENT_PUNCH_HIT } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_HORN, ACTION_PAUSE, ACTION_PUNCH, ACTION_SAVE, createInput } from './input.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { stepCollisions, stepPed, stepTrafficCar, EVENT_RUNOVER } from './traffic.js';
import { createAudio } from './audio.js';
import { applySave, clearSave, hasSave, loadSave, saveGame } from './save.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_END, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

function createGame(seedValue) {
  const random = createRandom(seedValue);
  const world = createWorld(random);
  const police = createPolice(world, random);
  const missions = createMissions(world, police, random);
  const audio = createAudio();

  function stepAmbient(dt) {
    for (const car of world.state.cars) stepTrafficCar(car, dt, world, random);
    for (const ped of world.state.peds) stepPed(ped, dt, world, random);
    world.stepParticles(dt);
    world.stepClock(dt);
    world.updateCamera();
  }

  /** Advance the whole simulation one fixed step with the given input. */
  function step(dt, input) {
    const { state } = world;
    const p = state.player;
    let events = 0;
    if (p.inCar) {
      events |= world.stepDriving(dt, input.move, input.handbrake, input.horn);
    } else {
      events |= world.stepPlayer(dt, input.move, input.sprint, input.punch);
    }
    for (const car of state.cars) stepTrafficCar(car, dt, world, random);
    for (const ped of state.peds) stepPed(ped, dt, world, random);
    events = stepCollisions(world, events);
    police.step(dt);
    missions.update(dt);
    world.stepParticles(dt);
    world.stepClock(dt);
    world.updateCamera();
    if (input.horn) audio.horn();
    audio.engine(p.inCar ? p.inCar.speed : 0, !!p.inCar);
    audio.siren(state.wanted);
    return events;
  }

  return { world, police, missions, audio, step, stepAmbient, random };
}

const game = createGame(seed);
const renderer = createRenderer(canvas);

function runShot(name) {
  const scene = stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(game.world, game.missions, game.police, scene.screen, '', false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const { world, police, missions, audio } = game;
  const { state } = world;
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let saveFlash = '';
  let saveFlashTimer = 0;
  let newGameKey = false;
  let prevCompleted = 0;
  let prevFailed = false;
  let endShown = false;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyN' && !event.repeat) newGameKey = true;
    audio.unlock();
  });
  canvas.addEventListener('pointerdown', () => audio.unlock());

  function announce(message) {
    status.textContent = message;
  }

  function flashSave(text2) {
    saveFlash = text2;
    saveFlashTimer = 2.5;
  }

  function startNewGame() {
    world.reset();
    missions.ctrl.index = 0;
    missions.ctrl.completed = [];
    missions.ctrl.active = null;
    missions.ctrl.failed = false;
    police.clearWanted();
    clearSave();
    prevCompleted = 0;
    prevFailed = false;
    endShown = false;
    screen = SCREEN_PLAY;
    announce('Permainan baru. Port Solano menunggumu.');
  }

  function continueGame() {
    const data = loadSave();
    world.reset();
    if (data) applySave(world, missions, data);
    police.clearWanted();
    prevCompleted = missions.ctrl.completed.length;
    endShown = false;
    screen = SCREEN_PLAY;
    announce('Lanjutan permainan. Selamat datang kembali di Port Solano.');
  }

  function respawn(afterBusted) {
    const point = afterBusted ? state.city.policeStation : state.city.hospital;
    const p = state.player;
    if (p.inCar) {
      p.inCar.speed = 0;
      p.inCar = null;
    }
    p.x = point.x + point.w / 2;
    p.y = point.y + point.h + 40;
    p.hp = 100;
    p.vx = 0;
    p.vy = 0;
    police.clearWanted();
    state.flags.busted = false;
    state.flags.wasted = false;
    world.updateCamera();
    screen = SCREEN_PLAY;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (screen === SCREEN_TITLE) {
      if (newGameKey) {
        newGameKey = false;
        startNewGame();
        return 0;
      }
      if (actions & ACTION_CONFIRM) {
        if (hasSave()) continueGame();
        else startNewGame();
      }
      return 0;
    }
    newGameKey = false;
    if (actions & ACTION_SAVE && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      flashSave(saveGame(world, missions) ? 'Permainan disimpan!' : 'Gagal menyimpan.');
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Lanjut.');
      }
      return 0;
    }
    if (screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) respawn(true);
      return 0;
    }
    if (screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) respawn(false);
      return 0;
    }
    if (screen === SCREEN_END) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        endShown = true;
      }
      return 0;
    }
    // SCREEN_PLAY
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
      return 0;
    }
    if (actions & ACTION_ENTER) {
      const p = state.player;
      if (p.inCar) {
        world.exitCar();
      } else if (!missions.tryStart()) {
        const car = world.tryEnterCar();
        if (car) {
          announce(`Mengemudi ${car.model.name}.`);
          if (state.stats.carsStolen > 0) audio.pickup();
        }
      }
    }
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (saveFlashTimer > 0) {
      saveFlashTimer -= STEP;
      if (saveFlashTimer <= 0) saveFlash = '';
    }
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        game.stepAmbient(STEP);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      let punch = !!(actions & ACTION_PUNCH);
      let horn = !!(actions & ACTION_HORN);
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        const move = input.move();
        const events = game.step(STEP, {
          move,
          sprint: input.sprint(),
          handbrake: input.handbrake(),
          punch,
          horn,
        });
        punch = false;
        horn = false;
        if (events & EVENT_PUNCH_HIT) audio.punch();
        if (events & (EVENT_PED_DOWN | EVENT_RUNOVER)) {
          police.addHeat(1);
          audio.hit();
        }
        if (events & EVENT_CAR_HIT) audio.hit();
        if (state.flags.busted) {
          state.player.cash = Math.max(0, state.player.cash - 200);
          audio.busted();
          screen = SCREEN_BUSTED;
          announce('Tertangkap! Polisi membawamu ke kantor.');
        } else if (state.flags.wasted) {
          state.player.cash = Math.max(0, state.player.cash - 100);
          audio.busted();
          screen = SCREEN_WASTED;
          announce('Tumbang! Ambulans membawamu ke rumah sakit.');
        }
        if (missions.ctrl.completed.length > prevCompleted) {
          prevCompleted = missions.ctrl.completed.length;
          audio.missionWin();
          saveGame(world, missions);
        }
        if (missions.ctrl.failed && !prevFailed) {
          prevFailed = true;
          audio.missionFail();
        } else if (!missions.ctrl.failed) {
          prevFailed = false;
        }
        if (state.flags.storyComplete && !endShown && screen === SCREEN_PLAY) {
          screen = SCREEN_END;
          audio.missionWin();
        }
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, missions, police, screen, saveFlash, hasSave());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  announce('Solano Vice. Tekan Spasi atau klik untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
