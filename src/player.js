// ============================================================
// Player: first-person controller with gravity and swept-AABB
// collision resolved one axis at a time against the voxel world.
// pos = feet position (bottom-center of the collision box).
// ============================================================
import * as THREE from 'three';
import { GRAVITY, JUMP_SPEED, WALK_SPEED, SPRINT_MULT } from './config.js';
import { isSolid } from './blocks.js';

export class Player {
  constructor(x, y, z) {
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.width = 0.6;
    this.height = 1.8;
    this.eyeHeight = 1.62;
  }

  get eye() { return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z); }

  // Unit vector the camera is looking along.
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

  // Does the unit block cell [bx,bx+1]^3 overlap the player's box?
  overlapsBlock(bx, by, bz) {
    const w = this.width / 2, p = this.pos;
    return (bx + 1 > p.x - w && bx < p.x + w) &&
           (bz + 1 > p.z - w && bz < p.z + w) &&
           (by + 1 > p.y && by < p.y + this.height);
  }

  update(dt, input, world) {
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let fx = 0, fz = 0;
    if (input.key('KeyW')) { fx -= sin; fz -= cos; }
    if (input.key('KeyS')) { fx += sin; fz += cos; }
    if (input.key('KeyA')) { fx -= cos; fz += sin; }
    if (input.key('KeyD')) { fx += cos; fz -= sin; }

    if (fx || fz) {
      const len = Math.hypot(fx, fz);
      const speed = WALK_SPEED * (input.key('ShiftLeft') ? SPRINT_MULT : 1);
      this.vel.x = (fx / len) * speed;
      this.vel.z = (fz / len) * speed;
    } else {
      this.vel.x = 0; this.vel.z = 0;
    }

    this.vel.y -= GRAVITY * dt;
    if (input.key('Space') && this.onGround) { this.vel.y = JUMP_SPEED; this.onGround = false; }

    // Resolve movement axis-by-axis so we slide along walls instead of sticking.
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
          return; // first collision on this axis is enough
        }
  }
}
