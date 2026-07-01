// ============================================================
// Entry point: wires every system together and runs the loop.
//
// Game modes (G to toggle):
//   creative — fly (double-tap Space), instant break, infinite
//              blocks, catalog inventory, no health/hunger
//   survival — hold-to-mine with drops, crafting, health/hunger,
//              fall damage, death screen
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
import { Sky } from './sky.js';
import { HUD } from './hud.js';
import { raycastVoxel } from './raycast.js';
import { Inventory } from './inventory.js';
import { InventoryUI } from './inventoryui.js';
import { initItems, placeBlockOf, toolInfo, itemName, ITEM } from './items.js';
import { BLOCK, isReplaceable, hardnessOf, dropOf, toolFor, isUseable, AIR } from './blocks.js';
import { heightAt } from './worldgen.js';
import { CHUNK_SIZE, SEA_LEVEL } from './config.js';

const LOOK_SENS = 0.0022;
const STEP_INTERVAL = 0.32;
const DIG_INTERVAL = 0.22;
const CREATIVE_BREAK_INTERVAL = 0.2; // continuous instant-break rate
const BASE_FOV = 75;

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
const sky = new Sky(scene);
const hud = new HUD();

const inventory = new Inventory(36);
if (persistence.inventory) inventory.load(persistence.inventory);
else giveStarterKit();
const invUI = new InventoryUI(inventory);

input.onGesture = () => sound.unlock();

function giveStarterKit() {
  inventory.slots[0] = { id: BLOCK.GRASS, count: 64 };
  inventory.slots[1] = { id: BLOCK.STONE, count: 64 };
  inventory.slots[2] = { id: BLOCK.WOOD, count: 16 };
  inventory.slots[3] = { id: BLOCK.PLANKS, count: 16 };
  inventory.slots[4] = { id: BLOCK.CRAFTING_TABLE, count: 1 };
  inventory.slots[7] = { id: ITEM.WOOD_PICKAXE, count: 1 };
  inventory.slots[8] = { id: ITEM.WOOD_SWORD, count: 1 };
}

// Everything obtainable in the creative catalog.
const CATALOG = [
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.SAND, BLOCK.SNOW,
  BLOCK.WOOD, BLOCK.PLANKS, BLOCK.LEAVES, BLOCK.CRAFTING_TABLE,
  BLOCK.COAL_ORE, BLOCK.IRON_ORE, BLOCK.WATER, BLOCK.TALL_GRASS, BLOCK.FLOWER,
  ITEM.STICK, ITEM.WOOD_SWORD, ITEM.WOOD_PICKAXE, ITEM.STONE_SWORD, ITEM.STONE_PICKAXE,
];

// ---- game mode ----
let mode = 'creative';   // start in creative (G to switch)
const isCreative = () => mode === 'creative';
function setMode(m) {
  mode = m;
  if (!isCreative()) player.flying = false;
  hud.setVisible(!isCreative());
  hud.showName(mode === 'creative' ? 'Creative Mode' : 'Survival Mode');
}

// ---- survival stats ----
const stats = { health: 20, hunger: 20 };
let dead = false;
let peakY = 0;           // fall-damage tracking

function damage(n) {
  if (isCreative() || dead || n <= 0) return;
  stats.health = Math.max(0, stats.health - n);
  hud.flashDamage(Math.min(0.7, 0.25 + n * 0.05));
  sound.hurt();
  if (stats.health <= 0) die();
}
function die() {
  dead = true;
  hud.showDeath(true);
  document.exitPointerLock();
}
function respawn() {
  dead = false;
  stats.health = 20; stats.hunger = 20;
  player.pos.set(SPAWN_X + 0.5, groundY, SPAWN_Z + 0.5);
  player.vel.set(0, 0, 0);
  peakY = player.pos.y;
  hud.showDeath(false);
  canvas.requestPointerLock();
}
document.getElementById('respawn').addEventListener('click', respawn);

// ---- spawn ----
const SPAWN_X = 8, SPAWN_Z = 8;
const groundY = Math.max(heightAt(SPAWN_X, SPAWN_Z), SEA_LEVEL) + 2;
const player = new Player(SPAWN_X + 0.5, groundY, SPAWN_Z + 0.5);
peakY = player.pos.y;
world.ensureReady(Math.floor(SPAWN_X / CHUNK_SIZE), Math.floor(SPAWN_Z / CHUNK_SIZE), 1);
setMode(mode);

