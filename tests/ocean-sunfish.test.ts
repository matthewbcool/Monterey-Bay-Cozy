import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bone, Box3, BufferAttribute, Mesh, MeshToonMaterial, Quaternion, SkinnedMesh, Vector3 } from 'three';
import { createOceanSunfishModel } from '../src/models/ocean-sunfish/createOceanSunfishModel';
import { SUNFISH } from '../src/models/ocean-sunfish/definition';
import { bindFishPhysics } from '../src/models/physics';
import { createSwimmer, pathLength, routePose, TANK_SIZE } from '../src/viewer/swimPath';

test('Sunfish has a deep narrow disc, tall fins, metre-scale variants and two matte batches', () => {
  const fish = createOceanSunfishModel(), large = createOceanSunfishModel({ lengthMeters: 2.4 });
  fish.setLifeState('caught'); large.setLifeState('caught');
  const size = new Box3().setFromObject(fish.root, true).getSize(new Vector3()), twice = new Box3().setFromObject(large.root, true).getSize(new Vector3());
  assert.ok(Math.abs(size.x - 1.2) < .003); assert.ok(size.y > 1.7 && size.y < 1.9); assert.ok(size.z < .4);
  assert.ok(twice.distanceTo(size.clone().multiplyScalar(2)) < 1e-5); assert.deepEqual(fish.root.scale.toArray(), [1, 1, 1]);
  for (let i = 0; i < 3; i++) {
    assert.equal(large.physics.colliders[i].radius, fish.physics.colliders[i].radius * 2);
    assert.equal(large.physics.colliders[i].halfLength, fish.physics.colliders[i].halfLength * 2);
  }
  assert.equal(large.physics.anchors.mouth[0], fish.physics.anchors.mouth[0] * 2);
  const materials = new Set();
  for (const state of ['alive', 'caught'] as const) {
    fish.setLifeState(state); let triangles = 0, draws = 0;
    fish.root.traverseVisible(object => {
      if (!(object instanceof Mesh)) return;
      triangles += object.geometry.index!.count / 3; draws++; materials.add(object.material);
      assert.ok(object.material instanceof MeshToonMaterial); assert.equal(object.material.userData.toon, 'matte'); assert.ok(object.material.gradientMap);
      for (const attribute of Object.values(object.geometry.attributes) as BufferAttribute[]) for (const value of attribute.array) assert.ok(Number.isFinite(value));
    });
    console.log(`ocean-sunfish ${state}: ${triangles} triangles, ${draws} draws`);
    assert.ok(triangles <= SUNFISH.budget.triangles); assert.equal(draws, 2);
  }
  assert.equal(materials.size, 1); fish.dispose(); large.dispose();
  assert.throws(() => createOceanSunfishModel({ lengthMeters: NaN })); assert.throws(() => createOceanSunfishModel({ lengthMeters: -1 }));
});

