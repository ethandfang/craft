// ============================================================
// Entry point: wires every system together and runs the loop.
//   input -> player physics -> world streaming -> render -> UI
// ============================================================
import * as THREE from 'three';
import { buildAtlas } from './textures.js';
import { createEngine } from './engine.js';
import { Persistence } from './persistence.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { raycastVoxel } from './raycast.js';
import { HOTBAR, isReplaceable, getDef } from './blocks.js';
import { heightAt } from './worldgen.js';
import { CHUNK_SIZE, SEA_LEVEL } from './config.js';

const LOOK_SENS = 0.0022;

// ---- boot ----
const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');

const { canvas: atlasCanvas, texture } = buildAtlas();
const { renderer, scene, camera, materials } = createEngine(canvas, texture);

const persistence = new Persistence();
const world = new World(scene, materials, persistence);
const input = new Input(canvas, overlay);
const ui = new UI(atlasCanvas);

// ---- spawn ----
const SPAWN_X = 8, SPAWN_Z = 8;
const groundY = Math.max(heightAt(SPAWN_X, SPAWN_Z), SEA_LEVEL) + 2;
const player = new Player(SPAWN_X + 0.5, groundY, SPAWN_Z + 0.5);
// Prepare the chunks under/around spawn synchronously so we land on solid ground.
world.ensureReady(Math.floor(SPAWN_X / CHUNK_SIZE), Math.floor(SPAWN_Z / CHUNK_SIZE), 1);

// ---- hotbar selection ----
let selected = 0;
ui.setSelected(selected);
function select(i) { selected = (i + HOTBAR.length) % HOTBAR.length; ui.setSelected(selected); }
input.onSelect = (i) => { if (i < HOTBAR.length) select(i); };
input.onScroll = (dir) => select(selected + dir);

// ---- block break / place (this is the part that must land on the right cell) ----
input.onBreak = () => {
  const hit = raycastVoxel(world, player.eye, player.lookDir());
  if (hit) world.setBlock(hit.x, hit.y, hit.z, 0);
};
input.onPlace = () => {
  const hit = raycastVoxel(world, player.eye, player.lookDir());
  if (!hit) return;
  // Place in the neighbor cell on the face we're looking at.
  const nx = hit.x + hit.normal[0];
  const ny = hit.y + hit.normal[1];
  const nz = hit.z + hit.normal[2];
  if (!isReplaceable(world.getBlock(nx, ny, nz))) return; // must be air/water
  if (player.overlapsBlock(nx, ny, nz)) return;           // don't place inside yourself
  world.setBlock(nx, ny, nz, HOTBAR[selected]);
};

// ---- game loop ----
let last = performance.now();
let fps = 0, frames = 0, fpsAccum = 0;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  const look = input.consumeLook();
  player.addLook(look.dx * LOOK_SENS, look.dy * LOOK_SENS);
  player.update(dt, input, world);

  const eye = player.eye;
  camera.position.copy(eye);
  const d = player.lookDir();
  camera.lookAt(eye.x + d.x, eye.y + d.y, eye.z + d.z);

  world.update(player.pos);
  renderer.render(scene, camera);
  persistence.tick(dt);

  // debug readout
  frames++; fpsAccum += dt;
  if (fpsAccum >= 0.5) { fps = Math.round(frames / fpsAccum); frames = 0; fpsAccum = 0; }
  const p = player.pos;
  ui.setDebug(
    `FPS ${fps}  |  XYZ ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  |  ` +
    `chunks ${world.loadedChunkCount()}  |  holding ${getDef(HOTBAR[selected]).name}`
  );

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
