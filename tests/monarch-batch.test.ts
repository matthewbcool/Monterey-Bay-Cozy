import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferAttribute, BufferGeometry, Euler, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { createMonarchBatch, getMonarchBatch } from '../src/models/habitat/monarch-butterfly/createMonarchBatch';
import { createMonarchButterfly, setMonarchPose, updateMonarchButterfly } from '../src/models/habitat/monarch-butterfly/createMonarchButterfly';
import { disposeObject } from '../src/models/props/primitives';
import { createLodController } from '../src/models/shared/lod/controller';
import { LOD_LEVELS, triangles } from '../src/models/shared/lod/geometry';

const camera = new PerspectiveCamera(45, 1, .001, 1000);
const expectedTriangles = { near: 912, mid: 560, far: 212 };

function warmWingArea(geometry: BufferGeometry, up: number) {
  const p = geometry.attributes.position, normal = geometry.attributes.normal, color = geometry.attributes.color;
  const joint = geometry.attributes.monarchJoint, indices = geometry.index!;
  const a = new Vector3(), b = new Vector3(), c = new Vector3(); let area = 0, pigment = 0;
  for (let i = 0; i < indices.count; i += 3) {
    const vertices = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
    if (!vertices.every(index => joint.getX(index) > 0 && normal.getY(index) * up > .8)) continue;
    a.fromBufferAttribute(p, vertices[0]); b.fromBufferAttribute(p, vertices[1]).sub(a); c.fromBufferAttribute(p, vertices[2]).sub(a);
    const triangleArea = b.cross(c).length() / 2;
    pigment += triangleArea * vertices.reduce((sum, index) => sum + Math.max(0, color.getX(index) - color.getY(index)), 0) / 3;
    area += triangleArea;
  }
  assert(area > 0, 'Both painted wing sides remain visible geometry'); return pigment / area;
}

test('Monarch batches render 1–256 animals in one draw and preserve slots across count changes', async () => {
  const batch = createMonarchBatch({ count: 32, capacity: 256, seed: 42 }), lod = createLodController();
  try {
    assert.equal(getMonarchBatch(batch.root), batch);
    assert.equal(batch.root.userData.units, 'metres'); assert.deepEqual(batch.root.scale.toArray(), [1, 1, 1]);
    const meshes: Mesh[] = []; batch.root.traverse(node => { if (node instanceof Mesh) meshes.push(node); });
    assert.deepEqual(meshes, [batch.mesh]); assert(batch.mesh instanceof InstancedMesh);
    assert(!Array.isArray(batch.mesh.material)); assert.equal(batch.mesh.material.transparent, false);
    assert.equal(batch.mesh.material.userData.rim, false);
    assert(batch.mesh.geometry.attributes.monarchJoint);
    assert(!batch.mesh.geometry.hasAttribute('skinIndex') && !batch.mesh.geometry.hasAttribute('skinWeight'), 'The batch carries no unused per-vertex skeleton records');
    const matrices = batch.mesh.instanceMatrix.array.slice(), instanceData = batch.mesh.geometry.attributes.monarchInstance;
    const initialParameters = instanceData.array.slice();
    assert(instanceData instanceof InstancedBufferAttribute); assert.equal(instanceData.count, 256);
    await lod.register(batch.root);
    for (const count of [1, 32, 128, 256, 0, 1, 256]) {
      batch.setCount(count); assert.equal(batch.count, count); assert.equal(batch.mesh.count, count);
      assert.deepEqual(batch.mesh.instanceMatrix.array, matrices, 'Count changes retain each slot’s placement and physical scale');
      assert.deepEqual(instanceData.array, initialParameters, 'Count changes preserve stable per-slot phases and poses');
      const stats = lod.stats(batch.root);
      for (const level of LOD_LEVELS) {
        assert.equal(stats[level].draws, count ? 1 : 0);
        assert.equal(stats[level].triangles, expectedTriangles[level] * count);
        lod.setMode(level); lod.update(camera, 900, 0, true);
        assert.equal(batch.mesh.geometry.attributes.monarchInstance, instanceData, 'Every variant shares one per-instance animation buffer');
      }
    }
  } finally { batch.dispose(); lod.dispose(); }
});

