// ============================================================
// Inventory UI: the always-on hotbar plus the openable inventory
// screen with a crafting grid. Item movement uses the classic
// Minecraft "cursor stack" model (click to pick up / drop / split).
// ============================================================
import { drawItemIcon, maxStack } from './items.js';
import { matchRecipe } from './crafting.js';

const SLOT = 44;
const ICON = 34;

export class InventoryUI {
  constructor(inventory) {
    this.inv = inventory;
    this.cursor = null;         // held stack {id,count}
    this.craft = new Array(9).fill(null);
    this.craftSize = 2;
    this.output = null;
    this.open = false;

    this.hotbarEls = [];
    this.invEls = [];
    this.craftEls = [];
    this._build();
    this._bindMouse();
    this.renderHotbar();
  }

  // ---------- DOM construction ----------
  _slot(cls) {
    const c = document.createElement('canvas');
    c.width = c.height = SLOT;
    c.className = 'iv-slot ' + (cls || '');
    return c;
  }

  _build() {
    // bottom hotbar (display mirror of slots 0..8)
    const hb = document.getElementById('hotbar');
    hb.innerHTML = '';
    for (let i = 0; i < 9; i++) { const s = this._slot('hb'); hb.appendChild(s); this.hotbarEls.push(s); }

    // inventory panel
    const panel = document.createElement('div');
    panel.id = 'inventory';
    panel.style.display = 'none';
    panel.innerHTML = '<div class="iv-title" id="iv-title">Crafting</div>';

    // crafting row: grid + arrow + output
    const craftRow = document.createElement('div'); craftRow.className = 'iv-craftrow';
    const cgrid = document.createElement('div'); cgrid.id = 'iv-craftgrid'; cgrid.className = 'iv-grid';
    for (let i = 0; i < 9; i++) {
      const s = this._slot('craft'); s.dataset.area = 'craft'; s.dataset.index = i;
      cgrid.appendChild(s); this.craftEls.push(s);
    }
    const arrow = document.createElement('div'); arrow.className = 'iv-arrow'; arrow.textContent = '→';
    this.outputEl = this._slot('output'); this.outputEl.dataset.area = 'output'; this.outputEl.dataset.index = 0;
    craftRow.append(cgrid, arrow, this.outputEl);
    panel.appendChild(craftRow);

    // main inventory (slots 9..35) then hotbar row (0..8)
    const main = document.createElement('div'); main.className = 'iv-grid iv-main';
    for (let i = 9; i < 36; i++) { const s = this._slot(); s.dataset.area = 'inv'; s.dataset.index = i; main.appendChild(s); this.invEls[i] = s; }
    panel.appendChild(main);
    const row = document.createElement('div'); row.className = 'iv-grid iv-hotrow';
    for (let i = 0; i < 9; i++) { const s = this._slot(); s.dataset.area = 'inv'; s.dataset.index = i; row.appendChild(s); this.invEls[i] = s; }
    panel.appendChild(row);

    document.body.appendChild(panel);
    this.panel = panel;

    // floating cursor stack
    this.cursorEl = this._slot('cursor');
    this.cursorEl.id = 'iv-cursor';
    this.cursorEl.style.display = 'none';
    document.body.appendChild(this.cursorEl);
  }

