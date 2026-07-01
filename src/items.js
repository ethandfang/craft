// ============================================================
// Item registry. Every block is an item (itemId === blockId).
// Non-block items (tools, materials) live at id >= 200.
// Provides icon drawing for the inventory/hotbar UI.
// ============================================================
import { BLOCK, getDef, tileForFace } from './blocks.js';
import { TILE } from './textures.js';

export const ITEM = {
  STICK: 200,
  WOOD_SWORD: 201, WOOD_PICKAXE: 202,
  STONE_SWORD: 203, STONE_PICKAXE: 204,
};

// Non-block item definitions.
const TOOLS = {
  [ITEM.STICK]:        { name: 'Stick', stack: 64, kind: 'material' },
  [ITEM.WOOD_SWORD]:   { name: 'Wooden Sword', stack: 1, kind: 'sword', tier: 'wood', damage: 4 },
  [ITEM.WOOD_PICKAXE]: { name: 'Wooden Pickaxe', stack: 1, kind: 'pickaxe', tier: 'wood', speed: 2 },
  [ITEM.STONE_SWORD]:  { name: 'Stone Sword', stack: 1, kind: 'sword', tier: 'stone', damage: 5 },
  [ITEM.STONE_PICKAXE]:{ name: 'Stone Pickaxe', stack: 1, kind: 'pickaxe', tier: 'stone', speed: 4 },
};

// Blocks that cannot be held as items.
const NOT_ITEM = new Set([BLOCK.AIR]);

export function getItem(id) {
  if (id >= 200) return TOOLS[id];
  if (NOT_ITEM.has(id)) return null;
  const d = getDef(id);
  return d ? { name: d.name, stack: 64, kind: 'block', block: id } : null;
}

export const itemName  = (id) => (getItem(id)?.name ?? '');
export const maxStack  = (id) => (getItem(id)?.stack ?? 64);
export const isBlockItem = (id) => id < 200 && !NOT_ITEM.has(id);
export const placeBlockOf = (id) => (isBlockItem(id) ? id : null);
export const toolInfo  = (id) => (id >= 200 ? TOOLS[id] : null);
export const isTool    = (id) => id >= 200 && (TOOLS[id]?.kind === 'pickaxe' || TOOLS[id]?.kind === 'sword');

// ---- icons ----
let atlasCanvas = null;
const toolIcons = {}; // id -> 16x16 canvas

export function initItems(atlas) {
  atlasCanvas = atlas;
  for (const id of Object.keys(TOOLS)) toolIcons[id] = buildToolIcon(+id);
}

// Draw an item's icon into ctx at (dx,dy) sized `size`.
export function drawItemIcon(ctx, id, dx, dy, size) {
  ctx.imageSmoothingEnabled = false;
  if (isBlockItem(id)) {
    const tile = tileForFace(id, 'top');
    ctx.drawImage(atlasCanvas, tile * TILE, 0, TILE, TILE, dx, dy, size, size);
  } else if (toolIcons[id]) {
    ctx.drawImage(toolIcons[id], 0, 0, 16, 16, dx, dy, size, size);
  }
}

function buildToolIcon(id) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const info = TOOLS[id];
  const wood = '#9c6a34', handle = '#9c6a34';
  const head = info.tier === 'stone' ? '#8a8a8c' : '#b5894e';

  if (info.kind === 'material') {              // stick: diagonal
    for (let i = 0; i < 10; i++) { px(4 + i, 12 - i, wood); px(5 + i, 12 - i, '#7d5326'); }
    return c;
  }
  // handle (both sword & pickaxe): diagonal shaft bottom-left -> center
  for (let i = 0; i < 8; i++) { px(4 + i, 13 - i, handle); px(5 + i, 13 - i, '#7d5326'); }

  if (info.kind === 'sword') {                 // blade continues up
    for (let i = 0; i < 6; i++) { px(9 + i, 6 - i, head); px(10 + i, 6 - i, '#d8d8dc'); }
    px(8, 8, '#5a5a5a'); px(9, 9, '#5a5a5a'); // guard
  } else {                                     // pickaxe head: bar across the top
    for (let x = 5; x <= 13; x++) px(x, 3, head);
    for (let x = 6; x <= 12; x++) px(x, 4, head);
    px(4, 4, head); px(14, 4, head);
  }
  return c;
}
