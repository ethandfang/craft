// ============================================================
// Chunk: a CHUNK_SIZE x CHUNK_HEIGHT x CHUNK_SIZE column of blocks
// stored in a flat Uint8Array. Coordinates here are LOCAL (0..size).
// ============================================================
import { CHUNK_SIZE, CHUNK_HEIGHT } from './config.js';

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;                 // chunk coords (world = cx * CHUNK_SIZE)
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    this.maxSolidY = 0;           // highest non-air Y, lets the mesher skip empty sky
    this.generated = false;       // block data filled?
    this.dirty = true;            // needs (re)meshing?
    this.opaqueMesh = null;       // THREE.Mesh (solid blocks)
    this.waterMesh = null;        // THREE.Mesh (transparent water)
  }

  static index(x, y, z) {
    return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
  }

  inRange(x, y, z) {
    return x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT;
  }

  get(x, y, z) {
    if (!this.inRange(x, y, z)) return 0;
    return this.blocks[Chunk.index(x, y, z)];
  }

  set(x, y, z, id) {
    if (!this.inRange(x, y, z)) return;
    this.blocks[Chunk.index(x, y, z)] = id;
    if (id !== 0 && y > this.maxSolidY) this.maxSolidY = y;
  }
}
