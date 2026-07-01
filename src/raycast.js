// ============================================================
// Voxel raycast (Amanatides & Woo DDA).
// Walks the grid from `origin` along `dir`, returning the first
// solid/targetable block AND the face normal that was crossed.
// The normal is what makes block PLACEMENT land on the correct side.
// ============================================================
import { REACH } from './config.js';
import { isReplaceable } from './blocks.js';

export function raycastVoxel(world, origin, dir, maxDist = REACH) {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z);

  // Distance (in t) to cross one whole voxel along each axis.
  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

  // Distance (in t) to the first voxel boundary on each axis.
  let tMaxX = dir.x > 0 ? (x + 1 - origin.x) / dir.x : dir.x < 0 ? (origin.x - x) / -dir.x : Infinity;
  let tMaxY = dir.y > 0 ? (y + 1 - origin.y) / dir.y : dir.y < 0 ? (origin.y - y) / -dir.y : Infinity;
  let tMaxZ = dir.z > 0 ? (z + 1 - origin.z) / dir.z : dir.z < 0 ? (origin.z - z) / -dir.z : Infinity;

  let normal = [0, 0, 0];
  let t = 0;
  while (t <= maxDist) {
    const id = world.getBlock(x, y, z);
    if (id !== 0 && !isReplaceable(id)) {
      // Hit a solid, targetable block.
      return { x, y, z, normal, id };
    }
    // Advance to the next voxel along whichever boundary is closest.
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tDeltaX; normal = [-stepX, 0, 0];
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tDeltaY; normal = [0, -stepY, 0];
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; normal = [0, 0, -stepZ];
    }
  }
  return null;
}
