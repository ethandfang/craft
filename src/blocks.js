// ============================================================
// Block registry: numeric ids + per-face tiles + flags + hardness.
// Meshing/physics/mining all ask these helpers about a block id.
//   render: 'cube' (default) or 'cross' (X-shaped plant billboard)
//   hardness: seconds to break by hand (0 = instant)
// ============================================================
import { TILES } from './textures.js';

export const AIR = 0;

export const BLOCK = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WOOD: 5, LEAVES: 6, WATER: 7,
  SNOW: 8, COAL_ORE: 9, IRON_ORE: 10, TALL_GRASS: 11, FLOWER: 12,
  PLANKS: 13, CRAFTING_TABLE: 14,
};

const cube = (name, top, side, bottom, hardness, extra = {}) =>
  ({ name, top, side, bottom, solid: true, opaque: true, render: 'cube', hardness, ...extra });
const cross = (name, tile) =>
  ({ name, top: tile, side: tile, bottom: tile, solid: false, opaque: false, render: 'cross', hardness: 0 });

const DEFS = {
  [BLOCK.AIR]:      { name: 'Air', solid: false, opaque: false, render: 'none', hardness: 0 },
  [BLOCK.GRASS]:    cube('Grass', TILES.GRASS_TOP, TILES.GRASS_SIDE, TILES.DIRT, 0.6, { drop: BLOCK.DIRT }),
  [BLOCK.DIRT]:     cube('Dirt', TILES.DIRT, TILES.DIRT, TILES.DIRT, 0.5),
  [BLOCK.STONE]:    cube('Stone', TILES.STONE, TILES.STONE, TILES.STONE, 3.0, { tool: 'pickaxe' }),
  [BLOCK.SAND]:     cube('Sand', TILES.SAND, TILES.SAND, TILES.SAND, 0.5),
  [BLOCK.WOOD]:     cube('Wood', TILES.WOOD_TOP, TILES.WOOD_SIDE, TILES.WOOD_TOP, 2.0),
  [BLOCK.LEAVES]:   cube('Leaves', TILES.LEAVES, TILES.LEAVES, TILES.LEAVES, 0.3),
  [BLOCK.SNOW]:     cube('Snow', TILES.SNOW, TILES.SNOW, TILES.SNOW, 0.4, { tool: 'pickaxe' }),
  [BLOCK.COAL_ORE]: cube('Coal Ore', TILES.COAL_ORE, TILES.COAL_ORE, TILES.COAL_ORE, 4.0, { tool: 'pickaxe' }),
  [BLOCK.IRON_ORE]: cube('Iron Ore', TILES.IRON_ORE, TILES.IRON_ORE, TILES.IRON_ORE, 4.5, { tool: 'pickaxe' }),
  [BLOCK.PLANKS]:   cube('Planks', TILES.PLANKS, TILES.PLANKS, TILES.PLANKS, 2.0),
  [BLOCK.CRAFTING_TABLE]: cube('Crafting Table', TILES.TABLE_TOP, TILES.TABLE_SIDE, TILES.PLANKS, 2.0, { useable: true }),
  [BLOCK.WATER]:    { name: 'Water', top: TILES.WATER, side: TILES.WATER, bottom: TILES.WATER, solid: false, opaque: false, render: 'cube', fluid: true, hardness: 0 },
  [BLOCK.TALL_GRASS]: cross('Tall Grass', TILES.TALL_GRASS),
  [BLOCK.FLOWER]:     cross('Flower', TILES.FLOWER),
};

export const getDef   = (id) => DEFS[id];
export const isSolid  = (id) => !!(DEFS[id] && DEFS[id].solid);
export const isOpaque = (id) => !!(DEFS[id] && DEFS[id].opaque);
export const isFluid  = (id) => !!(DEFS[id] && DEFS[id].fluid);
export const isCross  = (id) => !!(DEFS[id] && DEFS[id].render === 'cross');
export const isUseable = (id) => !!(DEFS[id] && DEFS[id].useable);
export const toolFor  = (id) => (DEFS[id] && DEFS[id].tool) || null;   // 'pickaxe' | null
export const hardnessOf = (id) => (DEFS[id] ? DEFS[id].hardness : 1);
// Item id a block yields when mined (usually itself; grass -> dirt).
export const dropOf = (id) => (DEFS[id] && DEFS[id].drop !== undefined ? DEFS[id].drop : id);
// A cell can be built into if it's air, a fluid, or a plant (Minecraft "replaceable").
export const isReplaceable = (id) => id === AIR || isFluid(id) || isCross(id);

// Atlas tile for a face key ('top' | 'bottom' | 'side').
export function tileForFace(id, face) {
  const d = DEFS[id];
  return face === 'top' ? d.top : face === 'bottom' ? d.bottom : d.side;
}
