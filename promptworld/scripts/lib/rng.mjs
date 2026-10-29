/**
 * Deterministic PRNG + sampling helpers.
 *
 * The dataset is generated, not hand-listed, so every build must produce the
 * exact same 1,300+ prompts. Mulberry32 keeps that reproducible without a
 * dependency.
 */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Random {
  constructor(seed = 20261029) {
    this.rng = mulberry32(seed);
    this.usedSignatures = new Set();
  }

  float() {
    return this.rng();
  }

  int(min, max) {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  pick(list) {
    return list[Math.floor(this.rng() * list.length)];
  }

  /** Pick `n` distinct items, preserving the source order for stable output. */
  sample(list, n) {
    const pool = [...list];
    const out = [];
    const count = Math.min(n, pool.length);
    for (let i = 0; i < count; i += 1) {
      out.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
    }
    return out;
  }

  chance(p) {
    return this.rng() < p;
  }

  /** Reject a draw that repeats a signature already used in this category. */
  unique(signature, draw, attempts = 60) {
    for (let i = 0; i < attempts; i += 1) {
      const candidate = draw(i);
      const key = signature(candidate);
      if (!this.usedSignatures.has(key)) {
        this.usedSignatures.add(key);
        return candidate;
      }
    }
    const fallback = draw(attempts);
    this.usedSignatures.add(signature(fallback));
    return fallback;
  }
}

export function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function titleCase(value) {
  return String(value).replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
