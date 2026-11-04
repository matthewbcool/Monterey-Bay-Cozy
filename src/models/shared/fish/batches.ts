import { Mesh } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ModelAssembly } from '../assembly';

/** Keep one surface batch and two mutually exclusive face states, regardless of rig. */
export function batchFish(assembly: ModelAssembly) {
  assembly.batchParts([...assembly.parts.keys()].filter(name => name !== 'eyes' && name !== 'eyes-caught'), 'surface', { discardUVs: true });
  assembly.batchParts(['eyes'], 'head-details', { discardUVs: true });
  assembly.batchParts(['eyes-caught'], 'caught-details', { discardUVs: true });
  for (const name of ['surface', 'head-details', 'caught-details']) {
    for (const object of assembly.parts.get(name)!.children) {
      if (!(object instanceof Mesh)) continue;
      const original = object.geometry;
      object.geometry = mergeVertices(original, 1e-7);
      original.dispose();
    }
  }
}
