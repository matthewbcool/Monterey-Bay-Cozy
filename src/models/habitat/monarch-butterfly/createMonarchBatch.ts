import { Box3, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Sphere, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { defineGeometryLods, type LodLevel } from '../../shared/lod/geometry';
import { mulberry32 } from '../../shared/random';
import { buildMonarchBody } from './body';
import { buildMonarchWings } from './wings';
import { MonarchBatchMaterial } from './batchMaterial';
import { MONARCH, type MonarchPose } from './definition';

export interface MonarchBatchOptions { count?: number; capacity?: number; seed?: number; wingspanMeters?: number }
export interface MonarchInstanceState {
  slotId: number; pose: MonarchPose; phaseRadians: number; rateScale: number; glideOffsetSeconds: number; wingspanMeters: number;
}
export interface MonarchBatch {
  root: Group; mesh: InstancedMesh; readonly capacity: number; readonly count: number;
  readonly bounds: Box3; readonly timeSeconds: number;
  setCount(count: number): void;
  setPose(pose: MonarchPose, index?: number): void;
  /** Matrices are local to the unscaled batch root; positive uniform scale is
   * physical wingspan / prototype wingspan. No shear or negative scale. */
  setTransformAt(index: number, matrix: Matrix4): void;
  getTransformAt(index: number, target?: Matrix4): Matrix4;
  getInstanceState(index: number): MonarchInstanceState;
  setFlightAt(index: number, options: { phaseRadians?: number; rateScale?: number }): void;
  update(deltaSeconds: number): void;
  dispose(): void;
}

const batches = new WeakMap<Group, MonarchBatch>();
export const getMonarchBatch = (root: Group) => batches.get(root);
const POSES: MonarchPose[] = ['flight', 'basking', 'perched'];

/** One GPU-instanced draw, shared authored geometry, no per-instance skeletons
 * or animation textures. Hosts own translation/physics; update only advances
 * the wing clock. The seeded scatter is a preview placement, not a simulation. */
export function createMonarchBatch({ count = 32, capacity = 256, seed = Math.floor(Math.random() * 2 ** 32), wingspanMeters = MONARCH.wingspanMeters }: MonarchBatchOptions = {}): MonarchBatch {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 256) throw new RangeError('Monarch capacity must be 1–256');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Monarch seed must be uint32');
  if (!Number.isFinite(wingspanMeters) || wingspanMeters <= 0) throw new RangeError('Monarch wingspan must be positive metres');
  const validateCount = (value: number) => { if (!Number.isInteger(value) || value < 0 || value > capacity) throw new RangeError(`Monarch count must be 0–${capacity}`); };
  const validateIndex = (index: number) => { if (!Number.isInteger(index) || index < 0 || index >= capacity) throw new RangeError('Monarch slot is outside capacity'); };
  validateCount(count);
  const random = mulberry32(seed), parameters = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  parameters.name = 'monarch-slot-motion';
  const build = (detail: LodLevel) => {
    const body = buildMonarchBody(wingspanMeters, detail), wings = buildMonarchWings({ seed, wingspanMeters, detail });
    const geometry = mergeGeometries([body, wings])!; body.dispose(); wings.dispose();
    const joints = geometry.getAttribute('skinIndex');
    geometry.setAttribute('monarchJoint', new Float32BufferAttribute(Array.from({ length: joints.count }, (_, i) => joints.getX(i)), 1));
    geometry.deleteAttribute('skinIndex'); geometry.deleteAttribute('skinWeight');
    // The same slot records survive every authored variant; they are never fed
    // through the ordinary per-vertex reducer or duplicated for each creature.
    geometry.setAttribute('monarchInstance', parameters);
    geometry.name = `monarch-instanced-${detail}`;
    geometry.boundingBox = new Box3(new Vector3(-.51, -.51, -.34).multiplyScalar(wingspanMeters), new Vector3(.51, .51, .37).multiplyScalar(wingspanMeters));
    geometry.boundingSphere = new Sphere(new Vector3(), wingspanMeters * .64);
    return geometry;
  };
  const geometry = build('near'); defineGeometryLods(geometry, () => ({ mid: build('mid'), far: build('far') }));
  const material = new MonarchBatchMaterial(wingspanMeters), mesh = new InstancedMesh(geometry, material, capacity), root = new Group();
  mesh.name = 'monarch-single-instanced-batch'; mesh.castShadow = false; root.name = 'Monarch butterfly group'; root.add(mesh);
  // Static placements upload only after an explicit transform change. The GPU
  // wing clock does not mark instanceMatrix or any attribute dirty each frame.
  const matrix = new Matrix4(), position = new Vector3(), rotation = new Quaternion(), scale = new Vector3();
  const bounds = new Box3(), localSphere = new Sphere(new Vector3(), wingspanMeters * .64), transformedSphere = new Sphere();
  let disposed = false, elapsed = 0;
  for (let i = 0; i < capacity; i++) {
    parameters.setXYZW(i, random() * Math.PI * 2, .85 + random() * .3, 0, random() * MONARCH.glideCycleSeconds);
    const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * wingspanMeters * 5;
    position.set(Math.cos(angle) * radius, (random() - .5) * wingspanMeters * 3, Math.sin(angle) * radius);
    rotation.setFromAxisAngle(new Vector3(0, 1, 0), random() * Math.PI * 2);
    scale.setScalar(i === 0 ? 1 : .85 + random() * .35);
    mesh.setMatrixAt(i, matrix.compose(position, rotation, scale));
  }
  mesh.instanceMatrix.needsUpdate = true;
  root.userData = {
    assetId: MONARCH.id, units: 'metres', seed, wingspanMeters, instanceCount: count, capacity,
    species: MONARCH.species, source: MONARCH.source, sizeBasis: MONARCH.sizeBasis,
    animation: 'Shared analytic GPU hinges with independent slot phase and rate',
    placement: 'Seeded preview scatter. External world/physics code owns instance matrices.',
    physics: { stableSlotIds: true, prototype: { shape: 'capsule', radius: wingspanMeters * .025, halfLength: wingspanMeters * .11, axis: 'z' }, basis: 'Body-only proxy; wings and flight dynamics are not simulated.' },
    budget: { drawCalls: 1, trianglesPerInstance: { near: 912, mid: 560, far: 212 }, maxCount: capacity },
  };

  function updateBounds() {
    bounds.makeEmpty();
    for (let i = 0; i < count; i++) {
      mesh.getMatrixAt(i, matrix); transformedSphere.copy(localSphere).applyMatrix4(matrix);
      const r = transformedSphere.radius;
      bounds.expandByPoint(position.copy(transformedSphere.center).addScalar(r));
      bounds.expandByPoint(position.copy(transformedSphere.center).addScalar(-r));
    }
    if (!count) bounds.set(new Vector3(), new Vector3());
    mesh.boundingBox = bounds.clone(); mesh.boundingSphere = bounds.getBoundingSphere(new Sphere());
  }
  function setCount(next: number) {
    if (disposed) return; validateCount(next); count = next; mesh.count = next; mesh.visible = next > 0;
    root.userData.instanceCount = count; updateBounds();
  }
  function setPose(pose: MonarchPose, index?: number) {
    if (disposed) return; const code = POSES.indexOf(pose); if (code === -1) throw new RangeError('Unknown monarch pose');
    if (index !== undefined) { validateIndex(index); parameters.setZ(index, code); }
    else for (let i = 0; i < capacity; i++) parameters.setZ(i, code);
    parameters.needsUpdate = true;
  }
  function setTransformAt(index: number, transform: Matrix4) {
    if (disposed) return; validateIndex(index);
    const e = transform.elements;
    if (!e.every(Number.isFinite) || Math.abs(e[3]) + Math.abs(e[7]) + Math.abs(e[11]) > 1e-8 || Math.abs(e[15] - 1) > 1e-8 || transform.determinant() <= 0) throw new RangeError('Monarch transforms require finite positive uniform TRS');
    transform.decompose(position, rotation, scale);
    const largest = Math.max(scale.x, scale.y, scale.z), smallest = Math.min(scale.x, scale.y, scale.z);
    matrix.compose(position, rotation, scale);
    if (smallest <= 0 || largest - smallest > largest * 1e-6 || matrix.elements.some((value, i) => Math.abs(value - e[i]) > Math.max(1, Math.abs(e[i])) * 1e-6)) throw new RangeError('Monarch transforms require positive uniform scale without shear');
    mesh.setMatrixAt(index, transform); mesh.instanceMatrix.needsUpdate = true;
    if (index < count) updateBounds();
  }
  function getTransformAt(index: number, target = new Matrix4()) { validateIndex(index); mesh.getMatrixAt(index, target); return target; }
  function getInstanceState(index: number): MonarchInstanceState {
    validateIndex(index); mesh.getMatrixAt(index, matrix); scale.setFromMatrixScale(matrix);
    return { slotId: index, pose: POSES[parameters.getZ(index)], phaseRadians: parameters.getX(index), rateScale: parameters.getY(index), glideOffsetSeconds: parameters.getW(index), wingspanMeters: wingspanMeters * scale.x };
  }
  function setFlightAt(index: number, options: { phaseRadians?: number; rateScale?: number }) {
    if (disposed) return; validateIndex(index);
    if (options.phaseRadians !== undefined && !Number.isFinite(options.phaseRadians)) throw new RangeError('Monarch phase must be finite radians');
    if (options.rateScale !== undefined && (!Number.isFinite(options.rateScale) || options.rateScale <= 0)) throw new RangeError('Monarch rate must be finite and positive');
    if (options.phaseRadians !== undefined) parameters.setX(index, (options.phaseRadians % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2));
    if (options.rateScale !== undefined) parameters.setY(index, options.rateScale);
    parameters.needsUpdate = true;
  }
  function update(dt: number) { if (disposed || !count || !Number.isFinite(dt) || dt <= 0) return; elapsed += dt; material.clock.value = elapsed; }
  function release() {
    if (disposed) return; disposed = true; batches.delete(root); mesh.dispose(); mesh.count = count = 0; root.userData.instanceCount = 0;
    root.removeFromParent(); root.clear();
  }
  // Generic disposeObject disposes geometry/material, but not InstancedMesh.
  // The source event also fires when an active authored Far member is disposed.
  geometry.addEventListener('dispose', release);
  function dispose() { if (disposed) return; mesh.geometry.dispose(); material.dispose(); release(); }
  setCount(count);
  const batch: MonarchBatch = { root, mesh, capacity, get count() { return count; }, bounds, get timeSeconds() { return elapsed; }, setCount, setPose, setTransformAt, getTransformAt, getInstanceState, setFlightAt, update, dispose };
  batches.set(root, batch); return batch;
}
