import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bone, Box3, BufferAttribute, Mesh, MeshToonMaterial, Quaternion, SkinnedMesh, Vector3 } from 'three';
import { toonRamp } from '../src/models/shared/style';
import { createChinookSalmonModel } from '../src/models/chinook-salmon/createChinookSalmonModel';
import { CHINOOK_SALMON as C } from '../src/models/chinook-salmon/definition';
import { fishCollection } from '../src/models/catalogue';
import { createSwimmer, pathLength, routePose, TANK_SIZE } from '../src/viewer/swimPath';

test('chinook-salmon: registered as the seventh catalogue entry with artistic swim speeds', () => {
  const entry = fishCollection[6];
  assert.equal(entry.id, 'chinook-salmon'); assert.equal(entry.number, '007');
  assert.deepEqual(entry.swimSpeed, { slow: .30, fast: 1.10 });
});

test('chinook-salmon: metre scale, skin weights and both-state budgets', () => {
  const fish = createChinookSalmonModel(), large = createChinookSalmonModel({ lengthMeters: C.lengthMeters * 2 });
  assert.equal(C.lengthMeters, .80); assert.equal(fish.root.userData.lengthMeters, .80);
  assert.equal(fish.root.userData.units, 'metres'); assert.ok(fish.root.scale.equals(new Vector3(1, 1, 1)));
  assert.ok(fish.visual.scale.equals(new Vector3(1, 1, 1)));
  const size = new Box3().setFromObject(fish.root, true).getSize(new Vector3());
  assert.ok(Math.abs(size.x - C.lengthMeters) < 1e-5, `length ${size.x}`);
  // Streamlined fusiform silhouette: fins included, still clearly long and low.
  assert.ok(size.y / size.x > .25 && size.y / size.x < .40, `height ratio ${size.y / size.x}`);
  assert.ok(size.z / size.x < .18, `width ratio ${size.z / size.x}`);
  assert.equal(large.physics.colliders[0].radius, fish.physics.colliders[0].radius * 2);
  assert.equal(large.physics.colliders[0].halfLength, fish.physics.colliders[0].halfLength * 2);
  assert.equal(large.physics.anchors.mouth[0], fish.physics.anchors.mouth[0] * 2);
  assert.equal(large.physics.anchors.grip[0], fish.physics.anchors.grip[0] * 2);
  const materials = new Set();
  for (const state of ['alive', 'caught'] as const) {
    fish.setLifeState(state); let triangles = 0, calls = 0;
    fish.root.traverseVisible(o => {
      if (!(o instanceof Mesh)) return;
      triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; calls++;
      assert.ok(o.material instanceof MeshToonMaterial); materials.add(o.material);
      assert.equal(o.material.gradientMap, toonRamp('matte'), 'fish share the collection ramp');
      for (const attribute of Object.values(o.geometry.attributes) as BufferAttribute[]) for (const value of attribute.array) assert.ok(Number.isFinite(value));
      const w = o.geometry.attributes.skinWeight, indices = o.geometry.attributes.skinIndex;
      for (let i = 0; i < w.count; i++) {
        assert.ok(Math.abs(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i) - 1) < 1e-6);
        assert.ok(indices.getX(i) < 6 && indices.getY(i) < 6 && indices.getZ(i) < 6 && indices.getW(i) < 6);
      }
    });
    assert.ok(triangles <= C.budget.triangles); assert.equal(calls, C.budget.drawCalls);
    console.log(`chinook-salmon ${state}: ${triangles} triangles, ${calls} draws`);
  }
  assert.equal(materials.size, 1); fish.dispose(); large.dispose();
  assert.throws(() => createChinookSalmonModel({ lengthMeters: 0 })); assert.throws(() => createChinookSalmonModel({ lengthMeters: NaN }));
  assert.throws(() => createChinookSalmonModel({ lengthMeters: -1 }));
});

test('chinook-salmon: dark spots sit on the back and on both caudal lobes, sharing body weights', () => {
  const fish = createChinookSalmonModel(), skin = fish.parts.get('surface')!.children[0] as SkinnedMesh;
  const p = skin.geometry.attributes.position, color = skin.geometry.attributes.color, L = C.lengthMeters;
  let back = 0, upperLobe = 0, lowerLobe = 0, belly = 0;
  for (let i = 0; i < p.count; i++) {
    if (!(color.getX(i) < .01 && color.getY(i) < .016 && color.getZ(i) < .016)) continue; // near-black spot vertices only (gill/mouth ink is bluer)
    const x = p.getX(i) / L, y = p.getY(i) / L;
    if (x > .385) { if (y > .01) upperLobe++; else if (y < -.01) lowerLobe++; }
    else if (x > -.40 && y > .02) back++;
    else if (y < -.03) belly++;
  }
  assert.ok(back > 100, `back spot vertices ${back}`); assert.ok(upperLobe > 30 && lowerLobe > 30, `lobes ${upperLobe}/${lowerLobe}`);
  assert.equal(belly, 0, 'no spots on the white belly');
  // An adipose fin rises above the body between the dorsal and tail.
  let adipose = 0;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / L, y = p.getY(i) / L; if (x > .21 && x < .27 && y > .075) adipose++; }
  assert.ok(adipose > 0, 'adipose fin present');
  fish.dispose();
});

