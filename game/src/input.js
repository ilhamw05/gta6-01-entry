// Keyboard and pointer input for Solano Vice. Held keys give a movement vector; one-shot
// presses (enter a car, punch, horn, pause, confirm) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_HORN = 16;
export const ACTION_SAVE = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const HANDBRAKE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER_CAR = new Set(['KeyE', 'KeyF']);
const PUNCH = new Set(['KeyJ']);
const HORN = new Set(['KeyH']);
const SAVE = new Set(['KeyG']);

// Space doubles as punch on foot and handbrake in a car; the world decides which applies.
export function createInput(target) {
  const held = new Set();
  let actions = 0;

  function press(code) {
    if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (ENTER_CAR.has(code)) actions |= ACTION_ENTER;
    else if (PUNCH.has(code) || code === 'Space') actions |= ACTION_PUNCH;
    else if (HORN.has(code)) actions |= ACTION_HORN;
    else if (SAVE.has(code)) actions |= ACTION_SAVE;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    press(event.code);
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)
      || SPRINT.has(event.code) || HANDBRAKE.has(event.code) || CONFIRM.has(event.code)
      || PAUSE.has(event.code) || ENTER_CAR.has(event.code) || PUNCH.has(event.code)
      || HORN.has(event.code) || SAVE.has(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  function anyOf(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Movement vector: x right, y down, each -1, 0 or 1. */
    move() {
      return { x: (anyOf(RIGHT) ? 1 : 0) - (anyOf(LEFT) ? 1 : 0), y: (anyOf(DOWN) ? 1 : 0) - (anyOf(UP) ? 1 : 0) };
    },
    sprint() {
      return anyOf(SPRINT);
    },
    handbrake() {
      return anyOf(HANDBRAKE);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
