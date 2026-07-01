// ============================================================
// UI: builds the hotbar from block definitions (icons drawn from
// the texture atlas) and updates the debug readout.
// ============================================================
import { HOTBAR, getDef, tileForFace } from './blocks.js';
import { TILE } from './textures.js';

export class UI {
  constructor(atlasCanvas) {
    this.atlas = atlasCanvas;
    this.hotbarEl = document.getElementById('hotbar');
    this.debugEl = document.getElementById('debug');
    this.slots = [];
    this._buildHotbar();
  }

  _buildHotbar() {
    HOTBAR.forEach((id, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';

      const icon = document.createElement('canvas');
      icon.width = icon.height = 32;
      const ictx = icon.getContext('2d');
      ictx.imageSmoothingEnabled = false;
      const tile = tileForFace(id, 'top');
      ictx.drawImage(this.atlas, tile * TILE, 0, TILE, TILE, 0, 0, 32, 32);

      const label = document.createElement('span');
      label.className = 'num';
      label.textContent = i + 1;

      slot.appendChild(icon);
      slot.appendChild(label);
      slot.title = getDef(id).name;
      this.hotbarEl.appendChild(slot);
      this.slots.push(slot);
    });
  }

  setSelected(i) {
    this.slots.forEach((s, k) => s.classList.toggle('sel', k === i));
  }

  setDebug(text) { this.debugEl.textContent = text; }
}
