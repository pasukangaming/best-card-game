// Seeded random numbers (mulberry32). One tiny source of chance for the whole game:
// shuffles, the AI's tie-breaks and the screenshot autopilot all draw from it, so a fixed
// seed always deals the same game.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle that draws only from `rng`, so the same seed shuffles the same way. */
export function shuffle(list, rng) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** Pick one element of `list` with `rng`; null when the list is empty. */
export function pick(list, rng) {
  if (list.length === 0) return null;
  return list[Math.floor(rng() * list.length)];
}

/** A fresh seed from the clock and Math.random, for real play (never for screenshots). */
export function freshSeed() {
  return (Date.now() % 2147483647) ^ (Math.floor(Math.random() * 2147483647) >>> 0);
}
