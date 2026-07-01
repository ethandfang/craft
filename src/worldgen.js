// ============================================================
// Terrain generation for a single chunk.
// Uses separate noise fields for elevation, biome, and caves,
// then places soil/stone/sand/water and scatters trees.
// ============================================================
import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL, WORLD_SEED } from './config.js';
import { Noise } from './noise.js';
import { BLOCK } from './blocks.js';

// Independent noise instances (offset seeds) so fields are uncorrelated.
const elevation = new Noise(WORLD_SEED);
const biome     = new Noise(WORLD_SEED + 101);
const caves     = new Noise(WORLD_SEED + 202);
const treeRng   = new Noise(WORLD_SEED + 303);
const oreNoise  = new Noise(WORLD_SEED + 404);

const SNOW_LINE = SEA_LEVEL + 20; // peaks above this get snow caps
const DESERT = 0.55;              // biome value above this is sandy desert (rare)
const BIOME_FREQ = 0.009;         // higher -> biomes vary over shorter distances

// Cheap per-column white-noise hash in [0,1) for scattering plants.
function hash2(x, z) {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

// Pick an ore for a stone cell, or 0 for plain stone.
function oreAt(wx, wy, wz) {
  if (wy < SEA_LEVEL - 4 && oreNoise.perlin3((wx + 50) * 0.12, wy * 0.12, (wz + 50) * 0.12) > 0.82) return BLOCK.IRON_ORE;
  if (oreNoise.perlin3(wx * 0.1, wy * 0.1, wz * 0.1) > 0.80) return BLOCK.COAL_ORE;
  return 0;
}

// Surface height for a world column.
function heightAt(wx, wz) {
  // Rolling hills + finer detail + broad mountain ranges (squared mask so
  // mountains are localized and rise well above the snow line).
  const base = elevation.fbm2(wx * 0.0075, wz * 0.0075, { octaves: 4, persistence: 0.5, lacunarity: 2 });
  const detail = elevation.fbm2(wx * 0.03, wz * 0.03, { octaves: 3, persistence: 0.5 });
  // Localized mountain mask: gentle plains most places, big peaks where high.
  const m = Math.max(0, elevation.fbm2(wx * 0.0035, wz * 0.0035, { octaves: 2, persistence: 0.5 }));
  const mountain = m * m * 220;
  // +7 baseline lifts most land above sea level (grassy plains); very low
  // base values dip below the waterline to form lakes/oceans.
  const h = SEA_LEVEL + 7 + base * 18 + detail * 6 + mountain;
  return Math.max(1, Math.min(CHUNK_HEIGHT - 8, Math.floor(h)));
}

// True where a 3D cave should carve a void.
function isCave(wx, wy, wz) {
  if (wy < 4 || wy > SEA_LEVEL + 8) return false;              // keep caves underground
  const n = caves.perlin3(wx * 0.06, wy * 0.09, wz * 0.06);
  return n > 0.55;                                              // threshold -> tunnels/pockets
}

export function generateChunk(chunk, overrides) {
  const ox = chunk.cx * CHUNK_SIZE;
  const oz = chunk.cz * CHUNK_SIZE;

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const wx = ox + x, wz = oz + z;
      const h = heightAt(wx, wz);
      const b = biome.perlin2(wx * BIOME_FREQ, wz * BIOME_FREQ); // -1 wet .. +1 dry
      const beachy = h <= SEA_LEVEL + 1;                        // near water -> sand shore

      for (let y = 0; y <= h; y++) {
        if (isCave(wx, y, wz)) continue;                        // carve caves
        let id;
        if (y === h) {
          if (beachy || b > DESERT) id = BLOCK.SAND;            // beaches + deserts
          else if (h >= SNOW_LINE) id = BLOCK.SNOW;             // snowy peaks
          else id = BLOCK.GRASS;
        } else if (y >= h - 3) {
          id = beachy ? BLOCK.SAND : BLOCK.DIRT;
        } else {
          id = oreAt(wx, y, wz) || BLOCK.STONE;                 // ores embedded in stone
        }
        chunk.set(x, y, z, id);
      }

      // Fill oceans/lakes with water from the surface up to sea level.
      for (let y = h + 1; y <= SEA_LEVEL; y++) chunk.set(x, y, z, BLOCK.WATER);

      // Trees on grass above the waterline.
      if (!beachy && b <= DESERT && chunk.get(x, h, z) === BLOCK.GRASS) {
        if (treeRng.perlin2(wx * 1.7, wz * 1.7) > 0.72 && x > 1 && x < 14 && z > 1 && z < 14) {
          placeTree(chunk, x, h + 1, z);
        }
      }
    }
  }

  // Scatter plants on exposed grass (after trees, so we don't grow into a trunk).
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const wx = ox + x, wz = oz + z;
      const h = heightAt(wx, wz);
      if (chunk.get(x, h, z) !== BLOCK.GRASS || chunk.get(x, h + 1, z) !== BLOCK.AIR) continue;
      const r = hash2(wx, wz);
      if (r < 0.30) chunk.set(x, h + 1, z, r < 0.04 ? BLOCK.FLOWER : BLOCK.TALL_GRASS);
    }
  }

  // Apply any player edits saved for this chunk (persistence overrides).
  if (overrides) {
    for (const [key, id] of overrides) {
      const [wx, wy, wz] = key.split(',').map(Number);
      chunk.set(wx - ox, wy, wz - oz, id);
    }
  }

  chunk.generated = true;
}

function placeTree(chunk, x, y, z) {
  const trunk = 4 + ((chunk.cx * 31 + x * 7 + z * 13) & 1);
  for (let i = 0; i < trunk; i++) chunk.set(x, y + i, z, BLOCK.WOOD);
  const top = y + trunk;
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++)
      for (let dy = 0; dy <= 2; dy++) {
        if (Math.abs(dx) + Math.abs(dz) + dy > 4) continue;
        if (dx === 0 && dz === 0 && dy < 1) continue;
        if (chunk.get(x + dx, top + dy, z + dz) === BLOCK.AIR)
          chunk.set(x + dx, top + dy, z + dz, BLOCK.LEAVES);
      }
}

export { heightAt };