test('Sunfish keeps its body and embedded fin roots fixed while paired fins stroke inside bounds', () => {
  const fish = createOceanSunfishModel(), skin = fish.parts.get('surface')!.children[0] as SkinnedMesh;
  const geometry = skin.geometry, p = geometry.attributes.position, w = geometry.attributes.skinWeight, indices = geometry.attributes.skinIndex;
  const versions = (Object.values(geometry.attributes) as BufferAttribute[]).map(a => a.version);
  const point = new Vector3(), base = new Vector3(); let fixed = 0, moving = 0;
  const dorsal = fish.root.getObjectByName('dorsal') as Bone, anal = fish.root.getObjectByName('anal') as Bone;
  for (const mode of ['slow', 'fast'] as const) {
    fish.setSwimMode(mode, true);
    for (let frame = 0; frame < 24; frame++) {
      fish.update(.08); fish.root.updateMatrixWorld(true); skin.skeleton.update();
      assert.equal(dorsal.rotation.x, -anal.rotation.x); assert.equal(dorsal.scale.y, 1); assert.equal(anal.scale.y, 1);
      for (let i = 0; i < p.count; i++) {
        assert.ok(Math.abs(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i) - 1) < 1e-6);
        skin.getVertexPosition(i, point); base.fromBufferAttribute(p, i);
        assert.ok(skin.boundingSphere!.containsPoint(point));
        if (indices.getX(i) === 0 && w.getX(i) === 1) { assert.ok(point.distanceTo(base) < 1e-6); fixed++; }
        else if (point.distanceTo(base) > .01) moving++;
      }
    }
  }
  assert.ok(fixed > 1000 && moving > 100); assert.deepEqual((Object.values(geometry.attributes) as BufferAttribute[]).map(a => a.version), versions);
  // The actual posed mesh, including the tall fins, clears the full tank route.
  const localBounds = new Box3().setFromObject(fish.root, true), rotation = new Quaternion();
  for (let i = 0; i < 300; i++) {
    const pose = routePose(pathLength * i / 300); rotation.setFromEuler(pose.rotation);
    for (const x of [localBounds.min.x, localBounds.max.x]) for (const y of [localBounds.min.y, localBounds.max.y]) for (const z of [localBounds.min.z, localBounds.max.z]) {
      point.set(x, y, z).applyQuaternion(rotation).add(pose.position);
      assert.ok(Math.abs(point.x) < TANK_SIZE.width / 2 && Math.abs(point.y) < TANK_SIZE.height / 2 && Math.abs(point.z) < TANK_SIZE.depth / 2);
    }
  }
  fish.dispose();
});

test('Sunfish caught eyes, transition timing and future physics ownership match the collection', () => {
  const states = [30, 60, 120].map(fps => {
    const fish = createOceanSunfishModel(); fish.setSwimMode('fast'); for (let i = 0; i < fps; i++) fish.update(1 / fps);
    const state = fish.getState(); fish.dispose(); return state;
  });
  for (const state of states) { assert.ok(Math.abs(state.phase - states[0].phase) < 1e-8); assert.ok(Math.abs(state.blend - states[0].blend) < 1e-8); }
  const fish = createOceanSunfishModel(); fish.update(.1); fish.setLifeState('caught');
  assert.ok(fish.parts.get('caught-details')!.visible); assert.ok(!fish.parts.get('head-details')!.visible);
  const state = fish.getState(); fish.update(.1); assert.deepEqual(fish.getState(), state);
  for (const name of ['dorsal', 'anal', 'clavus']) assert.equal(Math.abs(fish.root.getObjectByName(name)!.rotation.x), 0);
  const binding = bindFishPhysics(fish, { readWorldPose(position, rotation) { position.set(3, 2, 1); rotation.setFromAxisAngle(new Vector3(0, 1, 0), .4); } });
  binding.sync(); const swimmer = createSwimmer(fish), original = fish.root.quaternion.clone();
  fish.setLifeState('alive'); fish.update(.1); swimmer.update(.1, 1);
  assert.deepEqual(fish.root.position.toArray(), [3, 2, 1]); assert.ok(fish.root.quaternion.equals(original));
  binding.detach(); fish.dispose();
});

test('Sunfish instances own and dispose each geometry, material and skeleton once', () => {
  const a = createOceanSunfishModel(), b = createOceanSunfishModel(), skin = a.parts.get('surface')!.children[0] as SkinnedMesh;
  let geometries = 0, materials = 0, skeletons = 0;
  a.root.traverse(o => { if (o instanceof Mesh) o.geometry.addEventListener('dispose', () => geometries++); });
  (skin.material as MeshToonMaterial).addEventListener('dispose', () => materials++);
  const release = skin.skeleton.dispose.bind(skin.skeleton); skin.skeleton.dispose = () => { skeletons++; release(); };
  const before = b.getState(); a.update(.1); a.setLifeState('caught'); a.dispose(); a.dispose();
  assert.deepEqual({ geometries, materials, skeletons }, { geometries: 3, materials: 1, skeletons: 1 }); assert.deepEqual(b.getState(), before);
  b.update(.1); assert.ok(b.getState().phase > 0); b.dispose();
});
