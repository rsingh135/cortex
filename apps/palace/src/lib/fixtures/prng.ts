/** mulberry32: small, fast, seedable. Every fixture and ticker choice flows through one of these. */
export interface Prng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  /** Uniform in [min, max). */
  range(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
  shuffle<T>(items: readonly T[]): T[];
  /** `count` distinct items, in shuffled order. */
  sample<T>(items: readonly T[], count: number): T[];
  /** Lower-case hex string of `length` chars. */
  hex(length: number): string;
  /** Independent stream derived from this one; lets sub-generators change without shifting each other. */
  fork(): Prng;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPrng(seed: number): Prng {
  const next = mulberry32(seed);
  const prng: Prng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    range: (min, max) => min + next() * (max - min),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p) => next() < p,
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    sample: (items, count) => prng.shuffle(items).slice(0, Math.max(0, Math.min(count, items.length))),
    hex: (length) => {
      let s = "";
      while (s.length < length) s += Math.floor(next() * 0x100000000).toString(16).padStart(8, "0");
      return s.slice(0, length);
    },
    fork: () => createPrng(Math.floor(next() * 0xffffffff)),
  };
  return prng;
}