// ---- selection ----
function selectedId() { const s = inventory.selectedStack(); return s ? s.id : null; }
function select(i) {
  inventory.selected = (i + 9) % 9;
  held.setItem(selectedId());
  invUI.renderHotbar();
  const s = inventory.selectedStack();
  if (s) hud.showName(itemName(s.id));
}
input.onSelect = (i) => { if (i < 9) select(i); };
input.onScroll = (dir) => select(inventory.selected + dir);
select(0);

function saveInventory() { persistence.recordInventory(inventory.serialize()); }

// ---- screens ----
function openScreen(fn) {
  fn();
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
  if (dead) return;
  if (invUI.open) closeScreen();
  else if (isCreative()) openScreen(() => invUI.openCatalog(CATALOG));
  else openScreen(() => invUI.openScreen(2, 'Inventory'));
};
input.onToggleFly = () => { if (isCreative() && !invUI.open && !dead) player.toggleFly(); };
input.onToggleMode = () => { if (!invUI.open && !dead) setMode(isCreative() ? 'survival' : 'creative'); };

// ---- placement (right-click / P) ----
input.onPlace = () => {
  if (invUI.open || dead) return;
  const hit = raycastVoxel(world, player.eye, player.lookDir());
  if (!hit) return;

  // Use a crafting table (3x3) unless sneaking to place against it.
  if (isUseable(hit.id) && !input.key('ShiftLeft')) {
    openScreen(() => invUI.openScreen(3, 'Crafting Table'));
    return;
  }

  const sel = inventory.selectedStack();
  if (!sel) return;
  const blockId = placeBlockOf(sel.id);
  if (blockId == null) return;

  const nx = hit.x + hit.normal[0], ny = hit.y + hit.normal[1], nz = hit.z + hit.normal[2];
  if (!isReplaceable(world.getBlock(nx, ny, nz))) return;
  if (player.overlapsBlock(nx, ny, nz)) return;

  world.setBlock(nx, ny, nz, blockId);
  if (!isCreative()) {                       // creative = infinite blocks
    inventory.removeOne(inventory.selected);
    held.setItem(selectedId());
    invUI.renderHotbar();
    saveInventory();
  }
  sound.place();
  held.triggerSwing();
};

// ---- mining state ----
let mineTarget = null, mineProgress = 0, digTimer = 0, stepTimer = 0, creativeBreakTimer = 0;

function breakTime(id) {
  const base = hardnessOf(id);
  const sel = inventory.selectedStack();
  const t = sel ? toolInfo(sel.id) : null;
  if (t && t.kind === 'pickaxe' && toolFor(id) === 'pickaxe') return base / t.speed;
  return base;
}

function breakBlock(target) {
  if (!isCreative()) {
    const drop = dropOf(target.id);
    if (drop !== AIR) inventory.add(drop, 1);
    invUI.renderHotbar();
    saveInventory();
  }
  world.setBlock(target.x, target.y, target.z, 0);
  effects.spawnBreak(target.x, target.y, target.z, target.id);
  sound.break();
  held.triggerSwing();
}

