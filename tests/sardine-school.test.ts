import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Matrix4, Mesh, MeshToonMaterial, Quaternion, Vector3 } from 'three';
import { createSardineSchool } from '../src/models/pacific-sardine/createSardineSchool';
import { bindFishPhysics } from '../src/models/physics';
import { pathLength, routePose, TANK_SIZE, createSwimmer } from '../src/viewer/swimPath';

test('School shares fixed geometry and one material at every population; all attributes are finite', () => {
  const school = createSardineSchool(), { alive, caught } = school.batches;
  const geometry = alive.geometry, material = alive.material, texture = alive.morphTexture;
  assert.equal(school.root.userData.units, 'metres'); assert.deepEqual(school.root.scale.toArray(), [1, 1, 1]);
  assert.equal(caught.material, material); assert.ok(material instanceof MeshToonMaterial);
  assert.equal(geometry.index!.count / 3, 1468); assert.equal(caught.geometry.index!.count / 3, 1280);
  assert.ok(!geometry.hasAttribute('skinIndex')); assert.equal(geometry.morphAttributes.position!.length, 16);
  for (const g of [geometry, caught.geometry]) {
    const attributes = [...Object.values(g.attributes), ...Object.values(g.morphAttributes).flat()];
    for (const attribute of attributes) for (const value of attribute!.array) assert.ok(Number.isFinite(value));
  }
  for (const count of [0, 1, 16, 48, 128, 256, 1]) {
    school.setCount(count); school.update(.05);
    assert.equal(alive.geometry, geometry); assert.equal(alive.material, material); assert.equal(alive.morphTexture, texture);
    for (const state of ['alive', 'caught'] as const) {
      school.setLifeState(state); let draws = 0;
      school.root.traverseVisible(o => { if (o instanceof Mesh) draws++; }); assert.equal(draws, count ? 1 : 0);
    }
    school.setLifeState('alive');
  }
  assert.throws(() => school.setCount(257)); assert.throws(() => school.setCount(1.5)); assert.throws(() => school.setCount(NaN));
  school.dispose(); assert.throws(() => createSardineSchool({ capacity: 0 }));
  assert.throws(() => createSardineSchool({ count: 5, capacity: 4 }));
});

test('School uses independent phases, static vertex buffers, continuous cycles and stable transition timing', () => {
  const school = createSardineSchool({ count: 16 }), mesh = school.batches.alive;
  const a = new Mesh(mesh.geometry, mesh.material), b = new Mesh(mesh.geometry, mesh.material);
  mesh.getMorphAt(0, a); mesh.getMorphAt(1, b); assert.notDeepEqual(a.morphTargetInfluences, b.morphTargetInfluences);
  const position = mesh.geometry.attributes.position, data = Array.from(position.array);
  for (let i = 0; i < 30; i++) school.update(1 / 60);
  assert.deepEqual(Array.from(position.array), data);
  mesh.getMorphAt(0, b); assert.notDeepEqual(a.morphTargetInfluences, b.morphTargetInfluences);
  assert.ok(Math.abs(b.morphTargetInfluences!.reduce((sum, w) => sum + w, 0) - 1) < 1e-6);
  school.setSwimMode('fast', true); assert.equal(school.getState().finExtension, .78);
  const caughtBuffer = school.batches.caught.instanceMatrix;
  school.setLifeState('caught'); const state = school.getState(), version = caughtBuffer.version;
  school.update(.1); assert.deepEqual(school.getState(), state); assert.equal(caughtBuffer.version, version);
  assert.equal(school.batches.caught.visible, true); assert.equal(school.batches.alive.visible, false);
  school.setLifeState('alive'); school.update(.1); assert.notEqual(school.getState().phase, state.phase); school.dispose();
  const states = [30, 60, 120].map(fps => {
    const s = createSardineSchool({ count: 1, capacity: 1 }); s.setSwimMode('fast');
    for (let i = 0; i < fps; i++) s.update(1 / fps);
    const result = s.getState(); s.dispose(); return result;
  });
  for (const result of states) assert.ok(Math.abs(result.phase - states[0].phase) < 1e-8);
  const loop = createSardineSchool({ count: 1, capacity: 1 }), cycle = new Mesh(loop.batches.alive.geometry, loop.batches.alive.material);
  let remaining = 1 / loop.getState().frequency - .0001;
  while (remaining > 0) { const dt = Math.min(remaining, .05); loop.update(dt); remaining -= dt; }
  loop.batches.alive.getMorphAt(0, cycle);
  const before = Array.from({ length: cycle.geometry.attributes.position.count }, (_, i) => cycle.getVertexPosition(i, new Vector3()));
  loop.update(.0002); loop.batches.alive.getMorphAt(0, cycle);
  assert.ok(loop.getState().phase < .01);
  const point = new Vector3();
  for (let i = 0; i < before.length; i++) assert.ok(cycle.getVertexPosition(i, point).distanceTo(before[i]) < .0001, 'Cycle seam has no pose jump');
  loop.dispose();
});

