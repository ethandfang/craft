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

// Surface height for a world column.
function heightAt(wx, wz) {
  // Large rolling hills + finer detail.
  const base = elevation.fbm2(wx * 0.0075, wz * 0.0075, { octaves: 4, persistence: 0.5, lacunarity: 2 });
  const detail = elevation.fbm2(wx * 0.03, wz * 0.03, { octaves: 3, persistence: 0.5 });
  const h = SEA_LEVEL + base * 26 + detail * 6;
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
      const b = biome.perlin2(wx * 0.004, wz * 0.004);         // -1 wet .. +1 dry
      const beachy = h <= SEA_LEVEL + 1;                        // near water -> sand shore

      for (let y = 0; y <= h; y++) {
        if (isCave(wx, y, wz)) continue;                        // carve caves
        let id;
        if (y === h) {
          id = beachy ? BLOCK.SAND : (b > 0.35 ? BLOCK.SAND : BLOCK.GRASS); // deserts + beaches
        } else if (y >= h - 3) {
          id = beachy ? BLOCK.SAND : BLOCK.DIRT;
        } else {
          id = BLOCK.STONE;
        }
        chunk.set(x, y, z, id);
      }

      // Fill oceans/lakes with water from the surface up to sea level.
      for (let y = h + 1; y <= SEA_LEVEL; y++) chunk.set(x, y, z, BLOCK.WATER);

      // Trees on grass above the waterline.
      if (!beachy && b <= 0.35 && chunk.get(x, h, z) === BLOCK.GRASS) {
        if (treeRng.perlin2(wx * 1.7, wz * 1.7) > 0.72 && x > 1 && x < 14 && z > 1 && z < 14) {
          placeTree(chunk, x, h + 1, z);
        }
      }
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
