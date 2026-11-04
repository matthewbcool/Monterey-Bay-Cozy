import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedBufferAttribute, InstancedMesh, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { createGullFlock, getGullFlock } from '../src/models/habitat/western-gull/createGullFlock';
import { createWesternGull } from '../src/models/habitat/western-gull/createWesternGull';
import { gullDimensions } from '../src/models/habitat/western-gull/definition';
import { createLodController } from '../src/models/shared/lod/controller';
import { LOD_LEVELS, triangles } from '../src/models/shared/lod/geometry';
import { disposeObject } from '../src/models/props/primitives';

const camera = new PerspectiveCamera(45, 1, .01, 100000);

for (const sex of ['male', 'female'] as const) test(`${sex} gull flock: 1–1024 birds share one draw and authored sky silhouettes`, async () => {
  const flock = createGullFlock({ sex, count: 32, capacity: 1024, seed: 42 }), lod = createLodController();
  try {
    assert.equal(getGullFlock(flock.root), flock);
    assert.equal(flock.root.userData.assetId, `western-gull-${sex}`);
    assert.equal(flock.root.userData.units, 'metres'); assert.deepEqual(flock.root.scale.toArray(), [1, 1, 1]);
    const individual = createWesternGull({ sex, seed: 42 });
    try { assert.deepEqual(flock.root.userData.physics.prototype, individual.userData.physics.colliders[0], 'Each stable slot uses the same centered body proxy as its individual counterpart'); }
    finally { disposeObject(individual); }
    assert(flock.mesh instanceof InstancedMesh); assert.equal(flock.root.children.length, 1);
    assert(!Array.isArray(flock.mesh.material)); assert.equal(flock.mesh.material.transparent, false);
    assert.equal(flock.mesh.material.userData.rim, false); assert.equal(flock.mesh.castShadow, false);
    const parameters = flock.mesh.geometry.getAttribute('gullInstance'); assert(parameters instanceof InstancedBufferAttribute);
    const initialMatrices = flock.mesh.instanceMatrix.array.slice(), initialParameters = parameters.array.slice();
    await lod.register(flock.root);
    const baseline = lod.stats(flock.root);
    assert(baseline.near.triangles > baseline.mid.triangles);
    assert(baseline.mid.triangles > baseline.far.triangles);
    assert(baseline.far.triangles / 32 <= 32, 'Distant silhouettes must stay below 32 triangles per bird');
    for (const count of [1, 32, 256, 1024, 0, 1, 1024]) {
      flock.setCount(count); const stats = lod.stats(flock.root);
      assert.equal(flock.count, count); assert.equal(flock.mesh.count, count);
      assert.deepEqual(flock.mesh.instanceMatrix.array, initialMatrices);
      assert.deepEqual(parameters.array, initialParameters);
      for (const detail of LOD_LEVELS) {
        lod.setMode(detail); lod.update(camera, 900, 0, true);
        assert.equal(stats[detail].draws, count ? 1 : 0);
        assert.equal(stats[detail].triangles, baseline[detail].triangles / 32 * count);
        assert.equal(flock.mesh.geometry.getAttribute('gullInstance'), parameters);
        assert(!flock.mesh.geometry.hasAttribute('skinIndex') && !flock.mesh.geometry.hasAttribute('skinWeight'));
        const joints = Array.from(flock.mesh.geometry.getAttribute('gullJoint').array);
        assert(joints.every(joint => ![5, 6, 9].includes(joint)), 'Ground limbs and droplet must not consume sky vertices');
        if (count && detail === 'far') assert(triangles(flock.mesh.geometry) <= 32);
      }
    }
  } finally { flock.dispose(); lod.dispose(); }
});

test('Flocks reproduce seeded flight and update only one clock while parked', () => {
  const a = createGullFlock({ count: 128, seed: 14 }), b = createGullFlock({ count: 128, seed: 14 }), c = createGullFlock({ count: 128, seed: 42 });
  try {
    const params = a.mesh.geometry.getAttribute('gullInstance') as InstancedBufferAttribute;
    assert.deepEqual(params.array, b.mesh.geometry.getAttribute('gullInstance').array);
    assert.deepEqual(a.mesh.instanceMatrix.array, b.mesh.instanceMatrix.array);
    assert.notDeepEqual(params.array, c.mesh.geometry.getAttribute('gullInstance').array);
    const version = params.version, matrixVersion = a.mesh.instanceMatrix.version, rootTransform = a.root.matrix.toArray(), matrixArray = a.mesh.instanceMatrix.array.slice();
    for (let i = 0; i < 120; i++) a.update(1 / 60);
    assert(Math.abs(a.timeSeconds - 2) < 1e-12); assert.equal(params.version, version); assert.equal(a.mesh.instanceMatrix.version, matrixVersion);
    assert.deepEqual(a.root.matrix.toArray(), rootTransform); assert.deepEqual(a.mesh.instanceMatrix.array, matrixArray);
    assert(new Set(Array.from({ length: 128 }, (_, i) => a.getInstanceState(i).phaseRadians.toFixed(5))).size > 120);
    const before = a.getInstanceState(0); a.setFlightAt(1, { phaseRadians: -.5, rateScale: 1.2, glideOffsetSeconds: 9 });
    assert.deepEqual(a.getInstanceState(0), before);
    assert(Math.abs(a.getInstanceState(1).phaseRadians - (Math.PI * 2 - .5)) < 1e-6);
    assert(Math.abs(a.getInstanceState(1).rateScale - 1.2) < 1e-6); assert.equal(a.getInstanceState(1).glideOffsetSeconds, 1);
    const time = a.timeSeconds; for (const dt of [0, -1, NaN, Infinity]) a.update(dt); assert.equal(a.timeSeconds, time);
  } finally { [a, b, c].forEach(flock => flock.dispose()); }
});

