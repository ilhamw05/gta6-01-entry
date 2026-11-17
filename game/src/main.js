// Solano Vice — boot and the one loop. The world advances in fixed 1/60 s steps; input is
// read every frame; the renderer paints what is there. Screens: title, play, paused, and
// the busted/wasted overlays the world itself raises. Progress (cash, Mara's jobs, where
// you woke up) is saved to localStorage between visits.
//
// ?seed=N fixes the city. ?shot=start|play|mission|chase (with &seed=N) stages a scene
// instead of running the loop, paints it twice and sets window.__shotReady.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, respawn, stepAmbient, stepPlayer } from './world.js';
import { seedTraffic, stepPeds, stepTraffic } from './traffic.js';
import { seedStationCops, stepPolice } from './police.js';
import { failActiveMission, initMissions, stepMissions } from './missions.js';
import { ACTION_CONFIRM, ACTION_NEW_GAME, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';

const MAX_FRAME = 0.25;
const OVER_HOLD = 2.8; // seconds the BUSTED / WASTED screen stays up

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.player.cash,
      next: state.mission ? state.mission.next : 0,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      storyDone: state.storyDone,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

/** A fresh Port Solano, optionally continuing a saved life. */
function buildState(save) {
  const state = createWorld(createRandom(seed));
  initMissions(state);
  seedTraffic(state);
  seedStationCops(state);
  if (save) {
    state.player.cash = save.cash;
    state.player.x = save.x;
    state.player.y = save.y;
    state.mission.next = Math.min(6, save.next | 0);
    state.storyDone = Boolean(save.storyDone);
  }
  return state;
}

if (shot) {
  const state = buildState(null);
  const screen = stageShot(shot, state);
  let painted = 0;
  const paint = () => {
    renderer.draw(state, screen, { hasSave: false, storyDone: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
} else {
  runGame();
}

function runGame() {
  const input = createInput(window);
  const audio = createAudio();
  let save = readSave();
  let state = buildState(save);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let saveT = 0;
  let overHandled = false;

  function announce(message) {
    status.textContent = message;
  }

  function startPlay(continueSave) {
    save = continueSave ? readSave() : null;
    if (!continueSave) {
      try { window.localStorage.removeItem(SAVE_KEY); } catch { /* nothing to clear */ }
    }
    state = buildState(save);
    overHandled = false;
    screen = SCREEN_PLAY;
    announce(continueSave ? 'Welcome back to Port Solano.' : 'A new life in Port Solano.');
  }

  function drainFx() {
    for (const name of state.fx) {
      if (name === 'horn' && state.player.carId === null) continue;
      if (!name.startsWith('car:')) audio.play(name);
    }
    state.fx.length = 0;
  }

  function stepOnce(actions) {
    if (screen === SCREEN_TITLE) {
      // The city lives behind the title; the player stands still in it.
      stepTraffic(state, STEP);
      stepPeds(state, STEP);
      stepAmbient(state, STEP);
      state.fx.length = 0;
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (state.over) {
      state.overT += STEP;
      stepAmbient(state, STEP);
      if (state.overT > OVER_HOLD && !overHandled) {
        overHandled = true;
        failActiveMission(state, state.over === 'busted' ? 'the law took you' : 'you woke up in hospital');
        respawn(state, state.over);
        writeSave(state);
        announce(state.over === null ? 'Back on the street.' : '');
      }
      if (!state.over) overHandled = false;
      drainFx();
      return;
    }
    stepPlayer(state, STEP, input, actions);
    stepTraffic(state, STEP);
    stepPolice(state, STEP);
    stepPeds(state, STEP);
    stepMissions(state, STEP, actions);
    stepAmbient(state, STEP);
    drainFx();
    saveT += STEP;
    if (saveT > 5) {
      saveT = 0;
      writeSave(state);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_NEW_GAME) startPlay(false);
      else if (actions & ACTION_CONFIRM) startPlay(Boolean(readSave()));
      return 0;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return 0;
    }
    return screen === SCREEN_PLAY ? actions : 0;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    let actions = handleActions();
    if (screen === SCREEN_PAUSED) {
      accumulator = 0;
    } else {
      while (accumulator >= STEP) {
        stepOnce(actions);
        actions = 0;
        accumulator -= STEP;
      }
    }
    // Continuous sounds follow the frame, not the step.
    if (screen === SCREEN_PLAY && !state.over) {
      const car = state.player.carId !== null ? state.cars.find((c) => c.id === state.player.carId) : null;
      audio.setEngine(car ? Math.min(1, Math.abs(car.speed) / 420) : null);
      let nearest = Infinity;
      for (const c of state.cars) {
        if (c.driver === 'police') nearest = Math.min(nearest, Math.hypot(c.x - state.player.x, c.y - state.player.y));
      }
      audio.setSiren(nearest === Infinity ? 0 : Math.max(0, 1 - nearest / 700));
      if (input.wasPressed('KeyH') && car) audio.play('horn');
    } else {
      audio.setEngine(null);
      audio.setSiren(0);
    }
    renderer.draw(state, screen, { hasSave: Boolean(readSave()), storyDone: state.storyDone });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      writeSave(state);
      announce('Paused.');
    }
  });
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

  announce('Solano Vice. Press Enter to start.');
  requestAnimationFrame(frame);
}
