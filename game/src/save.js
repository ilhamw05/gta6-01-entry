// Save and load for Solano Vice, through localStorage only. A save holds the cash, the
// mission progress, the player's spot on the map, health and lifetime stats. Wanted is
// always zero on load — a fresh start should not begin with the police already chasing.
import { SAVE_KEY } from './config.js';

export function saveGame(world, missions) {
  const { state } = world;
  const data = {
    version: 1,
    cash: Math.round(state.player.cash),
    hp: Math.round(state.player.hp),
    x: Math.round(state.player.x),
    y: Math.round(state.player.y),
    missionIndex: missions.ctrl.index,
    completed: missions.ctrl.completed,
    stats: state.stats,
    clockHours: state.clockHours,
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function applySave(world, missions, data) {
  const { state } = world;
  state.player.cash = data.cash;
  state.player.hp = data.hp;
  state.player.x = data.x;
  state.player.y = data.y;
  state.player.inCar = null;
  state.wantedHeat = 0;
  state.wanted = 0;
  missions.ctrl.index = data.missionIndex;
  missions.ctrl.completed = [...data.completed];
  state.stats = { ...state.stats, ...data.stats };
  state.clockHours = data.clockHours;
  world.updateCamera();
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off; nothing to clear then.
  }
}