test('Transform commits upload once, preserve stable slots and cover distant members', () => {
  const flock = createGullFlock({ sex: 'female', count: 64, seed: 4 });
  try {
    const version = flock.mesh.instanceMatrix.version, origin = flock.getInstanceState(0), matrix = new Matrix4();
    for (let i = 0; i < 64; i++) flock.setTransformAt(i, matrix.makeTranslation(i * 3, 20, -i * 4));
    assert.equal(flock.mesh.instanceMatrix.version, version, 'Editing slots must not repeatedly upload/recompute bounds');
    flock.commitTransforms(); assert.equal(flock.mesh.instanceMatrix.version, version + 1);
    flock.commitTransforms(); assert.equal(flock.mesh.instanceMatrix.version, version + 1);
    const center = new Vector3();
    for (let i = 0; i < 64; i++) {
      center.setFromMatrixPosition(flock.getTransformAt(i)); assert(flock.bounds.containsPoint(center));
      assert(flock.mesh.boundingSphere!.containsPoint(center));
    }
    assert.equal(flock.getInstanceState(0).phaseRadians, origin.phaseRadians);
    assert.equal(flock.getInstanceState(0).wingspanMeters, gullDimensions('female').wingspanMeters);
    flock.setCount(0); flock.setCount(64); assert.deepEqual(flock.getTransformAt(63).elements, matrix.makeTranslation(189, 20, -252).elements);
  } finally { flock.dispose(); }
});

test('Automatic sky LOD changes geometry without changing identity or flight', async () => {
  const flock = createGullFlock({ count: 1, seed: 42 }), lod = createLodController();
  try {
    flock.setTransformAt(0, new Matrix4()); flock.commitTransforms(); await lod.register(flock.root);
    const parameters = flock.mesh.geometry.getAttribute('gullInstance'), matrices = flock.mesh.instanceMatrix, state = flock.getInstanceState(0);
    camera.position.set(0, 0, 2); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
    lod.update(camera, 900, 1, true); assert.equal(lod.inspect(flock.root)[0].level, 'near');
    camera.position.z = 1000; lod.update(camera, 900, 1, true); assert.equal(lod.inspect(flock.root)[0].level, 'far');
    camera.position.z = 2; lod.update(camera, 900, 1, true); assert.equal(lod.inspect(flock.root)[0].level, 'near');
    assert.equal(flock.mesh.geometry.getAttribute('gullInstance'), parameters); assert.equal(flock.mesh.instanceMatrix, matrices);
    assert.deepEqual(flock.getInstanceState(0), state);
  } finally { flock.dispose(); lod.dispose(); }
});

test('Disposal from an active reduced family releases instance resources exactly once', async () => {
  const flock = createGullFlock({ count: 4, seed: 3 }), lod = createLodController();
  await lod.register(flock.root); lod.setMode('far'); lod.update(camera, 900, 1, true);
  let meshes = 0, materials = 0; flock.mesh.addEventListener('dispose', () => meshes++);
  assert(!Array.isArray(flock.mesh.material)); flock.mesh.material.addEventListener('dispose', () => materials++);
  disposeObject(flock.root); flock.dispose();
  assert.equal(meshes, 1); assert.equal(materials, 1); assert.equal(getGullFlock(flock.root), undefined); assert.equal(lod.size, 0);
  lod.dispose();
});

test('Invalid flock counts, slots, sizes and transforms fail before mutating live records', () => {
  for (const capacity of [0, -1, 1025, 1.5, NaN, Infinity]) assert.throws(() => createGullFlock({ capacity }));
  for (const count of [-1, 1025, 1.5, NaN, Infinity]) assert.throws(() => createGullFlock({ count, capacity: 1024 }));
  for (const seed of [-1, .5, NaN, Infinity, 2 ** 32]) assert.throws(() => createGullFlock({ seed }));
  const flock = createGullFlock({ count: 4, seed: 42 });
  try {
    const matrix = flock.getTransformAt(0).clone();
    for (const invalid of [new Matrix4().makeScale(-1, 1, 1), new Matrix4().makeScale(2, 1, 1), new Matrix4().makeScale(0, 0, 0)]) assert.throws(() => flock.setTransformAt(0, invalid));
    assert.deepEqual(flock.getTransformAt(0).elements, matrix.elements);
    assert.throws(() => flock.setTransformAt(4, new Matrix4())); assert.throws(() => flock.setCount(5));
    assert.throws(() => flock.setFlightAt(0, { phaseRadians: Infinity })); assert.throws(() => flock.setFlightAt(0, { rateScale: 0 }));
    assert.throws(() => flock.setFlightAt(0, { glideOffsetSeconds: NaN }));
  } finally { flock.dispose(); }
});
