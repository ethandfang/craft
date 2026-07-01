// ============================================================
// Inventory: a flat array of stacks. Slots 0..8 are the hotbar.
// A stack is { id, count } or null for empty.
// ============================================================
import { maxStack } from './items.js';

export const HOTBAR_SIZE = 9;

export class Inventory {
  constructor(size = 36) {
    this.slots = new Array(size).fill(null);
    this.selected = 0; // active hotbar index
  }

  selectedStack() { return this.slots[this.selected]; }

  // Add items, stacking into existing matching stacks then empty slots.
  // Returns the number that did NOT fit.
  add(id, count = 1) {
    const cap = maxStack(id);
    for (let i = 0; i < this.slots.length && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < cap) {
        const n = Math.min(cap - s.count, count);
        s.count += n; count -= n;
      }
    }
    for (let i = 0; i < this.slots.length && count > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(cap, count);
        this.slots[i] = { id, count: n }; count -= n;
      }
    }
    return count;
  }

  // Remove one item from a slot (used when placing a block). Returns true if removed.
  removeOne(index) {
    const s = this.slots[index];
    if (!s) return false;
    s.count--;
    if (s.count <= 0) this.slots[index] = null;
    return true;
  }

  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  serialize() { return this.slots.map((s) => (s ? [s.id, s.count] : null)); }
  load(data) {
    if (!Array.isArray(data)) return;
    this.slots = data.map((s) => (s ? { id: s[0], count: s[1] } : null));
  }
}