test('Batch seeds repeat independent phases and sizes, and individual poses remain independently addressable', () => {
  const a = createMonarchBatch({ count: 32, seed: 42 }), b = createMonarchBatch({ count: 32, seed: 42 }), other = createMonarchBatch({ count: 32, seed: 7 });
  try {
    const data = a.mesh.geometry.attributes.monarchInstance;
    assert.deepEqual(data.array, b.mesh.geometry.attributes.monarchInstance.array);
    assert.deepEqual(a.mesh.instanceMatrix.array, b.mesh.instanceMatrix.array);
    assert.notDeepEqual(data.array, other.mesh.geometry.attributes.monarchInstance.array);
    assert(new Set(Array.from({ length: a.count }, (_, i) => data.getX(i).toFixed(5))).size > a.count / 2, 'Wingbeats are not synchronized copies');
    const sizes: number[] = [], matrix = new Matrix4(), scale = new Vector3();
    for (let i = 0; i < a.count; i++) {
      a.getTransformAt(i, matrix); scale.setFromMatrixScale(matrix);
      assert(Math.abs(scale.x - scale.y) < 1e-6 && Math.abs(scale.y - scale.z) < 1e-6);
      const span = scale.x * .10; sizes.push(span);
      assert(span >= .085 - 1e-6 && span <= .12 + 1e-6, 'Instances preserve the sourced adult wingspan range');
    }
    assert(Math.max(...sizes) - Math.min(...sizes) > .005, 'The formation includes natural size variation');
    a.setPose('perched', 0); a.setPose('basking', 1);
    assert.equal(a.getInstanceState(0).pose, 'perched'); assert.equal(a.getInstanceState(1).pose, 'basking');
    assert.equal(a.getInstanceState(2).pose, 'flight');
    a.setFlightAt(2, { phaseRadians: .75, rateScale: 1.2 });
    assert(Math.abs(a.getInstanceState(2).phaseRadians - .75) < 1e-6);
    assert(Math.abs(a.getInstanceState(2).rateScale - 1.2) < 1e-6);
    assert.equal(a.getInstanceState(0).pose, 'perched');
    a.setPose('basking');
    for (let i = 0; i < a.count; i++) assert.equal(a.getInstanceState(i).pose, 'basking');
  } finally { [a, b, other].forEach(batch => batch.dispose()); }
});

test('Batch animation advances one clock without updating geometry, slot transforms or instance attributes', () => {
  const a = createMonarchBatch({ count: 256, seed: 42 }), b = createMonarchBatch({ count: 1, seed: 42 });
  try {
    a.root.position.set(2, 3, 4); a.root.rotation.set(.2, .3, .4); a.root.updateMatrix();
    const rootTransform = a.root.matrix.clone(), bounds = a.bounds.clone();
    const snapshots = [...Object.values(a.mesh.geometry.attributes), a.mesh.instanceMatrix].map(attribute => ({
      attribute, array: attribute.array, values: attribute.array.slice(), version: (attribute as BufferAttribute).version,
    }));
    for (let i = 0; i < 60; i++) a.update(1 / 60);
    for (let i = 0; i < 30; i++) b.update(1 / 30);
    assert(Math.abs(a.timeSeconds - 1) < 1e-9); assert(Math.abs(a.timeSeconds - b.timeSeconds) < 1e-9);
    const time = a.timeSeconds;
    for (const dt of [0, -1, NaN, Infinity]) a.update(dt);
    assert.equal(a.timeSeconds, time);
    for (const { attribute, array, values, version } of snapshots) {
      assert.equal(attribute.array, array); assert.deepEqual(attribute.array, values); assert.equal((attribute as BufferAttribute).version, version);
    }
    a.root.updateMatrix(); assert.deepEqual(a.root.matrix.toArray(), rootTransform.toArray()); assert(a.bounds.equals(bounds));
  } finally { a.dispose(); b.dispose(); }
});

