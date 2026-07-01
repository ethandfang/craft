// ============================================================
// UI: debug readout in the corner. The hotbar and inventory
// screen are handled by inventoryui.js.
// ============================================================
export class UI {
  constructor() {
    this.debugEl = document.getElementById('debug');
  }
  setDebug(text) { this.debugEl.textContent = text; }
}
