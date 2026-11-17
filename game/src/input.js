// Keyboard input: a held-key set for smooth movement and driving, plus an edge-triggered
// action set for the things that must happen once per press (entering a car, pausing, menus).
// The game reads both through the object createInput returns; nothing else touches the DOM.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_HORN = 8;
export const ACTION_NEW_GAME = 16;

const ACTION_KEYS = new Map([
  ['Enter', ACTION_CONFIRM],
  ['Escape', ACTION_PAUSE],
  ['KeyP', ACTION_PAUSE],
  ['KeyE', ACTION_ENTER],
  ['KeyF', ACTION_ENTER],
  ['KeyH', ACTION_HORN],
  ['KeyN', ACTION_NEW_GAME],
]);

export function createInput(target) {
  const held = new Set();
  const pressed = new Set();
  let actions = 0;

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    pressed.add(event.code);
    const action = ACTION_KEYS.get(event.code);
    if (action) actions |= action;
    // Keep the page from scrolling or the browser from claiming the game keys.
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  function onBlur() {
    held.clear();
    pressed.clear();
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    /** Movement vector from WASD/arrows, each axis -1, 0 or 1 (not normalised). */
    direction() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    /** Driving pedals from the same keys the feet use. */
    drive() {
      return {
        throttle: held.has('KeyW') || held.has('ArrowUp') ? 1 : 0,
        brake: held.has('KeyS') || held.has('ArrowDown') ? 1 : 0,
        steer: (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0),
        handbrake: held.has('Space'),
      };
    },
    running() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    punchHeld() {
      return held.has('Space') || held.has('KeyJ');
    },
    /** True once per physical press of a key code; consumes the edge. */
    wasPressed(code) {
      if (!pressed.has(code)) return false;
      pressed.delete(code);
      return true;
    },
    /** The action bits pressed since the last call; consumes them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
