// ============================================================
// World: owns all chunks, streams them in/out around the player,
// meshes them incrementally, and provides block get/set that
// works in world coordinates across chunk boundaries.
// ============================================================
import * as THREE from 'three';
import { Chunk } from './chunk.js';
import { generateChunk } from './worldgen.js';
import { buildChunkGeometry } from './mesher.js';
import { CHUNK_SIZE, CHUNK_HEIGHT, RENDER_DISTANCE } from './config.js';

const GEN_PER_FRAME = 2;   // chunks generated per frame (keeps the loop smooth)
const MESH_PER_FRAME = 3;  // chunks meshed per frame

export class World {
  constructor(scene, materials, persistence) {
    this.scene = scene;
    this.materials = materials;        // { opaque, water }
    this.persistence = persistence;
    this.chunks = new Map();           // "cx,cz" -> Chunk
    this.genQueue = [];
    this.meshQueue = new Set();
    this.centerCX = null;
    this.centerCZ = null;
  }

  key(cx, cz) { return cx + ',' + cz; }
  getChunk(cx, cz) { return this.chunks.get(this.key(cx, cz)); }

  // ---- block access in WORLD coordinates ----
  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return 0;
    const cx = Math.floor(wx / CHUNK_SIZE), cz = Math.floor(wz / CHUNK_SIZE);
    const ch = this.getChunk(cx, cz);
    if (!ch || !ch.generated) return 0;
    return ch.get(wx - cx * CHUNK_SIZE, wy, wz - cz * CHUNK_SIZE);
  }

  setBlock(wx, wy, wz, id, record = true) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const cx = Math.floor(wx / CHUNK_SIZE), cz = Math.floor(wz / CHUNK_SIZE);
    const ch = this.getChunk(cx, cz);
    if (!ch || !ch.generated) return;
    const lx = wx - cx * CHUNK_SIZE, lz = wz - cz * CHUNK_SIZE;
    ch.set(lx, wy, lz, id);
    this.markDirty(cx, cz);
    // A border edit changes the neighbor chunk's culling too — remesh it.
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);
    if (record) this.persistence.record(wx, wy, wz, id);
  }

  markDirty(cx, cz) {
    const ch = this.getChunk(cx, cz);
    if (ch && ch.generated) { ch.dirty = true; this.meshQueue.add(this.key(cx, cz)); }
  }

  // ---- streaming ----
  update(playerPos) {
    const pcx = Math.floor(playerPos.x / CHUNK_SIZE);
    const pcz = Math.floor(playerPos.z / CHUNK_SIZE);
    if (pcx !== this.centerCX || pcz !== this.centerCZ) {
      this.centerCX = pcx; this.centerCZ = pcz;
      this.refreshLoadList(pcx, pcz);
    }
    this.processQueues();
  }

  refreshLoadList(pcx, pcz) {
    const R = RENDER_DISTANCE;
    const gen = [];
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const cx = pcx + dx, cz = pcz + dz;
      let ch = this.getChunk(cx, cz);
      if (!ch) { ch = new Chunk(cx, cz); this.chunks.set(this.key(cx, cz), ch); }
      if (!ch.generated) gen.push({ cx, cz, d: dx * dx + dz * dz });
    }
    gen.sort((a, b) => a.d - b.d);          // nearest first
    this.genQueue = gen;

    // Unload chunks that drifted well outside the view.
    for (const [k, ch] of this.chunks) {
      if (Math.abs(ch.cx - pcx) > R + 1 || Math.abs(ch.cz - pcz) > R + 1) {
        this.disposeChunk(ch);
        this.chunks.delete(k);
        this.meshQueue.delete(k);
      }
    }
  }

  processQueues() {
    let gb = GEN_PER_FRAME;
    while (gb > 0 && this.genQueue.length) {
      const { cx, cz } = this.genQueue.shift();
      const ch = this.getChunk(cx, cz);
      if (ch && !ch.generated) {
        generateChunk(ch, this.persistence.overridesForChunk(cx, cz));
        this.markDirty(cx, cz);
        // Neighbors' border faces may need re-culling now that this data exists.
        this.markDirty(cx - 1, cz); this.markDirty(cx + 1, cz);
        this.markDirty(cx, cz - 1); this.markDirty(cx, cz + 1);
        gb--;
      }
    }

    let mb = MESH_PER_FRAME;
    for (const k of this.meshQueue) {
      if (mb <= 0) break;
      const ch = this.chunks.get(k);
      if (!ch || !ch.generated) { this.meshQueue.delete(k); continue; }
      if (!this.neighborsReady(ch.cx, ch.cz)) continue; // wait so borders cull correctly
      this.meshChunk(ch);
      this.meshQueue.delete(k);
      mb--;
    }
  }

  // Existing neighbor chunks must be generated; a missing neighbor is treated
  // as air (its faces get corrected when it later loads and marks us dirty).
  neighborsReady(cx, cz) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nb = this.getChunk(cx + dx, cz + dz);
      if (nb && !nb.generated) return false;
    }
    return true;
  }

  meshChunk(ch) {
    const { opaque, water } = buildChunkGeometry(this, ch);
    const ox = ch.cx * CHUNK_SIZE, oz = ch.cz * CHUNK_SIZE;
    this.disposeChunk(ch);
    if (opaque) { const m = new THREE.Mesh(opaque, this.materials.opaque); m.position.set(ox, 0, oz); this.scene.add(m); ch.opaqueMesh = m; }
    if (water)  { const m = new THREE.Mesh(water, this.materials.water);   m.position.set(ox, 0, oz); this.scene.add(m); ch.waterMesh = m; }
    ch.dirty = false;
  }

  disposeChunk(ch) {
    if (ch.opaqueMesh) { this.scene.remove(ch.opaqueMesh); ch.opaqueMesh.geometry.dispose(); ch.opaqueMesh = null; }
    if (ch.waterMesh)  { this.scene.remove(ch.waterMesh);  ch.waterMesh.geometry.dispose();  ch.waterMesh = null; }
  }

  // Synchronously generate a square of chunks — used to prepare spawn so the
  // player doesn't fall through not-yet-generated ground.
  ensureReady(pcx, pcz, radius) {
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      const cx = pcx + dx, cz = pcz + dz;
      let ch = this.getChunk(cx, cz);
      if (!ch) { ch = new Chunk(cx, cz); this.chunks.set(this.key(cx, cz), ch); }
      if (!ch.generated) generateChunk(ch, this.persistence.overridesForChunk(cx, cz));
    }
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++)
      this.meshChunk(this.getChunk(pcx + dx, pcz + dz));
  }

  loadedChunkCount() { return this.chunks.size; }
}
