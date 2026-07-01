// ============================================================
// Day/night cycle: sun + moon sprites orbiting the player,
// stars at night, sky/fog color blending through sunrise/sunset,
// and a global brightness factor applied to the terrain materials
// (MeshBasicMaterial.color multiplies the texture, so setting it
// to gray darkens the whole world uniformly — cheap "lighting").
// ============================================================
import * as THREE from 'three';
import { DAY_LENGTH } from './config.js';

const DAY_COL    = new THREE.Color(0x8fc6ff);
const NIGHT_COL  = new THREE.Color(0x0b1026);
const SUNSET_COL = new THREE.Color(0xf2955c);

const R = 380;          // orbit radius of sun/moon
const MIN_BRIGHT = 0.22; // night floor so the world stays visible

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function discSprite(inner, outer, glow) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.55, outer);
  grad.addColorStop(1, glow);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false, depthWrite: false });
  return new THREE.Sprite(mat);
}

export class Sky {
  constructor(scene) {
    this.time = 0.07;  // just after sunrise
    this.brightness = 1;

    this.sun = discSprite('#fffbe8', '#ffe873', 'rgba(255,220,90,0)');
    this.sun.scale.setScalar(56);
    scene.add(this.sun);

    this.moon = discSprite('#f4f6ff', '#c9cede', 'rgba(190,200,230,0)');
    this.moon.scale.setScalar(38);
    scene.add(this.moon);

    // stars: random points on the upper sphere, faded in at night
    const N = 450, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = Math.random() * Math.PI * 2, v = Math.acos(Math.random() * 2 - 1);
      pos[i * 3] = Math.sin(v) * Math.cos(u) * 350;
      pos[i * 3 + 1] = Math.abs(Math.cos(v)) * 350;
      pos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * 350;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({
      color: 0xffffff, size: 1.6, sizeAttenuation: false,
      transparent: true, opacity: 0, fog: false, depthWrite: false,
    }));
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    this._col = new THREE.Color();
  }

  update(dt, center, scene, materials) {
    this.time = (this.time + dt / DAY_LENGTH) % 1;
    // t=0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight
    const a = this.time * Math.PI * 2;
    const elev = Math.sin(a), az = Math.cos(a);

    this.sun.position.set(center.x + az * R, center.y + elev * R, center.z + R * 0.12);
    this.moon.position.set(center.x - az * R, center.y - elev * R, center.z - R * 0.12);
    this.stars.position.copy(center);

    // sky color: night -> day, with a sunset/sunrise tint near the horizon
    const dayF = smoothstep(-0.18, 0.22, elev);
    this._col.copy(NIGHT_COL).lerp(DAY_COL, dayF);
    const horizon = Math.max(0, 1 - Math.abs(elev) / 0.22) * 0.65;
    this._col.lerp(SUNSET_COL, horizon * dayF);
    scene.background.copy(this._col);
    scene.fog.color.copy(this._col);

    this.stars.material.opacity = 1 - dayF;

    // world brightness (baked shading already in vertex colors; this scales it)
    this.brightness = MIN_BRIGHT + (1 - MIN_BRIGHT) * dayF;
    materials.opaque.color.setScalar(this.brightness);
    materials.water.color.setScalar(this.brightness);
    materials.cutout.color.setScalar(this.brightness);
  }
}
