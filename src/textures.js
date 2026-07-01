// ============================================================
// Procedural pixel-art texture atlas.
// Every block face samples a 16x16 tile from a single canvas,
// which becomes one THREE.Texture (1 draw call for all terrain).
// ============================================================
import * as THREE from 'three';

export const TILE = 16;

// Tile indices within the atlas (one row of tiles).
export const TILES = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3,
  SAND: 4, WOOD_TOP: 5, WOOD_SIDE: 6, LEAVES: 7, WATER: 8,
};
export const NTILES = 9;

const cl = (v) => Math.max(0, Math.min(255, v | 0));

export function buildAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = TILE * NTILES;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d');

  const set = (ox, x, y, r, g, b) => { ctx.fillStyle = `rgb(${cl(r)},${cl(g)},${cl(b)})`; ctx.fillRect(ox + x, y, 1, 1); };
  const fill = (tile, r, g, b, d) => {            // noisy flat fill
    const ox = tile * TILE;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const j = (Math.random() * 2 - 1) * d;
      set(ox, x, y, r + j, g + j, b + j);
    }
  };

  fill(TILES.DIRT,  125, 90, 60, 16);
  fill(TILES.SAND,  224, 211, 160, 14);
  fill(TILES.STONE, 130, 130, 132, 16);
  fill(TILES.WATER, 46, 96, 190, 12);

  // stone cracks
  for (let i = 0; i < 10; i++) set(TILES.STONE * TILE, (Math.random()*16)|0, (Math.random()*16)|0, 95, 95, 97);

  // grass top: green with speckle
  fill(TILES.GRASS_TOP, 96, 158, 56, 20);
  for (let i = 0; i < 22; i++) set(TILES.GRASS_TOP * TILE, (Math.random()*16)|0, (Math.random()*16)|0, 70, 130, 40);

  // grass side: dirt base with jagged green cap along the top
  fill(TILES.GRASS_SIDE, 125, 90, 60, 16);
  {
    const ox = TILES.GRASS_SIDE * TILE;
    for (let x = 0; x < 16; x++) {
      const h = 3 + (Math.random() < 0.35 ? 1 : 0);
      for (let y = 0; y < h; y++) { const j = (Math.random()*2-1)*18; set(ox, x, y, 90+j, 150+j, 52+j); }
      if (Math.random() < 0.3) set(ox, x, h, 80, 140, 46);
    }
  }

  // wood side: bark with vertical streaks
  fill(TILES.WOOD_SIDE, 138, 99, 54, 8);
  {
    const ox = TILES.WOOD_SIDE * TILE;
    for (let x = 0; x < 16; x++) if (Math.random() < 0.45)
      for (let y = 0; y < 16; y++) if (Math.random() < 0.7) set(ox, x, y, 105, 72, 38);
  }

  // wood top: growth rings
  fill(TILES.WOOD_TOP, 165, 120, 70, 6);
  {
    const ox = TILES.WOOD_TOP * TILE;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
      if ((Math.hypot(x - 7.5, y - 7.5) | 0) % 2 === 0) set(ox, x, y, 135, 95, 52);
  }

  // leaves: mottled green
  fill(TILES.LEAVES, 58, 128, 44, 22);
  for (let i = 0; i < 40; i++) set(TILES.LEAVES * TILE, (Math.random()*16)|0, (Math.random()*16)|0, 38, 95, 30);
  for (let i = 0; i < 14; i++) set(TILES.LEAVES * TILE, (Math.random()*16)|0, (Math.random()*16)|0, 80, 160, 55);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;   // crisp pixels, no blur
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;                      // so tile y=0 is the top of the image
  texture.colorSpace = THREE.SRGBColorSpace;

  return { canvas, texture };
}
