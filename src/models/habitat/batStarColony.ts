import { Group, InstancedMesh, Mesh, Object3D } from 'three';
import { createBatStar, BAT_STAR } from './batStar';
import { attachToSurface, type SurfaceAnchor, type SurfaceAttachment } from '../shared/surfaceAttachment';
import { disposeObject } from '../props/primitives';

/** One geometry/material/draw for attached stars. Controllers own placement; the batch owns rendering. */
export function createBatStarColony(anchors: readonly SurfaceAnchor[], { diameterMeters = .16, seed = 21 } = {}) {
  if (!anchors.length) throw new Error('A colony needs at least one surface anchor');
  const source = createBatStar({ diameterMeters, seed, color: 'orange', detail: 'colony' }), mesh = source.children[0] as Mesh;
  const root = new Group(); root.name = 'Attached bat stars';
  const batch = new InstancedMesh(mesh.geometry, mesh.material, anchors.length); source.clear();
  batch.name = 'bat-star-colony'; batch.castShadow = false; batch.receiveShadow = true; root.add(batch);
  // Bounds depend on arbitrary moving targets; avoid stale bounds without per-frame geometry work.
  batch.frustumCulled = false;
  const positions = anchors.map(() => { const node = new Object3D(); root.add(node); return node; });
  const attachments: SurfaceAttachment[] = [];
  try { positions.forEach((node, i) => attachments.push(attachToSurface(node, anchors[i], { speedMetersPerSecond: BAT_STAR.crawlSpeedMetersPerSecond }))); }
  catch (error) { attachments.forEach(a => a.detach()); batch.dispose(); disposeObject(root); throw error; }
  for (let i = 0; i < positions.length; i++) batch.setMatrixAt(i, positions[i].matrix);
  batch.instanceMatrix.needsUpdate = true;
  root.userData = { units: 'metres', species: BAT_STAR.species, seed, count: anchors.length, diameterMeters };
  let disposed = false;
  return { root, batch, attachments, positions,
    update(dt: number) {
      if (disposed) return;
      let changed = false;
      attachments.forEach((attachment, i) => { if (attachment.update(dt)) { batch.setMatrixAt(i, positions[i].matrix); changed = true; } });
      if (changed) batch.instanceMatrix.needsUpdate = true;
    },
    dispose() { if (disposed) return; disposed = true; attachments.forEach(a => a.detach()); batch.dispose(); disposeObject(root); },
  };
}