test('Every batch LOD retains warm wing fill and fixed per-instance records while geometry cost falls', async () => {
  const batch = createMonarchBatch({ count: 128, seed: 7 }), lod = createLodController();
  try {
    const near = [warmWingArea(batch.mesh.geometry, 1), warmWingArea(batch.mesh.geometry, -1)];
    const params = batch.mesh.geometry.attributes.monarchInstance, matrices = batch.mesh.instanceMatrix;
    await lod.register(batch.root);
    for (const level of LOD_LEVELS) {
      lod.setMode(level); lod.update(camera, 900, 0, true);
      const geometry = batch.mesh.geometry;
      assert.equal(triangles(geometry), expectedTriangles[level]);
      assert.equal(geometry.attributes.monarchInstance, params); assert.equal(batch.mesh.instanceMatrix, matrices);
      for (const attribute of Object.values(geometry.attributes)) assert(Array.from(attribute.array).every(Number.isFinite));
      assert(Array.from(geometry.index!.array).every(index => index < geometry.attributes.position.count));
      assert.deepEqual([...new Set(Array.from(geometry.attributes.monarchJoint.array))].sort(), [0, 1, 2, 3, 4]);
      [1, -1].forEach((up, i) => assert(warmWingArea(geometry, up) >= near[i] * .65, `${level} preserves ${up > 0 ? 'orange dorsal' : 'brown ventral'} area`));
      batch.update(.02); assert.equal(batch.mesh.geometry, geometry);
    }
  } finally { batch.dispose(); assert.equal(lod.size, 0); lod.dispose(); }
});

test('Metre-based placements and conservative batch bounds contain folded and moving wings at every scale', () => {
  const batch = createMonarchBatch({ count: 3, capacity: 3, seed: 42 }), reference = createMonarchButterfly({ seed: 42 });
  let referenceMesh: Mesh | undefined; reference.traverse(node => { if (node instanceof Mesh) referenceMesh = node; }); assert(referenceMesh);
  const rotations = [new Euler(.2, .4, .1), new Euler(.5, -.7, .3), new Euler(-.8, .3, .2)];
  const matrix = new Matrix4(), point = new Vector3();
  try {
    for (let i = 0; i < 3; i++) {
      const pose = new Matrix4().compose(new Vector3(i * .8 - .8, i * .3, -i * .4), new Quaternion().setFromEuler(rotations[i]), new Vector3().setScalar(.85 + i * .175));
      batch.setTransformAt(i, pose); batch.getTransformAt(i, matrix);
      matrix.elements.forEach((value, index) => assert(Math.abs(value - pose.elements[index]) < 1e-6));
    }
    assert.deepEqual(batch.root.scale.toArray(), [1, 1, 1]);
    assert(batch.mesh.boundingBox && batch.mesh.boundingSphere);
    const bounds = batch.bounds.clone().expandByScalar(1e-6), meshBounds = batch.mesh.boundingBox.clone().expandByScalar(1e-6);
    for (const pose of ['perched', 'basking', 'flight'] as const) {
      setMonarchPose(reference, pose);
      for (let frame = 0; frame < (pose === 'flight' ? 24 : 1); frame++) {
        updateMonarchButterfly(reference, .23); reference.updateMatrixWorld(true);
        for (let instance = 0; instance < 3; instance++) {
          batch.getTransformAt(instance, matrix);
          for (let vertex = 0; vertex < referenceMesh.geometry.attributes.position.count; vertex++) {
            referenceMesh.getVertexPosition(vertex, point).applyMatrix4(matrix);
            assert(bounds.containsPoint(point), `${pose} vertices stay in batch bounds`);
            assert(meshBounds.containsPoint(point));
            assert(batch.mesh.boundingSphere.distanceToPoint(point) < 1e-6);
          }
        }
      }
    }
    batch.setCount(0); assert(batch.bounds.isEmpty() || batch.bounds.getSize(new Vector3()).length() < 1e-9);
    batch.setCount(3); assert(!batch.bounds.isEmpty());
  } finally { batch.dispose(); disposeObject(reference); }
});

