// ============================================================
// Input: keyboard state, pointer-lock mouse look, block
// break/place buttons, and hotbar selection. Game logic reads
// key() and assigns the on* callbacks (see main.js).
// ============================================================
export class Input {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.keys = new Set();
    this.look = { dx: 0, dy: 0 };  // accumulated mouse delta, consumed each frame
    this.locked = false;

    // Callbacks wired up by main.js.
    this.onBreak = null;   // ()
    this.onPlace = null;   // ()
    this.onSelect = null;  // (index) — absolute slot
    this.onScroll = null;  // (dir: -1 | +1)

    this._bind();
  }

  key(code) { return this.keys.has(code); }

  consumeLook() { const l = this.look; this.look = { dx: 0, dy: 0 }; return l; }

  _bind() {
    const { canvas, overlay } = this;

    overlay.addEventListener('click', () => canvas.requestPointerLock());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      overlay.style.display = this.locked ? 'none' : 'flex';
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.look.dx += e.movementX;
      this.look.dy += e.movementY;
    });

    // pointerdown fires reliably for the right button on mice AND trackpads.
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.locked) return;
      if (e.button === 0 && this.onBreak) this.onBreak();
      else if (e.button === 2 && this.onPlace) this.onPlace();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code.startsWith('Digit')) {
        const n = +e.code.slice(5) - 1;
        if (n >= 0 && this.onSelect) this.onSelect(n);
      }
      if (e.code === 'Space') e.preventDefault(); // stop page scroll
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));

    addEventListener('wheel', (e) => {
      if (this.onScroll) this.onScroll(e.deltaY > 0 ? 1 : -1);
    }, { passive: true });
  }
}
