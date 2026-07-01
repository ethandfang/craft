// ============================================================
// Engine: Three.js renderer, scene (sky + fog), camera, and the
// two shared materials (opaque terrain + transparent water).
// Baked per-face vertex shading gives the "lighting" look, so a
// MeshBasicMaterial (unlit) is all we need — cheap and crisp.
// ============================================================
import * as THREE from 'three';
import { RENDER_DISTANCE, CHUNK_SIZE } from './config.js';

const SKY = 0x8fc6ff;

export function createEngine(canvas, texture) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);

  // Fog fades chunks out near the render edge so the world doesn't pop/cut off.
  const far = RENDER_DISTANCE * CHUNK_SIZE;
  scene.fog = new THREE.Fog(SKY, far * 0.5, far * 0.95);

  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);

  const materials = {
    opaque: new THREE.MeshBasicMaterial({ map: texture, vertexColors: true }),
    water: new THREE.MeshBasicMaterial({
      map: texture, vertexColors: true,
      transparent: true, opacity: 0.72, depthWrite: false,
    }),
  };

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  return { renderer, scene, camera, materials };
}
