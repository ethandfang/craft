// ============================================================
// World-space effects:
//   - selection outline on the targeted block (black wireframe)
//   - block-breaking crack overlay (10 stages)
//   - break particles (Points that pop out and fall)
//   - drifting clouds high overhead
// ============================================================
import * as THREE from 'three';
import { tileForFace } from './blocks.js';
import { TILE } from './textures.js';

const MAX_PARTICLES = 300;
const CLOUD_SIZE = 600, CLOUD_REPEAT = 24;
const CLOUD_WPT = CLOUD_SIZE / CLOUD_REPEAT; // world units per cloud tile

export class Effects {
  constructor(scene, atlasCanvas, crackTextures, cloudTexture) {
    this.scene = scene;
    this.crackTextures = crackTextures;
    this._acx = atlasCanvas.getContext('2d');
    this._time = 0;

    // --- selection outline ---
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 }));
    this.outline.visible = false;
    scene.add(this.outline);

    // --- crack overlay ---
    this.crack = new THREE.Mesh(
      new THREE.BoxGeometry(1.003, 1.003, 1.003),
      new THREE.MeshBasicMaterial({
        map: crackTextures[0], transparent: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      }));
    this.crack.visible = false;
    scene.add(this.crack);

    // --- break particles ---
    this._pPos = new Float32Array(MAX_PARTICLES * 3);
    this._pCol = new Float32Array(MAX_PARTICLES * 3);
    this._pVel = new Float32Array(MAX_PARTICLES * 3);
    this._pLife = new Float32Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) this._pPos[i * 3 + 1] = -9999; // parked below world
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(this._pPos, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(this._pCol, 3));
    this.particles = new THREE.Points(pg, new THREE.PointsMaterial({
      size: 0.14, vertexColors: true, sizeAttenuation: true,
    }));
    this.particles.frustumCulled = false;
    this._pHead = 0;
    scene.add(this.particles);

    // --- clouds ---
    this.clouds = new THREE.Mesh(
      new THREE.PlaneGeometry(CLOUD_SIZE, CLOUD_SIZE),
      new THREE.MeshBasicMaterial({ map: cloudTexture, transparent: true, depthWrite: false, opacity: 0.8, fog: false }));
    cloudTexture.repeat.set(CLOUD_REPEAT, CLOUD_REPEAT);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = 104;
    this._cloudTex = cloudTexture;
    scene.add(this.clouds);
  }

  // Average-ish color for a block, read straight from the atlas (for particles).
  colorFor(id) {
    const tile = tileForFace(id, 'top');
    const d = this._acx.getImageData(tile * TILE + 8, 8, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255];
  }

  setTarget(target) {
    if (target) {
      this.outline.visible = true;
      this.outline.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
    } else {
      this.outline.visible = false;
    }
  }

  setCrack(target, stage) {
    if (target && stage >= 0) {
      this.crack.visible = true;
      this.crack.material.map = this.crackTextures[Math.min(9, stage)];
      this.crack.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
    } else {
      this.crack.visible = false;
    }
  }

  spawnBreak(x, y, z, id) {
    const [r, g, b] = this.colorFor(id);
    for (let k = 0; k < 14; k++) {
      const i = this._pHead; this._pHead = (this._pHead + 1) % MAX_PARTICLES;
      this._pPos[i*3] = x + 0.5 + (Math.random() - 0.5) * 0.6;
      this._pPos[i*3+1] = y + 0.5 + (Math.random() - 0.5) * 0.6;
      this._pPos[i*3+2] = z + 0.5 + (Math.random() - 0.5) * 0.6;
      this._pVel[i*3] = (Math.random() - 0.5) * 3;
      this._pVel[i*3+1] = 2 + Math.random() * 3;
      this._pVel[i*3+2] = (Math.random() - 0.5) * 3;
      this._pCol[i*3] = r; this._pCol[i*3+1] = g; this._pCol[i*3+2] = b;
      this._pLife[i] = 0.6 + Math.random() * 0.3;
    }
  }

  update(dt, playerPos) {
    this._time += dt;

    // particles: integrate + park expired ones
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this._pLife[i] <= 0) continue;
      this._pLife[i] -= dt;
      if (this._pLife[i] <= 0) { this._pPos[i*3+1] = -9999; continue; }
      this._pVel[i*3+1] -= 14 * dt;
      this._pPos[i*3]   += this._pVel[i*3] * dt;
      this._pPos[i*3+1] += this._pVel[i*3+1] * dt;
      this._pPos[i*3+2] += this._pVel[i*3+2] * dt;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.geometry.attributes.color.needsUpdate = true;

    // clouds: follow player, keep texture world-anchored, drift slowly
    this.clouds.position.x = playerPos.x;
    this.clouds.position.z = playerPos.z;
    this._cloudTex.offset.x = playerPos.x / CLOUD_WPT + this._time * 0.01;
    this._cloudTex.offset.y = playerPos.z / CLOUD_WPT;
  }
}
