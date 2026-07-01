// ============================================================
// Survival HUD: pixel-art hearts + hunger drumsticks above the
// hotbar (hidden in creative), the item-name popup shown when
// switching hotbar slots, and the damage flash / death screen.
// ============================================================

const HEART = ['011000110','111101111','111111111','111111111','011111110','001111100','000111000','000010000'];
const FOOD  = ['000111000','001111100','011111110','011111110','001111100','000111100','000001110','000000110'];

export class HUD {
  constructor() {
    this.canvas = document.getElementById('stats');
    this.ctx = this.canvas.getContext('2d');
    this.nameEl = document.getElementById('item-name');
    this.deathEl = document.getElementById('death');
    this._nameTimer = null;
  }

  setVisible(v) { this.canvas.style.display = v ? '' : 'none'; }

  _icon(bmp, dx, dy, color, halfCols) {
    const g = this.ctx;
    g.fillStyle = color;
    for (let y = 0; y < bmp.length; y++) for (let x = 0; x < 9; x++) {
      if (bmp[y][x] !== '1') continue;
      if (halfCols !== undefined && x >= halfCols) continue;
      g.fillRect(dx + x * 2, dy + y * 2, 2, 2);
    }
  }

  // health/hunger are 0..20 (2 per icon), Minecraft-style half icons.
  draw(health, hunger) {
    const g = this.ctx, W = this.canvas.width;
    g.clearRect(0, 0, W, this.canvas.height);
    for (let i = 0; i < 10; i++) {
      const dx = i * 20;
      this._icon(HEART, dx, 0, 'rgba(20,5,5,.9)');
      const v = health - i * 2;
      if (v >= 2) this._icon(HEART, dx, 0, '#e23636');
      else if (v >= 1) this._icon(HEART, dx, 0, '#e23636', 5);
    }
    for (let i = 0; i < 10; i++) {
      const dx = W - (i + 1) * 20;
      this._icon(FOOD, dx, 0, 'rgba(20,12,4,.9)');
      const v = hunger - i * 2;
      if (v >= 2) this._icon(FOOD, dx, 0, '#c17a2d');
      else if (v >= 1) this._icon(FOOD, dx, 0, '#c17a2d', 5);
    }
  }

  // Item name popup above the hotbar (fades out).
  showName(name) {
    this.nameEl.textContent = name;
    this.nameEl.style.opacity = '1';
    clearTimeout(this._nameTimer);
    this._nameTimer = setTimeout(() => { this.nameEl.style.opacity = '0'; }, 1200);
  }

  flashDamage(strength = 0.5) {
    document.body.style.boxShadow = `inset 0 0 180px rgba(200,0,0,${strength})`;
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => { document.body.style.boxShadow = 'none'; }, 350);
  }

  showDeath(v) { this.deathEl.style.display = v ? 'flex' : 'none'; }
}
