import { Box3, BufferAttribute, BufferGeometry, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Sphere, Vector3 } from 'three';
import { defineGeometryLods, triangles, type LodLevel } from '../../shared/lod/geometry';
import { mulberry32 } from '../../shared/random';
import { gullDimensions } from './definition';
import { buildGullGeometry } from './geometry';
import { GullFlockMaterial } from './flockMaterial';

export interface GullFlockOptions { sex?: 'male' | 'female'; count?: number; capacity?: number; seed?: number }
export interface GullFlockInstance { slotId: number; sex: 'male' | 'female'; phaseRadians: number; rateScale: number; glideOffsetSeconds: number; wingspanMeters: number }
export interface GullFlock {
  root: Group; mesh: InstancedMesh; readonly capacity: number; readonly count: number; readonly timeSeconds: number; readonly bounds: Box3;
  setCount(count: number): void;
  /** Transform writes are batched: call commitTransforms once after all edits.
   * Clock updates commit pending bounds too, without scanning unchanged flocks. */
  setTransformAt(index: number, transform: Matrix4): void;
  commitTransforms(): void;
  getTransformAt(index: number, target?: Matrix4): Matrix4;
  getInstanceState(index: number): GullFlockInstance;
  setFlightAt(index: number, options: { phaseRadians?: number; rateScale?: number; glideOffsetSeconds?: number }): void;
  update(deltaSeconds: number): void;
  dispose(): void;
}

const flocks = new WeakMap<Group, GullFlock>();
export const getGullFlock = (root: Group) => flocks.get(root);

/** Remove ground-only limbs/effect entirely, then compact whole vertex records.
 * The authored LOD builder (not generic simplification) owns these joint IDs. */
function flightGeometry(source: BufferGeometry, parameters: InstancedBufferAttribute) {
  const joints = source.getAttribute('skinIndex'), index = source.index;
  const vertexAt = (i: number) => index ? index.getX(i) : i;
  const indices: number[] = [], remap = new Map<number, number>(), originals: number[] = [];
  for (let i = 0, n = index?.count ?? source.getAttribute('position').count; i < n; i += 3) {
    const face = [vertexAt(i), vertexAt(i + 1), vertexAt(i + 2)];
    if (face.some(v => [5, 6, 9].includes(joints.getX(v)))) continue;
    for (const v of face) {
      let target = remap.get(v);
      if (target === undefined) { target = originals.length; remap.set(v, target); originals.push(v); }
      indices.push(target);
    }
  }
  const result = new BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    if (name === 'skinIndex' || name === 'skinWeight') continue;
    const a = attribute as BufferAttribute, values = new Float32Array(originals.length * a.itemSize);
    originals.forEach((v, i) => { for (let c = 0; c < a.itemSize; c++) values[i * a.itemSize + c] = a.getComponent(v, c); });
    result.setAttribute(name, new Float32BufferAttribute(values, a.itemSize));
  }
  result.setAttribute('gullJoint', new Float32BufferAttribute(originals.map(v => joints.getX(v)), 1));
  result.setAttribute('gullInstance', parameters);
  result.setIndex(indices); source.dispose(); return result;
}

/** A flight-only, one-draw spatial flock. World simulation owns translation and
 * stable slot IDs; update advances one shared GPU clock. Use several local cells
 * for wide skies so one nearby bird does not hold a distant flock at Near LOD. */
