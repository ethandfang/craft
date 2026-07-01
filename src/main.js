// ============================================================
// Entry point: wires every system together and runs the loop.
//   input -> player physics -> targeting/mining -> world stream
//         -> render world -> render held item -> UI
// Survival additions: inventory, mining drops, tools, crafting,
// place-on-P, and the E inventory / crafting-table screens.
// ============================================================
import { buildAtlas, buildCrackTextures, buildCloudTexture } from './textures.js';
import { createEngine } from './engine.js';
import { Persistence } from './persistence.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Sound } from './sound.js';
import { HeldItem } from './held.js';
import { Effects } from './effects.js';
import { raycastVoxel } from './raycast.js';
import { Inventory } from './inventory.js';
import { InventoryUI } from './inventoryui.js';
import { initItems, placeBlockOf, toolInfo, itemName } from './items.js';
import { BLOCK, isReplaceable, hardnessOf, dropOf, toolFor, isUseable, AIR } from './blocks.js';
import { heightAt } from './worldgen.js';
import { CHUNK_SIZE, SEA_LEVEL } from './config.js';

const LOOK_SENS = 0.0022;
const STEP_INTERVAL = 0.32;
const DIG_INTERVAL = 0.22;

// ---- boot ----
const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');

const { canvas: atlasCanvas, texture } = buildAtlas();
initItems(atlasCanvas);
const crackTextures = buildCrackTextures();
const cloudTexture = buildCloudTexture();

const { renderer, scene, camera, materials } = createEngine(canvas, texture);
const persistence = new Persistence();
const world = new World(scene, materials, persistence);
const input = new Input(canvas, overlay);
const ui = new UI();
const sound = new Sound();
const held = new HeldItem(texture);
const effects = new Effects(scene, atlasCanvas, crackTextures, cloudTexture);

const inventory = new Inventory(36);
if (persistence.inventory) inventory.load(persistence.inventory);
else giveStarterKit();
const invUI = new InventoryUI(inventory);

input.onGesture = () => sound.unlock();

function giveStarterKit() {
  inventory.slots[0] = { id: BLOCK.GRASS, count: 32 };
  inventory.slots[1] = { id: BLOCK.STONE, count: 32 };
  inventory.slots[2] = { id: BLOCK.WOOD, count: 16 };
  inventory.slots[3] = { id: BLOCK.PLANKS, count: 8 };
  inventory.slots[4] = { id: BLOCK.CRAFTING_TABLE, count: 1 };
  inventory.slots[7] = { id: 202 /* WOOD_PICKAXE */, count: 1 };
  inventory.slots[8] = { id: 201 /* WOOD_SWORD */, count: 1 };
}

// ---- spawn ----
const SPAWN_X = 8, SPAWN_Z = 8;
const groundY = Math.max(heightAt(SPAWN_X, SPAWN_Z), SEA_LEVEL) + 2;
const player = new Player(SPAWN_X + 0.5, groundY, SPAWN_Z + 0.5);
world.ensureReady(Math.floor(SPAWN_X / CHUNK_SIZE), Math.floor(SPAWN_Z / CHUNK_SIZE), 1);

// ---- selection ----
function selectedId() { const s = inventory.selectedStack(); return s ? s.id : null; }
function select(i) {
  inventory.selected = (i + 9) % 9;
  held.setItem(selectedId());
  invUI.renderHotbar();
}
input.onSelect = (i) => { if (i < 9) select(i); };
input.onScroll = (dir) => select(inventory.selected + dir);
select(0);

function saveInventory() { persistence.recordInventory(inventory.serialize()); }

// ---- inventory / crafting-table screens ----
function openScreen(size, title) {
  invUI.openScreen(size, title);
  input.invOpen = true;
  document.exitPointerLock();
}
function closeScreen() {
  invUI.closeScreen();
  input.invOpen = false;
  held.setItem(selectedId());
  saveInventory();
  canvas.requestPointerLock();
}
input.onToggleInv = () => {
  if (invUI.open) closeScreen();
  else openScreen(2, 'Inventory');
};