test('chinook-salmon: animated bounds, static buffers, raised fast dorsal, caught X eyes and physics ownership', () => {
  const fish = createChinookSalmonModel(), skin = fish.parts.get('surface')!.children[0] as SkinnedMesh;
  const versions = (Object.values(skin.geometry.attributes) as BufferAttribute[]).map(a => a.version);
  const p = new Vector3(), start = fish.root.position.clone(), rotation = fish.root.quaternion.clone();
  for (const mode of ['slow', 'fast'] as const) {
    fish.setSwimMode(mode, true);
    for (let t = 0; t < 16; t++) {
      fish.update(.075); fish.root.updateMatrixWorld(true); skin.skeleton.update();
      for (let i = 0; i < skin.geometry.attributes.position.count; i += 3) {
        skin.getVertexPosition(i, p);
        assert.ok(skin.boundingSphere!.containsPoint(p), 'Posed vertices stay in conservative culling bounds');
      }
    }
    assert.ok(fish.root.position.equals(start) && fish.root.quaternion.equals(rotation), 'update() never moves the root');
  }
  const fast = fish.getState();
  assert.ok(fast.blend > .99 && fast.finExtension > .85, `fast dorsal stays raised (${fast.finExtension})`);
  assert.ok(fast.frequency > C.motion.slowHz * 2, 'fast is a tail-driven sprint');
  assert.deepEqual((Object.values(skin.geometry.attributes) as BufferAttribute[]).map(a => a.version), versions);
  assert.ok(Math.abs((fish.root.getObjectByName('tail') as Bone).rotation.y) > .001);
  fish.setLifeState('caught'); const snapshot = fish.getState(); fish.update(.1); assert.deepEqual(fish.getState(), snapshot);
  assert.equal(Math.abs(fish.root.getObjectByName('mid-body')!.rotation.y), 0); assert.equal(Math.abs(fish.root.getObjectByName('tail')!.rotation.y), 0);
  assert.equal(fish.parts.get('head-details')!.visible, false); assert.equal(fish.parts.get('caught-details')!.visible, true);
  // X marks on both the near (+Z) and far (-Z) eye.
  const crosses = fish.parts.get('caught-details')!.children[0] as Mesh, cz = crosses.geometry.attributes.position;
  let near = 0, far = 0; for (let i = 0; i < cz.count; i++) { if (cz.getZ(i) > 0) near++; else far++; }
  assert.ok(near > 0 && far > 0 && near === far, `X eyes near ${near} far ${far}`);
  fish.setMotionOwner('physics'); fish.root.position.set(3, 2, 1); fish.root.rotation.y = .4;
  const swimmer = createSwimmer(fish, fishCollection[6].swimSpeed); fish.setLifeState('alive'); fish.update(.1); swimmer.update(.1, 1);
  assert.deepEqual(fish.root.position.toArray(), [3, 2, 1]); assert.equal(fish.root.rotation.y, .4);
  fish.dispose();
});

test('chinook-salmon: posed fish clears the full tank route', () => {
  const fish = createChinookSalmonModel(), point = new Vector3(), rotation = new Quaternion();
  fish.setSwimMode('fast', true); for (let i = 0; i < 6; i++) fish.update(.07);
  const local = new Box3().setFromObject(fish.root, true).expandByScalar(.05);
  for (let i = 0; i < 300; i++) {
    const pose = routePose(pathLength * i / 300); rotation.setFromEuler(pose.rotation);
    for (const x of [local.min.x, local.max.x]) for (const y of [local.min.y, local.max.y]) for (const z of [local.min.z, local.max.z]) {
      point.set(x, y, z).applyQuaternion(rotation).add(pose.position);
      assert.ok(Math.abs(point.x) < TANK_SIZE.width / 2 && Math.abs(point.y) < TANK_SIZE.height / 2 && Math.abs(point.z) < TANK_SIZE.depth / 2);
    }
  }
  fish.dispose();
});

test('chinook-salmon: independent animation and one-time resource disposal', () => {
  const a = createChinookSalmonModel(), b = createChinookSalmonModel(), state = b.getState(), skin = a.parts.get('surface')!.children[0] as SkinnedMesh;
  let geometries = 0, materials = 0, skeletons = 0;
  a.root.traverse(o => { if (o instanceof Mesh) o.geometry.addEventListener('dispose', () => geometries++); });
  (skin.material as MeshToonMaterial).addEventListener('dispose', () => materials++);
  const dispose = skin.skeleton.dispose.bind(skin.skeleton); skin.skeleton.dispose = () => { skeletons++; dispose(); };
  for (let i = 0; i < 8; i++) { a.setLifeState('caught'); a.setLifeState('alive'); a.setSwimMode('fast'); a.update(.05); }
  assert.deepEqual(b.getState(), state);
  a.dispose(); a.dispose(); assert.equal(geometries, 3); assert.equal(materials, 1); assert.equal(skeletons, 1);
  assert.ok(a.getState().disposed);
  b.update(.1); assert.ok(b.getState().phase > 0); b.dispose();
});

test('chinook-salmon: fast-transition timing agrees across frame rates', () => {
  const states = [30, 60, 120].map(fps => { const fish = createChinookSalmonModel(); fish.setSwimMode('fast'); for (let i = 0; i < fps; i++) fish.update(1 / fps); const s = fish.getState(); fish.dispose(); return s; });
  for (const s of states) { assert.ok(Math.abs(s.phase - states[0].phase) < 1e-8); assert.ok(Math.abs(s.blend - states[0].blend) < 1e-8); }
});
