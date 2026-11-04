import { Box3, Group, Mesh, Vector3 } from 'three';
import { finishStaticAsset } from '../../models/shared/staticAsset';

/** A small, fixed spatial partition lets frustum culling and the shared LOD
 * evaluate distant scenery separately. Source parts keep world-metre positions;
 * only render geometry is grouped, never gameplay identities or colliders. */
export function finishSpatialBatches(source: Group, id: string, cellSize = 64) {
  const result = new Group(); result.name = id;
  const cells = new Map<string, Group>(), bounds = new Box3(), center = new Vector3();
  source.updateMatrixWorld(true);
  for (const object of [...source.children]) {
    bounds.setFromObject(object).getCenter(center);
    const key = `${Math.floor(center.x / cellSize)},${Math.floor(center.z / cellSize)}`;
    let cell = cells.get(key);
    if (!cell) { cell = new Group(); cells.set(key, cell); }
    cell.add(object);
  }
  for (const [key, cell] of cells) {
    finishStaticAsset(cell, `${id}-${key}`, [1, 1, 1], { rim: false });
    cell.name = `${id} · ${key}`;
    cell.userData.spatialCell = { key, sizeMetres: cellSize };
    cell.traverse(object => { if (object instanceof Mesh) { object.userData.spatialCell = { key, sizeMetres: cellSize }; object.geometry.userData.lodMaxErrorMetres=.02; object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere(); } });
    result.add(cell);
  }
  return result;
}