// ---- placement (right-click / P) ----
input.onPlace = () => {
  if (invUI.open) return;
  const hit = raycastVoxel(world, player.eye, player.lookDir());
  if (!hit) return;

  // Using a crafting table opens its 3x3 grid (unless sneaking to place against it).
  if (isUseable(hit.id) && !input.key('ShiftLeft')) { openScreen(3, 'Crafting Table'); return; }

  const sel = inventory.selectedStack();
  if (!sel) return;
  const blockId = placeBlockOf(sel.id);
  if (blockId == null) return;                 // holding a tool -> nothing to place

  const nx = hit.x + hit.normal[0], ny = hit.y + hit.normal[1], nz = hit.z + hit.normal[2];
  if (!isReplaceable(world.getBlock(nx, ny, nz))) return;
  if (player.overlapsBlock(nx, ny, nz)) return;

  world.setBlock(nx, ny, nz, blockId);
  inventory.removeOne(inventory.selected);
  held.setItem(selectedId());
  invUI.renderHotbar();
  saveInventory();
  sound.place();
  held.triggerSwing();
};

// ---- mining state ----
let mineTarget = null, mineProgress = 0, digTimer = 0, stepTimer = 0;

// Effective seconds to break, factoring in the right tool.
function breakTime(id) {
  const base = hardnessOf(id);
  const sel = inventory.selectedStack();
  const t = sel ? toolInfo(sel.id) : null;
  if (t && t.kind === 'pickaxe' && toolFor(id) === 'pickaxe') return base / t.speed;
  return base;
}

// ---- game loop ----
let last = performance.now();
let fps = 0, frames = 0, fpsAccum = 0;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (!invUI.open) {
    const look = input.consumeLook();
    player.addLook(look.dx * LOOK_SENS, look.dy * LOOK_SENS);
    player.update(dt, input, world);

    const eye = player.eye;
    camera.position.copy(eye);
    const dir = player.lookDir();
    camera.lookAt(eye.x + dir.x, eye.y + dir.y, eye.z + dir.z);

    const target = raycastVoxel(world, eye, dir);
    effects.setTarget(target);

    if (input.isMining() && target) {
      const tk = target.x + ',' + target.y + ',' + target.z;
      if (tk !== mineTarget) { mineTarget = tk; mineProgress = 0; digTimer = DIG_INTERVAL; }
      mineProgress += dt / Math.max(0.05, breakTime(target.id));
      digTimer += dt;
      if (digTimer >= DIG_INTERVAL) { sound.dig(); held.triggerSwing(); digTimer = 0; }
      if (mineProgress >= 1) {
        const drop = dropOf(target.id);
        if (drop !== AIR) inventory.add(drop, 1);
        world.setBlock(target.x, target.y, target.z, 0);
        effects.spawnBreak(target.x, target.y, target.z, target.id);
        sound.break();
        invUI.renderHotbar(); saveInventory();
        mineProgress = 0; mineTarget = null; effects.setCrack(null, -1);
      } else {
        effects.setCrack(target, Math.floor(mineProgress * 10));
      }
    } else {
      mineProgress = 0; mineTarget = null; effects.setCrack(null, -1);
    }

    const moving = input.key('KeyW') || input.key('KeyA') || input.key('KeyS') || input.key('KeyD');
    held.setItem(selectedId());
    held.update(dt, moving);
    if (moving && player.onGround) { stepTimer += dt; if (stepTimer >= STEP_INTERVAL) { sound.step(); stepTimer = 0; } }
    else stepTimer = STEP_INTERVAL;
  } else {
    effects.setTarget(null); effects.setCrack(null, -1);
    held.update(dt, false);
  }

  world.update(player.pos);
  effects.update(dt, player.pos);

  renderer.clear();
  renderer.render(scene, camera);
  held.render(renderer);

  persistence.tick(dt);

  frames++; fpsAccum += dt;
  if (fpsAccum >= 0.5) { fps = Math.round(frames / fpsAccum); frames = 0; fpsAccum = 0; }
  const p = player.pos, sel = inventory.selectedStack();
  ui.setDebug(
    `FPS ${fps}  |  XYZ ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  |  ` +
    `chunks ${world.loadedChunkCount()}  |  ${sel ? itemName(sel.id) + ' x' + sel.count : 'empty hand'}`
  );

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
