// ============================================================
// Block registry: numeric ids + per-face tile mapping + flags.
// Meshing/physics ask these helpers about a block id.
// ============================================================
import { TILES } from './textures.js';

export const AIR = 0;

export const BLOCK = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WOOD: 5, LEAVES: 6, WATER: 7,
};

// def: { name, top, side, bottom, solid, opaque, fluid }
// - solid: collides with the player
// - opaque: fully hides neighbor faces (used by the mesher)
// - fluid: replaceable + rendered in the transparent pass
const DEFS = {
  [BLOCK.AIR]:    { name: 'Air',    solid: false, opaque: false },
  [BLOCK.GRASS]:  { name: 'Grass',  top: TILES.GRASS_TOP, side: TILES.GRASS_SIDE, bottom: TILES.DIRT, solid: true, opaque: true },
  [BLOCK.DIRT]:   { name: 'Dirt',   top: TILES.DIRT, side: TILES.DIRT, bottom: TILES.DIRT, solid: true, opaque: true },
  [BLOCK.STONE]:  { name: 'Stone',  top: TILES.STONE, side: TILES.STONE, bottom: TILES.STONE, solid: true, opaque: true },
  [BLOCK.SAND]:   { name: 'Sand',   top: TILES.SAND, side: TILES.SAND, bottom: TILES.SAND, solid: true, opaque: true },
  [BLOCK.WOOD]:   { name: 'Wood',   top: TILES.WOOD_TOP, side: TILES.WOOD_SIDE, bottom: TILES.WOOD_TOP, solid: true, opaque: true },
  [BLOCK.LEAVES]: { name: 'Leaves', top: TILES.LEAVES, side: TILES.LEAVES, bottom: TILES.LEAVES, solid: true, opaque: true },
  [BLOCK.WATER]:  { name: 'Water',  top: TILES.WATER, side: TILES.WATER, bottom: TILES.WATER, solid: false, opaque: false, fluid: true },
};

export const getDef    = (id) => DEFS[id];
export const isSolid   = (id) => !!(DEFS[id] && DEFS[id].solid);
export const isOpaque  = (id) => !!(DEFS[id] && DEFS[id].opaque);
export const isFluid   = (id) => !!(DEFS[id] && DEFS[id].fluid);
// A cell can be built into if it's air or a fluid (matches Minecraft's "replaceable").
export const isReplaceable = (id) => id === AIR || isFluid(id);

// Returns the atlas tile for a given face key ('top' | 'bottom' | 'side').
export function tileForFace(id, face) {
  const d = DEFS[id];
  return face === 'top' ? d.top : face === 'bottom' ? d.bottom : d.side;
}

// Blocks selectable in the hotbar (id + display name).
export const HOTBAR = [
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.SAND, BLOCK.WOOD, BLOCK.LEAVES, BLOCK.WATER,
];
