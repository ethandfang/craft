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
    this.buttons = new Set();      // mouse buttons currently held
    this.look = { dx: 0, dy: 0 };  // accumulated mouse delta, consumed each frame
    this.locked = false;
    this.invOpen = false;  // set by main; suppresses the click-to-play overlay

    // Callbacks wired up by main.js.
    this.onPlace = null;   // () — right-click / P edge
    this.onSelect = null;  // (index) — absolute slot
    this.onScroll = null;  // (dir: -1 | +1)
    this.onGesture = null; // () — first interaction (used to unlock audio)
    this.onToggleInv = null; // () — E / Esc
    this.onToggleFly = null; // () — double-tap Space
    this.onToggleMode = null; // () — G key (creative <-> survival)
    this._lastSpace = 0;
    this._lastW = 0;
    this.sprintLatch = false; // set by double-tap W, cleared on W release

    this._bind();
  }

  key(code) { return this.keys.has(code); }
  // True while the player is holding left mouse with the pointer locked (mining).
  isMining() { return this.locked && this.buttons.has(0); }

  consumeLook() { const l = this.look; this.look = { dx: 0, dy: 0 }; return l; }

  _bind() {
    const { canvas, overlay } = this;

    overlay.addEventListener('click', () => {
      canvas.requestPointerLock();
      if (this.onGesture) this.onGesture();   // unlock AudioContext on a user gesture
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      // Don't show the "click to play" overlay while the inventory is open.
      overlay.style.display = (this.locked || this.invOpen) ? 'none' : 'flex';
      if (!this.locked) this.buttons.clear();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.look.dx += e.movementX;
      this.look.dy += e.movementY;
    });

    // pointerdown fires reliably for the right button on mice AND trackpads.
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.locked) return;
      this.buttons.add(e.button);
      if (e.button === 2 && this.onPlace) this.onPlace(); // place is a single edge action
    });
    canvas.addEventListener('pointerup', (e) => this.buttons.delete(e.button));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code.startsWith('Digit')) {
        const n = +e.code.slice(5) - 1;
        if (n >= 0 && this.onSelect) this.onSelect(n);
      }
      if ((e.code === 'KeyE') && this.onToggleInv) this.onToggleInv();
      if (e.code === 'Escape' && this.invOpen && this.onToggleInv) this.onToggleInv();
      if (e.code === 'KeyP' && this.onPlace) this.onPlace(); // alternate place key
      if (e.code === 'KeyG' && !e.repeat && this.onToggleMode) this.onToggleMode();
      if (e.code === 'Space' && !e.repeat) {                 // double-tap -> toggle fly
        const t = performance.now();
        if (t - this._lastSpace < 300 && this.onToggleFly) this.onToggleFly();
        this._lastSpace = t;
      }
      if (e.code === 'KeyW' && !e.repeat) {                  // double-tap W -> sprint
        const t = performance.now();
        if (t - this._lastW < 300) this.sprintLatch = true;
        this._lastW = t;
      }
      if (e.code === 'Space') e.preventDefault(); // stop page scroll
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyW') this.sprintLatch = false;
    });

    addEventListener('wheel', (e) => {
      if (this.onScroll) this.onScroll(e.deltaY > 0 ? 1 : -1);
    }, { passive: true });
  }
}
