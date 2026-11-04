import { BufferAttribute, Mesh, SkinnedMesh, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { FishModel } from '../../types';
import type { FishDesign } from './design';
import { poseFish } from './pose';

export const SCHOOL_POSES_PER_CYCLE = 8;

/** One-time bake from the canonical model. No skeleton or vertex updates per instance. */
export function bakeSchoolGeometry(fish: FishModel, design: FishDesign) {
  const body = fish.parts.get('surface')!.children[0] as SkinnedMesh;
  const eyes = fish.parts.get('head-details')!.children[0] as Mesh;
  const crosses = fish.parts.get('caught-details')!.children[0] as Mesh;
  const point = new Vector3();
  function snapshot(caught: boolean) {
    fish.root.updateMatrixWorld(true); body.skeleton.update();
    const surface = body.geometry.clone();
    for (let i = 0; i < surface.attributes.position.count; i++) {
      body.getVertexPosition(i, point);
      surface.attributes.position.setXYZ(i, point.x, point.y, point.z);
    }
    surface.computeVertexNormals();
    const face = (caught ? crosses : eyes).geometry.clone();
    for (const geometry of [surface, face]) {
      for (const attribute of Object.keys(geometry.attributes)) {
        if (!['position', 'normal', 'color', 'fishMatte'].includes(attribute)) geometry.deleteAttribute(attribute);
      }
    }
    const merged = mergeGeometries([surface, face])!;
    surface.dispose(); face.dispose(); return merged;
  }
  // A neutral reference plus relative deltas works on both Three rendering backends.
  poseFish(body.skeleton.bones, design.motion, 0, 0, 0);
  const alive = snapshot(false);
  alive.morphTargetsRelative = true;
  alive.morphAttributes.position = []; alive.morphAttributes.normal = [];
  for (const blend of [0, 1]) for (let i = 0; i < SCHOOL_POSES_PER_CYCLE; i++) {
    const phase = i / SCHOOL_POSES_PER_CYCLE * Math.PI * 2;
    // Pectoral flutter loops over one beat in schools so the atlas seam is continuous.
    poseFish(body.skeleton.bones, design.motion, phase, blend, 1, false, phase);
    const frame = snapshot(false);
    for (const name of ['position', 'normal'] as const) {
      const base = alive.getAttribute(name), posed = frame.getAttribute(name);
      const delta = new Float32Array(base.count * 3);
      for (let j = 0; j < delta.length; j++) delta[j] = posed.array[j] - base.array[j];
      alive.morphAttributes[name]!.push(new BufferAttribute(delta, 3));
    }
    frame.dispose();
  }
  poseFish(body.skeleton.bones, design.motion, 0, 0, 0, true);
  const caught = snapshot(true);
  for (const geometry of [alive, caught]) { geometry.computeBoundingBox(); geometry.computeBoundingSphere(); }
  return { alive, caught };
}

export function geometryBytes(geometry: BufferGeometry) {
  let bytes = geometry.index?.array.byteLength ?? 0;
  for (const attribute of Object.values(geometry.attributes)) bytes += attribute.array.byteLength;
  for (const attributes of Object.values(geometry.morphAttributes)) {
    for (const attribute of attributes ?? []) bytes += attribute.array.byteLength;
  }
  return bytes;
}