export function createGullFlock({ sex = 'male', count = 32, capacity = count, seed = Math.floor(Math.random() * 2 ** 32) }: GullFlockOptions = {}): GullFlock {
  if (sex !== 'male' && sex !== 'female') throw new RangeError('Gull sex must be male or female');
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1024) throw new RangeError('Gull flock capacity must be 1–1024');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Gull seed must be uint32');
  const validCount = (n: number) => { if (!Number.isInteger(n) || n < 0 || n > capacity) throw new RangeError(`Gull count must be 0–${capacity}`); };
  const validIndex = (i: number) => { if (!Number.isInteger(i) || i < 0 || i >= capacity) throw new RangeError('Gull slot is outside capacity'); };
  validCount(count);
  const dimensions = gullDimensions(sex), random = mulberry32(seed);
  const parameters = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3); parameters.name = 'gull-slot-flight';
  const envelope = dimensions.wingspanMeters * .7;
  const build = (detail: LodLevel) => {
    const geometry = flightGeometry(buildGullGeometry({ sex, seed, detail }), parameters);
    geometry.name = `western-gull-flight-${detail}`;
    geometry.boundingBox = new Box3(new Vector3(-envelope, -envelope, -envelope), new Vector3(envelope, envelope, envelope));
    geometry.boundingSphere = new Sphere(new Vector3(), envelope);
    return geometry;
  };
  const geometry = build('near');
  defineGeometryLods(geometry, () => ({ mid: build('mid'), far: build('far') }));
  const material = new GullFlockMaterial(sex), mesh = new InstancedMesh(geometry, material, capacity), root = new Group();
  mesh.name = 'western-gull-one-instanced-flight-batch'; mesh.castShadow = mesh.receiveShadow = false;
  root.name = `Western gull ${sex} flock`; root.add(mesh);
  const position = new Vector3(), rotation = new Quaternion(), scale = new Vector3(), matrix = new Matrix4(), yAxis = new Vector3(0, 1, 0);
  const localSphere = new Sphere(new Vector3(), envelope), transformedSphere = new Sphere(), bounds = new Box3();
  let disposed = false, time = 0, transformsDirty = true;
  const scatterRadius = Math.max(2, Math.sqrt(capacity) * dimensions.wingspanMeters * .8);
  for (let i = 0; i < capacity; i++) {
    parameters.setXYZ(i, random() * Math.PI * 2, .88 + random() * .24, random() * 8);
    const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * scatterRadius;
    position.set(Math.cos(angle) * radius, (random() - .5) * Math.min(6, scatterRadius * .35), Math.sin(angle) * radius);
    rotation.setFromAxisAngle(yAxis, (random() - .5) * .55); scale.setScalar(.97 + random() * .06);
    mesh.setMatrixAt(i, matrix.compose(position, rotation, scale));
  }
  root.userData = {
    assetId: `western-gull-${sex}`, species: 'Larus occidentalis', sex, units: 'metres', seed,
    instanceCount: count, capacity, wingspanMeters: dimensions.wingspanMeters,
    animation: 'One GPU clock, independent shoulder/wrist flight phases and glides; no per-bird skeletons',
    placement: 'Seeded preview scatter. World simulation owns matrices and stable slot IDs; use compact spatial cells.',
    physics: { stableSlotIds: true, prototype: { shape: 'capsule', radius: .10 * dimensions.scale, halfLength: .12 * dimensions.scale, axis: 'z', center: [0, .30 * dimensions.scale, .025 * dimensions.scale] }, basis: 'Matches the individual body proxy; transform per stable slot. No collision or flight simulation.' },
    budget: { drawCalls: 1, nearTrianglesPerInstance: triangles(geometry), maxCount: capacity },
  };
  function commitTransforms() {
    if (disposed || !transformsDirty) return;
    transformsDirty = false; bounds.makeEmpty();
    for (let i = 0; i < count; i++) {
      mesh.getMatrixAt(i, matrix); transformedSphere.copy(localSphere).applyMatrix4(matrix);
      bounds.expandByPoint(position.copy(transformedSphere.center).addScalar(transformedSphere.radius));
      bounds.expandByPoint(position.copy(transformedSphere.center).addScalar(-transformedSphere.radius));
    }
    if (!count) bounds.set(new Vector3(), new Vector3());
    mesh.boundingBox ??= new Box3(); mesh.boundingSphere ??= new Sphere();
    mesh.boundingBox.copy(bounds); bounds.getBoundingSphere(mesh.boundingSphere); mesh.instanceMatrix.needsUpdate = true;
  }
  function setCount(next: number) {
    if (disposed) return; validCount(next); count = next; mesh.count = count; mesh.visible = count > 0;
    root.userData.instanceCount = count; transformsDirty = true; commitTransforms();
  }
  function setTransformAt(index: number, transform: Matrix4) {
    if (disposed) return; validIndex(index); const e = transform.elements;
    if (!e.every(Number.isFinite) || Math.abs(e[3]) + Math.abs(e[7]) + Math.abs(e[11]) > 1e-8 || Math.abs(e[15] - 1) > 1e-8 || transform.determinant() <= 0) throw new RangeError('Gull transforms require finite positive uniform TRS');
    transform.decompose(position, rotation, scale); const largest = Math.max(scale.x, scale.y, scale.z), smallest = Math.min(scale.x, scale.y, scale.z);
    matrix.compose(position, rotation, scale);
    if (smallest <= 0 || largest - smallest > largest * 1e-6 || matrix.elements.some((v, i) => Math.abs(v - e[i]) > Math.max(1, Math.abs(e[i])) * 1e-6)) throw new RangeError('Gull transforms require positive uniform scale without shear');
    mesh.setMatrixAt(index, transform); transformsDirty = true;
  }
  function getTransformAt(index: number, target = new Matrix4()) { validIndex(index); mesh.getMatrixAt(index, target); return target; }
  function getInstanceState(index: number): GullFlockInstance {
    validIndex(index); mesh.getMatrixAt(index, matrix); scale.setFromMatrixScale(matrix);
    return { slotId: index, sex, phaseRadians: parameters.getX(index), rateScale: parameters.getY(index), glideOffsetSeconds: parameters.getZ(index), wingspanMeters: dimensions.wingspanMeters * scale.x };
  }
  function setFlightAt(index: number, options: { phaseRadians?: number; rateScale?: number; glideOffsetSeconds?: number }) {
    if (disposed) return; validIndex(index);
    if (options.phaseRadians !== undefined && !Number.isFinite(options.phaseRadians)) throw new RangeError('Gull phase must be finite');
    if (options.rateScale !== undefined && (!Number.isFinite(options.rateScale) || options.rateScale <= 0)) throw new RangeError('Gull rate must be finite and positive');
    if (options.glideOffsetSeconds !== undefined && !Number.isFinite(options.glideOffsetSeconds)) throw new RangeError('Gull glide offset must be finite');
    if (options.phaseRadians !== undefined) parameters.setX(index, (options.phaseRadians % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2));
    if (options.rateScale !== undefined) parameters.setY(index, options.rateScale);
    if (options.glideOffsetSeconds !== undefined) parameters.setZ(index, (options.glideOffsetSeconds % 8 + 8) % 8);
    parameters.needsUpdate = true;
  }
  function update(dt: number) { if (disposed) return; commitTransforms(); if (!count || !Number.isFinite(dt) || dt <= 0) return; time += dt; material.clock.value = time; }
  function release() {
    if (disposed) return; disposed = true; flocks.delete(root); mesh.dispose(); mesh.count = count = 0; root.userData.instanceCount = 0; root.removeFromParent(); root.clear();
  }
  geometry.addEventListener('dispose', release);
  function dispose() { if (disposed) return; mesh.geometry.dispose(); material.dispose(); release(); }
  setCount(count);
  const flock: GullFlock = { root, mesh, capacity, get count() { return count; }, get timeSeconds() { return time; }, bounds, setCount, setTransformAt, commitTransforms, getTransformAt, getInstanceState, setFlightAt, update, dispose };
  flocks.set(root, flock); return flock;
}
