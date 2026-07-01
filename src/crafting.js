// ============================================================
// Crafting: recipe definitions + grid matching.
//  - shaped:    exact pattern (position matters, auto-trimmed)
//  - shapeless: just the multiset of ingredients
// A 2x2 grid (player) can only make recipes that fit in 2x2;
// tools need the 3x3 crafting table.
// ============================================================
import { BLOCK } from './blocks.js';
import { ITEM } from './items.js';

const P = BLOCK.PLANKS, S = ITEM.STICK, St = BLOCK.STONE, o = 0;

const RECIPES = [
  { shapeless: [BLOCK.WOOD], out: { id: BLOCK.PLANKS, count: 4 } },
  { pattern: [[P], [P]], out: { id: ITEM.STICK, count: 4 } },
  { pattern: [[P, P], [P, P]], out: { id: BLOCK.CRAFTING_TABLE, count: 1 } },
  { pattern: [[P, P, P], [o, S, o], [o, S, o]], out: { id: ITEM.WOOD_PICKAXE, count: 1 } },
  { pattern: [[P], [P], [S]], out: { id: ITEM.WOOD_SWORD, count: 1 } },
  { pattern: [[St, St, St], [o, S, o], [o, S, o]], out: { id: ITEM.STONE_PICKAXE, count: 1 } },
  { pattern: [[St], [St], [S]], out: { id: ITEM.STONE_SWORD, count: 1 } },
];

function bbox(ids, size) {
  let minR = size, minC = size, maxR = -1, maxC = -1;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (ids[r * size + c]) { minR = Math.min(minR, r); minC = Math.min(minC, c); maxR = Math.max(maxR, r); maxC = Math.max(maxC, c); }
  }
  return maxR < 0 ? null : { minR, minC, maxR, maxC };
}

function matchShaped(ids, size, recipe) {
  const bb = bbox(ids, size);
  if (!bb) return false;
  const gh = bb.maxR - bb.minR + 1, gw = bb.maxC - bb.minC + 1;
  const rp = recipe.pattern, rh = rp.length, rw = rp[0].length;
  if (gh !== rh || gw !== rw) return false;
  for (let r = 0; r < rh; r++) for (let c = 0; c < rw; c++) {
    if ((ids[(bb.minR + r) * size + (bb.minC + c)] || 0) !== (rp[r][c] || 0)) return false;
  }
  return true;
}

function matchShapeless(ids, recipe) {
  const have = ids.filter(Boolean).sort((a, b) => a - b);
  const want = recipe.shapeless.slice().sort((a, b) => a - b);
  if (have.length !== want.length) return false;
  return have.every((v, i) => v === want[i]);
}

// ids: flat array (size*size) of item ids, 0 = empty. Returns output {id,count} or null.
export function matchRecipe(ids, size) {
  for (const r of RECIPES) {
    if (r.pattern ? matchShaped(ids, size, r) : matchShapeless(ids, r)) return r.out;
  }
  return null;
}
