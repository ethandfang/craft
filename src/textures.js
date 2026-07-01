// ============================================================
// Procedural pixel-art textures.
//  - buildAtlas():        one 16px-tile atlas for all block faces
//                         (opaque tiles are solid; plant tiles keep
//                          a transparent background for alpha cutout).
//  - buildCrackTextures(): 10 progressive block-breaking overlays.
//  - buildCloudTexture():  tiling white-on-transparent cloud sheet.
// ============================================================
import * as THREE from 'three';

export const TILE = 16;

// Tile indices within the atlas (single row).
export const TILES = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, SAND: 4,
  WOOD_TOP: 5, WOOD_SIDE: 6, LEAVES: 7, WATER: 8, SNOW: 9,
  COAL_ORE: 10, IRON_ORE: 11, TALL_GRASS: 12, FLOWER: 13,
  PLANKS: 14, TABLE_TOP: 15, TABLE_SIDE: 16,
};
export const NTILES = 17;

// Half-texel UV inset so faces sample tile centers (no bleeding between tiles).
export const UV_PAD = 0.5 / TILE;

const cl = (v) => Math.max(0, Math.min(255, v | 0));

export function buildAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = TILE * NTILES;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d');

  const set = (ox, x, y, r, g, b, a = 1) => {
    ctx.fillStyle = `rgba(${cl(r)},${cl(g)},${cl(b)},${a})`;
    ctx.fillRect(ox + x, y, 1, 1);
  };
  const fill = (tile, r, g, b, d) => {            // noisy opaque fill
    const ox = tile * TILE;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const j = (Math.random() * 2 - 1) * d;
      set(ox, x, y, r + j, g + j, b + j);
    }
  };
  const cluster = (tile, cx, cy, rad, r, g, b) => { // rough blob (ore speckle)
    const ox = tile * TILE;
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++)
      if (x * x + y * y <= rad * rad && Math.random() < 0.8)
        set(ox, cl(cx + x) % 16, cl(cy + y) % 16, r, g, b);
  };

  fill(TILES.DIRT,  125, 90, 60, 16);
  fill(TILES.SAND,  224, 211, 160, 14);
  fill(TILES.STONE, 130, 130, 132, 16);
  fill(TILES.SNOW,  238, 244, 250, 8);
  fill(TILES.WATER, 46, 96, 190, 12);
  for (let i = 0; i < 10; i++) set(TILES.STONE * TILE, (Math.random()*16)|0, (Math.random()*16)|0, 95, 95, 97);

  // grass top + jagged side cap
  fill(TILES.GRASS_TOP, 96, 158, 56, 20);
  for (let i = 0; i < 22; i++) set(TILES.GRASS_TOP * TILE, (Math.random()*16)|0, (Math.random()*16)|0, 70, 130, 40);
  fill(TILES.GRASS_SIDE, 125, 90, 60, 16);
  {
    const ox = TILES.GRASS_SIDE * TILE;
    for (let x = 0; x < 16; x++) {
      const h = 3 + (Math.random() < 0.35 ? 1 : 0);
      for (let y = 0; y < h; y++) { const j = (Math.random()*2-1)*18; set(ox, x, y, 90+j, 150+j, 52+j); }
      if (Math.random() < 0.3) set(ox, x, h, 80, 140, 46);
    }
  }

  // wood bark + rings
  fill(TILES.WOOD_SIDE, 138, 99, 54, 8);
  { const ox = TILES.WOOD_SIDE * TILE;
    for (let x = 0; x < 16; x++) if (Math.random() < 0.45)
      for (let y = 0; y < 16; y++) if (Math.random() < 0.7) set(ox, x, y, 105, 72, 38); }
  fill(TILES.WOOD_TOP, 165, 120, 70, 6);
  { const ox = TILES.WOOD_TOP * TILE;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
      if ((Math.hypot(x - 7.5, y - 7.5) | 0) % 2 === 0) set(ox, x, y, 135, 95, 52); }

  // planks: wood base with horizontal plank seams
  fill(TILES.PLANKS, 160, 120, 68, 8);
  { const ox = TILES.PLANKS * TILE;
    for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) set(ox, x, y, 120, 86, 46);
    for (let x = 3; x < 16; x += 6) for (let y = 0; y < 16; y++) set(ox, x, y, 134, 98, 54); }

  // crafting table top: planks + a 3x3 grid + tool marks
  fill(TILES.TABLE_TOP, 160, 120, 68, 8);
  { const ox = TILES.TABLE_TOP * TILE;
    for (let i = 0; i <= 16; i += 5) for (let k = 0; k < 16; k++) { set(ox, i>15?15:i, k, 90, 64, 34); set(ox, k, i>15?15:i, 90, 64, 34); }
    for (let y = 2; y < 6; y++) set(ox, 3, y, 60, 60, 62); }         // a "tool" hint

  // crafting table side: planks with saw/tool silhouette
  fill(TILES.TABLE_SIDE, 150, 112, 62, 8);
  { const ox = TILES.TABLE_SIDE * TILE;
    for (let y = 0; y < 16; y += 5) for (let x = 0; x < 16; x++) set(ox, x, y, 96, 68, 36);
    for (let y = 3; y < 9; y++) set(ox, 11, y, 60, 60, 62); set(ox, 10, 3, 60,60,62); set(ox, 12, 3, 60,60,62); }

  // leaves
  fill(TILES.LEAVES, 58, 128, 44, 22);
  for (let i = 0; i < 40; i++) set(TILES.LEAVES * TILE, (Math.random()*16)|0, (Math.random()*16)|0, 38, 95, 30);
  for (let i = 0; i < 14; i++) set(TILES.LEAVES * TILE, (Math.random()*16)|0, (Math.random()*16)|0, 80, 160, 55);

  // ores: stone base + mineral speckles
  fill(TILES.COAL_ORE, 130, 130, 132, 16);
  for (let i = 0; i < 4; i++) cluster(TILES.COAL_ORE, 3 + (Math.random()*10)|0, 3 + (Math.random()*10)|0, 1 + (Math.random()*1.5)|0, 28, 28, 30);
  fill(TILES.IRON_ORE, 130, 130, 132, 16);
  for (let i = 0; i < 4; i++) cluster(TILES.IRON_ORE, 3 + (Math.random()*10)|0, 3 + (Math.random()*10)|0, 1 + (Math.random()*1.5)|0, 206, 160, 120);

  // --- plant tiles: transparent background, drawn for alpha cutout ---
  // tall grass: green blades rising from the bottom
  { const ox = TILES.TALL_GRASS * TILE;
    for (let x = 1; x < 15; x++) {
      if (Math.random() < 0.45) continue;
      const h = 6 + (Math.random() * 7) | 0;
      for (let y = 0; y < h; y++) {
        const g = 120 + (Math.random()*2-1)*30;
        set(ox, x, 15 - y, 60, g, 40, 1);
      }
    } }
  // flower: green stem + colored bloom
  { const ox = TILES.FLOWER * TILE;
    for (let y = 6; y < 15; y++) set(ox, 8, y, 60, 130, 45, 1);       // stem
    const petal = Math.random() < 0.5 ? [220, 70, 70] : [235, 210, 70]; // red or yellow
    const bloom = [[7,4],[8,4],[9,4],[6,5],[7,5],[8,5],[9,5],[10,5],[7,6],[8,6],[9,6]];
    for (const [px, py] of bloom) set(ox, px, py, petal[0], petal[1], petal[2], 1);
    set(ox, 8, 5, 250, 240, 120, 1);                                   // center
  }

  const texture = makeTex(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, texture };
}

function makeTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  return t;
}

// 10 cumulative crack overlays (stage 0 = faint, stage 9 = shattered).
export function buildCrackTextures() {
  const pts = [];
  for (let w = 0; w < 9; w++) {          // random crack walks
    let x = (Math.random() * 16) | 0, y = (Math.random() * 16) | 0;
    const steps = 3 + ((Math.random() * 5) | 0);
    for (let s = 0; s < steps; s++) {
      pts.push([x, y]);
      x = Math.max(0, Math.min(15, x + ((Math.random() * 3) | 0) - 1));
      y = Math.max(0, Math.min(15, y + ((Math.random() * 3) | 0) - 1));
    }
  }
  const out = [];
  for (let i = 0; i < 10; i++) {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    const count = Math.floor(((i + 1) / 10) * pts.length);
    g.fillStyle = 'rgba(8,8,8,0.6)';
    for (let k = 0; k < count; k++) g.fillRect(pts[k][0], pts[k][1], 1, 1);
    out.push(makeTex(c));
  }
  return out;
}

// Soft blocky clouds on a transparent, tiling sheet.
export function buildCloudTexture() {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 7; i++) {
    const w = 8 + (Math.random() * 18) | 0, h = 6 + (Math.random() * 12) | 0;
    const x = (Math.random() * S) | 0, y = (Math.random() * S) | 0;
    g.fillRect(x, y, w, h);
    g.fillRect(x + 2, y - 2, w - 4, h + 4); // rough puff
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}