for (const cleanup of ['factory', 'generic'] as const) test(`${cleanup} disposal while Far is active releases every batch resource once`, async () => {
  const batch = createMonarchBatch({ count: 128, seed: 42 }), other = createMonarchBatch({ count: 1, seed: 7 }), lod = createLodController();
  const releases = new Map<object, number>();
  const watch = (resource: { addEventListener: (type: 'dispose', callback: () => void) => void }) => {
    if (releases.has(resource)) return; releases.set(resource, 0);
    resource.addEventListener('dispose', () => releases.set(resource, releases.get(resource)! + 1));
  };
  try {
    await lod.register(batch.root); watch(batch.mesh); assert(!Array.isArray(batch.mesh.material)); watch(batch.mesh.material);
    for (const level of LOD_LEVELS) { lod.setMode(level); lod.update(camera, 900, 0, true); watch(batch.mesh.geometry); }
    if (cleanup === 'generic') disposeObject(batch.root); else batch.dispose();
    const time = batch.timeSeconds; batch.dispose(); batch.update(.1); assert.equal(batch.timeSeconds, time);
    assert.equal(getMonarchBatch(batch.root), undefined); assert.equal(lod.size, 0);
    assert.equal(releases.size, 5, 'Three geometry levels, one material and the InstancedMesh are owned resources');
    assert([...releases.values()].every(count => count === 1));
    other.update(.1); assert(other.timeSeconds > 0, 'Independent batches never share disposable resources');
  } finally { batch.dispose(); other.dispose(); lod.dispose(); }
});

test('Batch rejects invalid populations, sizes, slot indices, flight parameters and nonuniform transforms', () => {
  for (const capacity of [0, -1, 257, 1.5, NaN, Infinity]) assert.throws(() => createMonarchBatch({ capacity }));
  for (const count of [-1, 257, 1.5, NaN, Infinity]) assert.throws(() => createMonarchBatch({ count }));
  for (const wingspanMeters of [0, -1, NaN, Infinity]) assert.throws(() => createMonarchBatch({ wingspanMeters }));
  for (const seed of [-1, .5, NaN, Infinity, 2 ** 32]) assert.throws(() => createMonarchBatch({ seed }));
  assert.throws(() => createMonarchBatch({ count: 5, capacity: 4 }));
  const batch = createMonarchBatch({ count: 1, capacity: 4, seed: 42 });
  try {
    for (const count of [-1, 5, NaN, .5]) assert.throws(() => batch.setCount(count));
    for (const index of [-1, 4, NaN, .5]) {
      assert.throws(() => batch.getInstanceState(index)); assert.throws(() => batch.setPose('flight', index));
      assert.throws(() => batch.setTransformAt(index, new Matrix4())); assert.throws(() => batch.setFlightAt(index, { phaseRadians: 0 }));
    }
    for (const phaseRadians of [NaN, Infinity]) assert.throws(() => batch.setFlightAt(0, { phaseRadians }));
    for (const rateScale of [0, -1, NaN, Infinity]) assert.throws(() => batch.setFlightAt(0, { rateScale }));
    assert.throws(() => batch.setTransformAt(0, new Matrix4().makeScale(1, 2, 1)));
    assert.throws(() => batch.setTransformAt(0, new Matrix4().makeScale(-1, -1, -1)));
    assert.throws(() => batch.setTransformAt(0, new Matrix4().makeScale(0, 0, 0)));
    const invalid = new Matrix4(); invalid.elements[12] = NaN; assert.throws(() => batch.setTransformAt(0, invalid));
    const shear = new Matrix4(); shear.elements[4] = .5; assert.throws(() => batch.setTransformAt(0, shear));
  } finally { batch.dispose(); }
});