test('Sampled swim geometry stays in school bounds and largest formation clears the tank route', () => {
  const school = createSardineSchool({ count: 256 }), mesh = school.batches.alive;
  const proxy = new Mesh(mesh.geometry, mesh.material), matrix = new Matrix4(), point = new Vector3();
  for (const mode of ['slow', 'fast'] as const) {
    school.setSwimMode(mode, true);
    for (let frame = 0; frame < 10; frame++) {
      school.update(.075);
      for (let i = 0; i < school.count; i += 3) {
        mesh.getMatrixAt(i, matrix); mesh.getMorphAt(i, proxy);
        for (let j = 0; j < mesh.geometry.attributes.position.count; j += 7) {
          proxy.getVertexPosition(j, point).applyMatrix4(matrix);
          assert.ok(school.bounds.containsPoint(point), 'Conservative bounds include moving vertices');
        }
      }
    }
  }
  for (let i = 0; i < 500; i++) {
    const pose = routePose(pathLength * i / 500);
    matrix.compose(pose.position, new Quaternion().setFromEuler(pose.rotation), new Vector3(1, 1, 1));
    for (const x of [school.bounds.min.x, school.bounds.max.x]) for (const y of [school.bounds.min.y, school.bounds.max.y]) for (const z of [school.bounds.min.z, school.bounds.max.z]) {
      point.set(x, y, z).applyMatrix4(matrix);
      assert.ok(Math.abs(point.x) < TANK_SIZE.width / 2 && Math.abs(point.z) < TANK_SIZE.depth / 2 && Math.abs(point.y) < TANK_SIZE.height / 2, 'School clears aquarium');
    }
  }
  school.dispose();
});

test('Taking a fish preserves its world pose, compacts the batch and gives physics independent ownership', () => {
  const school = createSardineSchool({ count: 16, lengthMeters: .3 }), parent = new Group(); parent.add(school.root);
  parent.position.set(3, 2, 1); parent.rotation.y = .4; parent.scale.setScalar(1.2);
  school.root.position.set(.1, 0, .2); school.update(.1); school.root.updateWorldMatrix(true, true);
  const expected = new Matrix4(); school.batches.alive.getMatrixAt(3, expected); expected.premultiply(school.visual.matrixWorld);
  // The instance carries its fish's size; the taken model is rebuilt at that length with the host's scale only.
  const size = school.sizeAt(3); assert.notEqual(size, 1); expected.scale(new Vector3(1 / size, 1 / size, 1 / size));
  const fish = school.takeFish(3); fish.root.updateMatrixWorld(true);
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(fish.root.matrixWorld.elements[i] - expected.elements[i]) < 1e-6);
  assert.ok(Math.abs(fish.root.scale.x - 1.2) < 1e-6, 'root keeps host scale, not instance size');
  assert.equal(school.count, 15); assert.equal(fish.getState().lifeState, 'caught'); assert.ok(Math.abs(fish.root.userData.lengthMeters - .3 * size) < 1e-9);
  assert.ok(fish.parts.get('caught-details')!.visible); assert.ok(!fish.parts.get('head-details')!.visible);
  const binding = bindFishPhysics(fish, { readWorldPose(position, rotation) { position.set(7, 8, 9); rotation.identity(); } });
  binding.sync(); const route = createSwimmer(fish); route.update(.1, 1); school.update(.1); fish.update(.1);
  assert.deepEqual(fish.root.position.toArray(), [7, 8, 9]); assert.equal(fish.getState().motionOwner, 'physics');
  school.dispose(); assert.equal(fish.getState().disposed, false); binding.detach(); fish.dispose();
  assert.throws(() => school.takeFish(0));
});

test('School teardown releases batches, geometry, material and weight texture exactly once', () => {
  const school = createSardineSchool({ count: 1 }), other = createSardineSchool({ count: 1 });
  const counts = { batches: 0, geometry: 0, material: 0, texture: 0 };
  for (const mesh of Object.values(school.batches)) {
    mesh.addEventListener('dispose', () => counts.batches++);
    mesh.geometry.addEventListener('dispose', () => counts.geometry++);
  }
  (school.batches.alive.material as MeshToonMaterial).addEventListener('dispose', () => counts.material++);
  school.batches.alive.morphTexture!.addEventListener('dispose', () => counts.texture++);
  school.dispose(); school.dispose(); school.update(.1); school.setCount(2);
  assert.deepEqual(counts, { batches: 2, geometry: 2, material: 1, texture: 1 });
  other.update(.1); assert.ok(other.getState().phase > 0); other.dispose();
});
