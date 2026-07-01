// ============================================================
// Chunk mesher: builds ONE geometry from a chunk's blocks,
// emitting only faces exposed to a non-opaque neighbor
// (face culling). Solid blocks and water go into separate
// geometries so water can be drawn transparently.
//
// Neighbor lookups cross chunk borders via world.getBlock,
// so seams between chunks are culled correctly.
// ============================================================
import * as THREE from 'three';
import { CHUNK_SIZE } from './config.js';
import { isOpaque, isFluid, tileForFace, AIR } from './blocks.js';
import { TILE, NTILES } from './textures.js';

// Per-face: direction to the neighbor, the 4 corner offsets (CCW),
// UVs (v=0 is the top of the tile), a baked shade for fake lighting,
// and which tile-face key to sample.
const FACES = [
  { dir: [ 1, 0, 0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], uv: [[0,1],[0,0],[1,0],[1,1]], shade: 0.80, face: 'side' },
  { dir: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], uv: [[1,1],[1,0],[0,0],[0,1]], shade: 0.80, face: 'side' },
  { dir: [ 0, 1, 0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], uv: [[0,1],[1,1],[1,0],[0,0]], shade: 1.00, face: 'top' },
  { dir: [ 0,-1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], uv: [[0,0],[1,0],[1,1],[0,1]], shade: 0.50, face: 'bottom' },
  { dir: [ 0, 0, 1], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], uv: [[1,1],[1,0],[0,0],[0,1]], shade: 0.66, face: 'side' },
  { dir: [ 0, 0,-1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], uv: [[0,1],[0,0],[1,0],[1,1]], shade: 0.66, face: 'side' },
];

function makeGeometry(pos, col, uvs, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

// Decide whether a face between `id` and its neighbor `nb` should be drawn.
function faceVisible(id, nb) {
  if (isFluid(id)) return nb === AIR;      // water: only where it touches air
  return !isOpaque(nb);                    // solid: unless fully hidden by an opaque block
}

// Returns { opaque: BufferGeometry|null, water: BufferGeometry|null }.
export function buildChunkGeometry(world, chunk) {
  const O = { pos: [], col: [], uv: [], idx: [], v: 0 }; // opaque buffers
  const W = { pos: [], col: [], uv: [], idx: [], v: 0 }; // water buffers
  const ox = chunk.cx * CHUNK_SIZE, oz = chunk.cz * CHUNK_SIZE;

  for (let y = 0; y <= chunk.maxSolidY; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const id = chunk.get(x, y, z);
        if (id === AIR) continue;
        const fluid = isFluid(id);
        const buf = fluid ? W : O;
        const wx = ox + x, wy = y, wz = oz + z;

        for (const f of FACES) {
          const nb = world.getBlock(wx + f.dir[0], wy + f.dir[1], wz + f.dir[2]);
          if (fluid) { if (nb !== AIR) continue; }          // water face rule
          else if (isOpaque(nb)) continue;                   // solid face rule

          const tile = tileForFace(id, f.face);
          const s = f.shade;
          for (let i = 0; i < 4; i++) {
            const c = f.corners[i];
            buf.pos.push(x + c[0], y + c[1], z + c[2]);
            buf.col.push(s, s, s);
            buf.uv.push((tile + f.uv[i][0]) / NTILES, f.uv[i][1]);
          }
          buf.idx.push(buf.v, buf.v + 1, buf.v + 2, buf.v, buf.v + 2, buf.v + 3);
          buf.v += 4;
        }
      }
    }
  }

  return {
    opaque: O.v ? makeGeometry(O.pos, O.col, O.uv, O.idx) : null,
    water:  W.v ? makeGeometry(W.pos, W.col, W.uv, W.idx) : null,
  };
}
