// ============================================================
// Player: first-person controller with gravity and swept-AABB
// collision resolved one axis at a time against the voxel world.
// pos = feet position (bottom-center of the collision box).
//
// Movement states (Minecraft-style):
//   walk 4.3 b/s · sprint (Ctrl or double-tap W) 1.3x · sneak (Shift) 0.3x
//   swim: buoyant, Space to rise · fly (creative): no gravity, Space/Shift
// ============================================================
import * as THREE from 'three';
import {
  GRAVITY, JUMP_SPEED, WALK_SPEED, SPRINT_MULT, SNEAK_MULT,
  FLY_VSPEED, FLY_HMULT,
} from './config.js';
import { isSolid, BLOCK } from './blocks.js';

export class Player {
  constructor(x, y, z) {
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.flying = false;
    this.sprinting = false;
    this.sneaking = false;
    this.inWater = false;      // feet submerged
    this.eyeInWater = false;   // camera submerged (underwater tint)
    this.width = 0.6;
    this.height = 1.8;
    this.eyeHeight = 1.62;
  }

  get eye() { return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z); }

  lookDir() {
    return new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
       Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)).normalize();
  }

  addLook(dYaw, dPitch) {
    this.yaw -= dYaw;
    this.pitch -= dPitch;
    const lim = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  toggleFly() { this.flying = !this.flying; this.vel.set(0, 0, 0); }

  overlapsBlock(bx, by, bz) {
    const w = this.width / 2, p = this.pos;
    return (bx + 1 > p.x - w && bx < p.x + w) &&
           (bz + 1 > p.z - w && bz < p.z + w) &&
           (by + 1 > p.y && by < p.y + this.height);
  }

  update(dt, input, world) {
    // --- state from environment + keys ---
    this.inWater = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.3), Math.floor(this.pos.z)) === BLOCK.WATER;
    this.eyeInWater = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + this.eyeHeight), Math.floor(this.pos.z)) === BLOCK.WATER;
    this.sneaking = !this.flying && input.key('ShiftLeft');
    // Sneak lowers the camera slightly (Minecraft does ~0.35 down).
    this.eyeHeight = this.sneaking ? 1.5 : 1.62;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let fx = 0, fz = 0;
    const fwd = input.key('KeyW');
    if (fwd) { fx -= sin; fz -= cos; }
    if (input.key('KeyS')) { fx += sin; fz += cos; }
    if (input.key('KeyA')) { fx -= cos; fz += sin; }
    if (input.key('KeyD')) { fx += cos; fz -= sin; }

    // Sprint: Ctrl or double-tap-W latch, only while moving forward, never sneaking.
    this.sprinting = fwd && !this.sneaking &&
      (input.key('ControlLeft') || input.key('ControlRight') || input.sprintLatch) &&
      (fx !== 0 || fz !== 0);

    if (fx || fz) {
      const len = Math.hypot(fx, fz);
      let speed = WALK_SPEED;
      if (this.flying) speed = WALK_SPEED * FLY_HMULT;
      else if (this.sneaking) speed = WALK_SPEED * SNEAK_MULT;
      else if (this.sprinting) speed = WALK_SPEED * SPRINT_MULT;
      if (this.inWater && !this.flying) speed *= 0.5;
      this.vel.x = (fx / len) * speed;
      this.vel.z = (fz / len) * speed;
    } else {
      this.vel.x = 0; this.vel.z = 0;
    }

    // --- vertical motion ---
    if (this.flying) {
      this.vel.y = (input.key('Space') ? FLY_VSPEED : 0) - (input.key('ShiftLeft') ? FLY_VSPEED : 0);
    } else if (this.inWater) {
      // Buoyant sink + swim up on Space; velocities are capped low in water.
      this.vel.y -= GRAVITY * 0.3 * dt;
      if (input.key('Space')) this.vel.y = 3.6;
      this.vel.y = Math.max(-3.2, Math.min(4, this.vel.y));
    } else {
      this.vel.y -= GRAVITY * dt;
      if (input.key('Space') && this.onGround) { this.vel.y = JUMP_SPEED; this.onGround = false; }
    }

    this.onGround = false;
    this.moveAxis('x', this.vel.x * dt, world);
    this.moveAxis('z', this.vel.z * dt, world);
    this.moveAxis('y', this.vel.y * dt, world);

    if (this.pos.y < -30) { this.pos.y = 90; this.vel.set(0, 0, 0); } // safety net
  }

  moveAxis(axis, dist, world) {
    if (dist === 0) return;
    const p = this.pos, w = this.width / 2, h = this.height;
    p[axis] += dist;
    const minX = Math.floor(p.x - w), maxX = Math.floor(p.x + w);
    const minY = Math.floor(p.y),     maxY = Math.floor(p.y + h);
    const minZ = Math.floor(p.z - w), maxZ = Math.floor(p.z + w);
    for (let x = minX; x <= maxX; x++)
      for (let y = minY; y <= maxY; y++)
        for (let z = minZ; z <= maxZ; z++) {
          if (!isSolid(world.getBlock(x, y, z))) continue;
          if (axis === 'x') p.x = dist > 0 ? x - w - 1e-3 : x + 1 + w + 1e-3;
          if (axis === 'z') p.z = dist > 0 ? z - w - 1e-3 : z + 1 + w + 1e-3;
          if (axis === 'y') {
            if (dist > 0) p.y = y - h - 1e-3;
            else { p.y = y + 1 + 1e-3; this.onGround = true; }
            this.vel.y = 0;
          }
          return;
        }
  }
}
