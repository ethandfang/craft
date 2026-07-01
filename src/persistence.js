// ============================================================
// Persistence: stores player edits (block diffs) in localStorage,
// bucketed by chunk so worldgen can re-apply them on regeneration.
// Only CHANGES are saved — the base world is always regenerated
// from the seed, so the save stays tiny.
// ============================================================
import { CHUNK_SIZE } from './config.js';

const KEY = 'minicraft_save_v1';
const SAVE_DELAY = 0.8; // seconds of inactivity before writing

export class Persistence {
  constructor() {
    this.buckets = new Map(); // "cx,cz" -> Map("wx,wy,wz" -> id)
    this._dirty = false;
    this._timer = 0;
    this.load();
  }

  _chunkKey(wx, wz) {
    return Math.floor(wx / CHUNK_SIZE) + ',' + Math.floor(wz / CHUNK_SIZE);
  }

  // Record a player edit (id 0 = block removed; still stored so it stays gone).
  record(wx, wy, wz, id) {
    const ck = this._chunkKey(wx, wz);
    let bucket = this.buckets.get(ck);
    if (!bucket) { bucket = new Map(); this.buckets.set(ck, bucket); }
    bucket.set(`${wx},${wy},${wz}`, id);
    this._dirty = true;
    this._timer = 0;
  }

  // Iterable of [ "wx,wy,wz", id ] for a chunk, or null if it has no edits.
  overridesForChunk(cx, cz) {
    const b = this.buckets.get(cx + ',' + cz);
    return b ? b.entries() : null;
  }

  tick(dt) {
    if (!this._dirty) return;
    this._timer += dt;
    if (this._timer >= SAVE_DELAY) this.save();
  }

  save() {
    const out = {};
    for (const [ck, bucket] of this.buckets) {
      const o = {};
      for (const [k, id] of bucket) o[k] = id;
      out[ck] = o;
    }
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, edits: out })); } catch (e) { /* quota */ }
    this._dirty = false;
    this._timer = 0;
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const ck in data.edits) {
        const bucket = new Map();
        const o = data.edits[ck];
        for (const k in o) bucket.set(k, o[k]);
        this.buckets.set(ck, bucket);
      }
    } catch (e) { /* corrupt save -> start fresh */ }
  }

  clear() {
    this.buckets.clear();
    try { localStorage.removeItem(KEY); } catch (e) {}
  }
}
