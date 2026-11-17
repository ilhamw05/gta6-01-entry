// A small seeded random generator (mulberry32) plus the handful of helpers the city builder
// and the AI drivers reach for. Nothing in the game uses Math.random: a seed fully decides a
// world, which is what makes the screenshot scenes repeatable frame for frame.

/** Create a generator from a 32-bit seed. Returns a function giving floats in [0, 1). */
export function createRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Float in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Integer in [min, max], both ends included. */
export function int(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** True with probability p. */
export function chance(rng, p) {
  return rng() < p;
}

/** One element of a non-empty array. */
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}
