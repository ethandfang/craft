// ============================================================
// Seedable Perlin noise (2D + 3D) with an fBm helper.
// Used for elevation, biome, and cave fields in worldgen.js.
// ============================================================

// Small, fast, seedable PRNG so a given seed always yields the same world.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + t * (b - a);

// Classic Perlin gradient hashing.
function grad(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export class Noise {
  constructor(seed = 1337) {
    const rng = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher–Yates shuffle
    for (let i = 255; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [p[i], p[j]] = [p[j], p[i]];
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  // 3D Perlin, returns roughly [-1, 1].
  perlin3(x, y, z) {
    const p = this.perm;
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(
      lerp(
        lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u),
        lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
      lerp(
        lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u),
        lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w);
  }

  // 2D noise via a fixed Z-slice of the 3D field.
  perlin2(x, y) { return this.perlin3(x, y, 0.5); }

  // Fractal Brownian motion — layered octaves for natural-looking terrain.
  fbm2(x, y, { octaves = 4, freq = 1, persistence = 0.5, lacunarity = 2 } = {}) {
    let amp = 1, f = freq, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += this.perlin2(x * f, y * f) * amp;
      norm += amp;
      amp *= persistence;
      f *= lacunarity;
    }
    return sum / norm; // normalized to ~[-1, 1]
  }
}