  _bindMouse() {
    const onClick = (e) => {
      const t = e.target;
      if (!t.dataset || !t.dataset.area) return;
      e.preventDefault();
      this._handle(t.dataset.area, +t.dataset.index, e.button);
    };
    this.panel.addEventListener('mousedown', onClick);
    this.panel.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      this.mouse = { x: e.clientX, y: e.clientY };
      if (this.open && this.cursor) {
        this.cursorEl.style.left = (e.clientX - SLOT / 2) + 'px';
        this.cursorEl.style.top = (e.clientY - SLOT / 2) + 'px';
      }
    });
  }

  // ---------- stack access ----------
  _get(area, i) { return area === 'inv' ? this.inv.slots[i] : area === 'craft' ? this.craft[i] : this.output; }
  _set(area, i, v) { if (area === 'inv') this.inv.slots[i] = v; else if (area === 'craft') this.craft[i] = v; }

  // ---------- interaction ----------
  _handle(area, index, button) {
    if (area === 'output') { this._takeOutput(); this._afterChange(); return; }

    const slot = this._get(area, index);
    if (button === 2) {
      // right click: split / drop one
      if (!this.cursor) {
        if (slot) { const half = Math.ceil(slot.count / 2); this.cursor = { id: slot.id, count: half }; slot.count -= half; if (slot.count <= 0) this._set(area, index, null); }
      } else if (!slot) {
        this._set(area, index, { id: this.cursor.id, count: 1 }); if (--this.cursor.count <= 0) this.cursor = null;
      } else if (slot.id === this.cursor.id && slot.count < maxStack(slot.id)) {
        slot.count++; if (--this.cursor.count <= 0) this.cursor = null;
      }
    } else {
      // left click: pick up / drop / merge / swap
      if (!this.cursor) {
        if (slot) { this.cursor = slot; this._set(area, index, null); }
      } else if (!slot) {
        this._set(area, index, this.cursor); this.cursor = null;
      } else if (slot.id === this.cursor.id) {
        const cap = maxStack(slot.id), n = Math.min(cap - slot.count, this.cursor.count);
        slot.count += n; this.cursor.count -= n; if (this.cursor.count <= 0) this.cursor = null;
      } else {
        const tmp = slot; this._set(area, index, this.cursor); this.cursor = tmp;
      }
    }
    this._afterChange();
  }

  _takeOutput() {
    if (!this.output) return;
    const out = this.output;
    if (this.cursor && (this.cursor.id !== out.id || this.cursor.count + out.count > maxStack(out.id))) return;
    if (this.cursor) this.cursor.count += out.count;
    else this.cursor = { id: out.id, count: out.count };
    // consume one of each ingredient (grid is stored in a 3-wide layout)
    const n = this.craftSize;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const idx = r * 3 + c, s = this.craft[idx];
      if (s) { s.count--; if (s.count <= 0) this.craft[idx] = null; }
    }
  }

  _recompute() {
    const n = this.craftSize;
    const ids = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const s = this.craft[r * 3 + c]; ids.push(s ? s.id : 0); }
    this.output = matchRecipe(ids, n);
  }

  _afterChange() { this._recompute(); this.renderAll(); }

  // ---------- open / close ----------
  openScreen(size, title) {
    this.craftSize = size;
    for (let i = 0; i < 9; i++) this.craft[i] = null;
    document.getElementById('iv-title').textContent = title;
    // lay out craft grid for this size
    const cgrid = document.getElementById('iv-craftgrid');
    cgrid.style.gridTemplateColumns = `repeat(${size}, ${SLOT}px)`;
    this.craftEls.forEach((el, i) => {
      const rr = Math.floor(i / 3), cc = i % 3;
      el.style.display = (rr < size && cc < size) ? '' : 'none';
      el.dataset.index = rr * 3 + cc;
    });
    this.open = true;
    this.panel.style.display = 'flex';
    this._afterChange();
  }

  closeScreen() {
    // return crafting items + cursor to the inventory
    for (let i = 0; i < 9; i++) { const s = this.craft[i]; if (s) { this.inv.add(s.id, s.count); this.craft[i] = null; } }
    if (this.cursor) { this.inv.add(this.cursor.id, this.cursor.count); this.cursor = null; }
    this.open = false;
    this.panel.style.display = 'none';
    this.cursorEl.style.display = 'none';
    this.renderHotbar();
  }

  // ---------- rendering ----------
  _drawSlot(canvas, stack) {
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, SLOT, SLOT);
    if (!stack) return;
    const pad = (SLOT - ICON) / 2;
    drawItemIcon(g, stack.id, pad, pad, ICON);
    if (stack.count > 1) {
      g.font = 'bold 14px monospace'; g.textAlign = 'right';
      g.fillStyle = '#000'; g.fillText(stack.count, SLOT - 3, SLOT - 4);
      g.fillStyle = '#fff'; g.fillText(stack.count, SLOT - 4, SLOT - 5);
    }
  }

  renderHotbar() {
    for (let i = 0; i < 9; i++) {
      this._drawSlot(this.hotbarEls[i], this.inv.slots[i]);
      this.hotbarEls[i].classList.toggle('sel', i === this.inv.selected);
    }
  }

  renderAll() {
    this.renderHotbar();
    if (!this.open) return;
    for (let i = 0; i < 36; i++) this._drawSlot(this.invEls[i], this.inv.slots[i]);
    for (let i = 0; i < 9; i++) this._drawSlot(this.craftEls[i], this.craft[i]);
    this._drawSlot(this.outputEl, this.output);
    if (this.cursor) { this.cursorEl.style.display = ''; this._drawSlot(this.cursorEl, this.cursor); }
    else this.cursorEl.style.display = 'none';
  }
}
