// ============================================================
// First-person held item. Shows the selected inventory stack:
//   - a block as a small cube, or
//   - a tool/material as a flat icon billboard.
// Rendered in its own scene on a cleared depth buffer so it always
// draws on top of the world. Idle-bobs while walking, swings on use.
// ============================================================
import * as THREE from 'three';
import { buildBlockGeometry } from './mesher.js';
import { isBlockItem, drawItemIcon } from './items.js';

export class HeldItem {
  constructor(atlasTexture) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 10);
    this.atlasMat = new THREE.MeshBasicMaterial({ map: atlasTexture, vertexColors: true });
    this.planeGeo = new THREE.PlaneGeometry(0.9, 0.9);
    this.toolMat = null;

    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), this.atlasMat);
    this.scene.add(this.mesh);

    this.basePos = new THREE.Vector3(0.62, -0.55, -1.15);
    this.swing = 0;
    this.bob = 0;
    this.currentId = null;

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  setItem(id) {
    if (id === this.currentId) return;
    this.currentId = id;
    if (id == null) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    this.mesh.geometry.dispose();
    if (isBlockItem(id)) {
      this.mesh.geometry = buildBlockGeometry(id);
      this.mesh.material = this.atlasMat;
      this.mesh.scale.setScalar(0.9);
    } else {
      // flat icon billboard for tools/materials
      const c = document.createElement('canvas'); c.width = c.height = 32;
      drawItemIcon(c.getContext('2d'), id, 0, 0, 32);
      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
      if (this.toolMat) { this.toolMat.map.dispose(); this.toolMat.dispose(); }
      this.toolMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
      this.mesh.geometry = this.planeGeo;
      this.mesh.material = this.toolMat;
      this.mesh.scale.setScalar(1.0);
    }
  }

  triggerSwing() { this.swing = 1; }

  update(dt, moving) {
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 5);
    this.bob += dt * (moving ? 9 : 0);
    const s = Math.sin(this.swing * Math.PI);
    const bx = Math.cos(this.bob) * 0.02 * (moving ? 1 : 0);
    const by = Math.abs(Math.sin(this.bob)) * 0.02 * (moving ? 1 : 0);
    this.mesh.position.set(
      this.basePos.x + bx - s * 0.15,
      this.basePos.y + by - s * 0.22,
      this.basePos.z + s * 0.12);
    this.mesh.rotation.set(-0.15 + s * 0.9, 0.5 - s * 0.4, 0.1);
  }

  render(renderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