// ---- game loop ----
let last = performance.now();
let fps = 0, frames = 0, fpsAccum = 0;
let bobPhase = 0;
const waterTint = document.getElementById('water-tint');
const baseFogNear = scene.fog.near, baseFogFar = scene.fog.far;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  const playing = !invUI.open && !dead;

  if (playing) {
    const look = input.consumeLook();
    player.addLook(look.dx * LOOK_SENS, look.dy * LOOK_SENS);
    const wasGround = player.onGround;
    player.update(dt, input, world);

    // fall damage (survival, not flying, water cancels)
    if (player.inWater || player.flying) peakY = player.pos.y;
    else if (!player.onGround) peakY = Math.max(peakY, player.pos.y);
    if (player.onGround && !wasGround && !player.inWater && !player.flying) {
      const fall = peakY - player.pos.y;
      if (fall > 3.2) damage(Math.round(fall - 3));
      peakY = player.pos.y;
    }
    if (player.onGround) peakY = player.pos.y;

    // hunger / regen / starvation (survival only)
    if (!isCreative()) {
      stats.hunger = Math.max(0, stats.hunger - dt * (0.02 + (player.sprinting ? 0.06 : 0)));
      if (stats.hunger > 17 && stats.health < 20) stats.health = Math.min(20, stats.health + dt * 0.5);
      else if (stats.hunger <= 0) { stats.health = Math.max(0, stats.health - dt * 0.5); if (stats.health <= 0 && !dead) die(); }
    }

    // targeting + mining
    const target = raycastVoxel(world, player.eye, player.lookDir());
    effects.setTarget(target);

    if (input.isMining() && target) {
      if (isCreative()) {
        creativeBreakTimer += dt;
        const tk = target.x + ',' + target.y + ',' + target.z;
        if (tk !== mineTarget || creativeBreakTimer >= CREATIVE_BREAK_INTERVAL) {
          mineTarget = tk; creativeBreakTimer = 0;
          breakBlock(target);
        }
        effects.setCrack(null, -1);
      } else {
        const tk = target.x + ',' + target.y + ',' + target.z;
        if (tk !== mineTarget) { mineTarget = tk; mineProgress = 0; digTimer = DIG_INTERVAL; }
        mineProgress += dt / Math.max(0.05, breakTime(target.id));
        digTimer += dt;
        if (digTimer >= DIG_INTERVAL) { sound.dig(); held.triggerSwing(); digTimer = 0; }
        if (mineProgress >= 1) {
          breakBlock(target);
          mineProgress = 0; mineTarget = null; effects.setCrack(null, -1);
        } else {
          effects.setCrack(target, Math.floor(mineProgress * 10));
        }
      }
    } else {
      mineProgress = 0; mineTarget = null; creativeBreakTimer = CREATIVE_BREAK_INTERVAL;
      effects.setCrack(null, -1);
    }

    // held item + footsteps
    const moving = input.key('KeyW') || input.key('KeyA') || input.key('KeyS') || input.key('KeyD');
    held.setItem(selectedId());
    held.update(dt, moving);
    if (moving && player.onGround && !player.inWater) {
      stepTimer += dt;
      const interval = player.sprinting ? STEP_INTERVAL * 0.7 : STEP_INTERVAL;
      if (stepTimer >= interval) { sound.step(); stepTimer = 0; }
      bobPhase += dt * (player.sprinting ? 11 : 8);
    } else { stepTimer = STEP_INTERVAL; }
  } else {
    effects.setTarget(null); effects.setCrack(null, -1);
    held.update(dt, false);
  }

  // camera (with view bob + sprint/fly FOV)
  const eye = player.eye;
  camera.position.copy(eye);
  camera.position.y += Math.abs(Math.sin(bobPhase)) * 0.05;
  const dir = player.lookDir();
  camera.lookAt(camera.position.x + dir.x, camera.position.y + dir.y, camera.position.z + dir.z);
  const targetFov = BASE_FOV + (player.flying ? 8 : player.sprinting ? 6 : 0);
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10);
    camera.updateProjectionMatrix();
  }

  // world + effects + sky
  world.update(player.pos);
  effects.update(dt, player.pos);
  sky.update(dt, camera.position, scene, materials);

  // underwater tint + fog override (after sky sets colors)
  if (player.eyeInWater) {
    waterTint.style.display = '';
    scene.fog.color.setHex(0x2a5aa0);
    scene.fog.near = 1; scene.fog.far = 22;
  } else {
    waterTint.style.display = 'none';
    scene.fog.near = baseFogNear; scene.fog.far = baseFogFar;
  }

  renderer.clear();
  renderer.render(scene, camera);
  held.render(renderer);

  if (!isCreative()) hud.draw(stats.health, stats.hunger);
  persistence.tick(dt);

  frames++; fpsAccum += dt;
  if (fpsAccum >= 0.5) { fps = Math.round(frames / fpsAccum); frames = 0; fpsAccum = 0; }
  const p = player.pos, sel = inventory.selectedStack();
  ui.setDebug(
    `FPS ${fps}  |  ${mode.toUpperCase()}${player.flying ? ' · FLYING' : ''}${player.inWater ? ' · SWIMMING' : ''}  |  ` +
    `XYZ ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  |  chunks ${world.loadedChunkCount()}  |  ` +
    `${sel ? itemName(sel.id) + (isCreative() ? '' : ' x' + sel.count) : 'empty hand'}`
  );

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
