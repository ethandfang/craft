// ============================================================
// Chunk mesher. Builds three geometries per chunk:
//   opaque  - solid blocks (face-culled)
//   water   - transparent fluid surface
//   cutout  - cross-shaped plants (alpha-tested billboards)
//
// Solid faces get per-vertex AMBIENT OCCLUSION: corners tucked
// against neighboring blocks are darkened, which is the signature
// "smooth lighting" look of Minecraft. Neighbor lookups cross chunk
// borders via world.getBlock so seams cull correctly.
// ============================================================
import * as THREE from 'three';
import { CHUNK_SIZE } from './config.js';
import { isOpaque, isFluid, isCross, tileForFace, AIR } from './blocks.js';
import { NTILES, UV_PAD } from './textures.js';

// Per-face: neighbor direction, 4 CCW corner offsets, per-corner UV
// (0 = tile min, 1 = tile max; y=0 is tile top), baked shade, and face key.
const FACES = [
  { dir: [ 1, 0, 0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], uv: [[0,1],[0,0],[1,0],[1,1]], shade: 0.80, face: 'side' },
  { dir: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], uv: [[1,1],[1,0],[0,0],[0,1]], shade: 0.80, face: 'side' },
  { dir: [ 0, 1, 0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], uv: [[0,1],[1,1],[1,0],[0,0]], shade: 1.00, face: 'top' },
  { dir: [ 0,-1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], uv: [[0,0],[1,0],[1,1],[0,1]], shade: 0.50, face: 'bottom' },
  { dir: [ 0, 0, 1], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], uv: [[1,1],[1,0],[0,0],[0,1]], shade: 0.66, face: 'side' },
  { dir: [ 0, 0,-1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], uv: [[0,1],[0,0],[1,0],[1,1]], shade: 0.66, face: 'side' },
];

const UNIT = [[1,0,0],[0,1,0],[0,0,1]];
const AO_LUT = [0.45, 0.62, 0.80, 1.0]; // darkness by occlusion level 0..3

// Map a tile-local uv (0/1) into atlas space with a half-texel inset.
function uCoord(tile, u) { return (tile + (u === 0 ? UV_PAD : 1 - UV_PAD)) / NTILES; }
function vCoord(v)        { return v === 0 ? UV_PAD : 1 - UV_PAD; }

class Buf {
  constructor() { this.pos = []; this.col = []; this.uv = []; this.idx = []; this.v = 0; }
  geometry() {
    if (!this.v) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    return g;
  }
}

export function buildChunkGeometry(world, chunk) {
  const O = new Buf(), W = new Buf(), C = new Buf();
  const ox = chunk.cx * CHUNK_SIZE, oz = chunk.cz * CHUNK_SIZE;
  const solid = (x, y, z) => isOpaque(world.getBlock(x, y, z)); // AO occluders

  for (let y = 0; y <= chunk.maxSolidY; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const id = chunk.get(x, y, z);
        if (id === AIR) continue;
        const wx = ox + x, wy = y, wz = oz + z;

        if (isCross(id)) { addCross(C, x, y, z, tileForFace(id, 'side')); continue; }

        const fluid = isFluid(id);
        const buf = fluid ? W : O;
        for (const f of FACES) {
          const nb = world.getBlock(wx + f.dir[0], wy + f.dir[1], wz + f.dir[2]);
          if (fluid) { if (nb !== AIR) continue; }  // water only meets air
          else if (isOpaque(nb)) continue;          // solid hidden by opaque neighbor

          const tile = tileForFace(id, f.face);
          addFace(buf, x, y, z, f, tile, fluid ? null : aoForFace(solid, wx, wy, wz, f));
        }
      }
    }
  }
  return { opaque: O.geometry(), water: W.geometry(), cutout: C.geometry() };
}

// Compute the 4 per-corner AO brightness values for one cube face.
function aoForFace(solid, wx, wy, wz, f) {
  const [dx, dy, dz] = f.dir;
  const nx = wx + dx, ny = wy + dy, nz = wz + dz;      // cell in front of the face
  // Two in-plane tangent axes.
  const ta = dx !== 0 ? 1 : 0;
  const tb = dz !== 0 ? 1 : 2;
  const A = UNIT[ta], B = UNIT[tb];
  const out = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const c = f.corners[i];
    const da = c[ta] === 1 ? 1 : -1;
    const db = c[tb] === 1 ? 1 : -1;
    const s1 = solid(nx + A[0]*da, ny + A[1]*da, nz + A[2]*da) ? 1 : 0;
    const s2 = solid(nx + B[0]*db, ny + B[1]*db, nz + B[2]*db) ? 1 : 0;
    const co = solid(nx + A[0]*da + B[0]*db, ny + A[1]*da + B[1]*db, nz + A[2]*da + B[2]*db) ? 1 : 0;
    const level = (s1 && s2) ? 0 : 3 - (s1 + s2 + co);
    out[i] = AO_LUT[level];
  }
  return out;
}

function addFace(buf, x, y, z, f, tile, ao) {
  const s = f.shade;
  const b = ao || [1, 1, 1, 1];
  for (let i = 0; i < 4; i++) {
    const c = f.corners[i];
    buf.pos.push(x + c[0], y + c[1], z + c[2]);
    const sh = s * b[i];
    buf.col.push(sh, sh, sh);
    buf.uv.push(uCoord(tile, f.uv[i][0]), vCoord(f.uv[i][1]));
  }
  const v = buf.v;
  // Flip the split so AO gradients interpolate smoothly (anisotropy fix).
  if (b[0] + b[2] > b[1] + b[3]) buf.idx.push(v, v+1, v+2, v, v+2, v+3);
  else                          buf.idx.push(v+1, v+2, v+3, v+1, v+3, v);
  buf.v += 4;
}

// Two crossed quads (X) filling the cell — a plant billboard.
function addCross(buf, x, y, z, tile) {
  const p = 0.15, q = 1 - p, h = 0.9;
  const quads = [
    [[x+p, y, z+p], [x+q, y, z+q], [x+q, y+h, z+q], [x+p, y+h, z+p]],
    [[x+q, y, z+p], [x+p, y, z+q], [x+p, y+h, z+q], [x+q, y+h, z+p]],
  ];
  for (const c of quads) {
    const uv = [[0,1],[1,1],[1,0],[0,0]];
    for (let i = 0; i < 4; i++) {
      buf.pos.push(c[i][0], c[i][1], c[i][2]);
      buf.col.push(1, 1, 1);
      buf.uv.push(uCoord(tile, uv[i][0]), vCoord(uv[i][1]));
    }
    const v = buf.v;
    buf.idx.push(v, v+1, v+2, v, v+2, v+3);
    buf.v += 4;
  }
}

// One centered cube for a block id — used by the first-person held item.
export function buildBlockGeometry(id) {
  const buf = new Buf();
  for (const f of FACES) addFace(buf, -0.5, -0.5, -0.5, f, tileForFace(id, f.face), null);
  return buf.geometry();
}
