import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, PerspectiveCamera, Quaternion, Raycaster, Vector3 } from 'three';
import { createSeaOtterModel, getSeaOtterModel } from '../src/models/sea-otter/createSeaOtterModel';
import { getSeaOtter } from '../src/models/habitat/sea-otter/createSeaOtter';
import { bindFishPhysics } from '../src/models/physics';
import { createLodController } from '../src/models/shared/lod/controller';
import { LOD_LEVELS, prepareGeometryLods, triangles } from '../src/models/shared/lod/geometry';
import { createSwimmer, TANK_SIZE } from '../src/viewer/swimPath';
import { createDemoRoute, creatureRadius } from '../src/viewer/demoRoute';
import { createSeaOtterRoute, SEA_OTTER_CYCLE, type SeaOtterActivity } from '../src/viewer/seaOtterRoute';

const speed = { slow: .055, fast: .7 }, camera = new PerspectiveCamera(45, 1, .01, 1000);
const close = (a: number, b: number, tolerance = 1e-8) => assert(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
const stats = (root: Mesh['parent']) => {
  let draws = 0, count = 0;
  root!.traverseVisible(o => { if (o instanceof Mesh) { draws++; count += triangles(o.geometry); } });
  return { draws, triangles: count };
};

test('Tank otter reuses the habitat skeleton with metre-scale −X placement, transformed collider and mouth', () => {
  const model = createSeaOtterModel({ seed: 314, lengthMeters: 1.5 }), asset = getSeaOtter(model.visual)!;
  try {
    assert(asset); assert.equal(getSeaOtterModel(model.root), model);
    assert.equal(asset.root, model.visual); assert.equal(asset.mesh.skeleton.bones.length, 12);
    assert.deepEqual(model.root.scale.toArray(), [1, 1, 1]); assert.deepEqual(model.visual.scale.toArray(), [1, 1, 1]);
    const head = new Vector3(0, 0, -1).applyQuaternion(model.visual.quaternion);
    close(head.x, -1); close(head.y, 0); close(head.z, 0);
    const source = asset.physics.colliders[0], collider = model.physics.colliders[0];
    assert.equal(collider.axis, 'x'); close(collider.radius, source.radius); close(collider.halfLength, source.halfLength);
    assert.deepEqual(collider.center, [source.center[2], source.center[1], -source.center[0]]);
    const mouth = new Vector3(...asset.physics.anchors.mouth as [number, number, number]).applyQuaternion(model.visual.quaternion);
    close(mouth.distanceTo(new Vector3(...model.physics.anchors.mouth)), 0);
    assert(model.physics.anchors.mouth[0] < -.5); assert.equal(model.root.userData.waterlineMeters, 0);
    assert.deepEqual(stats(model.root).draws, 1);
  } finally { model.dispose(); }
});

test('Both eyes gain head-bound X marks at every LOD, catch freezes the existing rig, and disposal releases resources once', async () => {
  const model = createSeaOtterModel({ seed: 42 }), asset = getSeaOtter(model.visual)!, lod = createLodController();
  const physics = JSON.stringify(model.physics), buffers = new Map<BufferAttribute, { data: ArrayLike<number>; version: number }>();
  const resources = new Map<{ addEventListener(type: 'dispose', listener: () => void): void }, number>();
  try {
    await lod.register(model.root);
    const marks = model.parts.get('caught-details')!, mesh = marks.children[0] as Mesh;
    assert.equal(marks.parent, asset.rig.bones[3]); assert.equal(triangles(mesh.geometry), 8);
    for (const source of [asset.mesh.geometry, mesh.geometry]) {
      const family = await prepareGeometryLods(source);
      for (const geometry of new Set(Object.values(family))) {
        resources.set(geometry, 0); geometry.addEventListener('dispose', () => resources.set(geometry, resources.get(geometry)! + 1));
        for (const a of Object.values(geometry.attributes) as BufferAttribute[]) buffers.set(a, { data: a.array.slice(), version: a.version });
      }
    }
    for (const material of [asset.mesh.material, mesh.material].flat()) {
      resources.set(material, 0); material.addEventListener('dispose', () => resources.set(material, resources.get(material)! + 1));
    }
    let skeletonDisposals = 0; const release = asset.rig.skeleton.dispose.bind(asset.rig.skeleton);
    asset.rig.skeleton.dispose = () => { skeletonDisposals++; release(); };
    for (const level of LOD_LEVELS) {
      lod.setMode(level); lod.update(camera, 800, 0, true);
      model.setLifeState('alive'); model.setOtterPose('groom'); model.update(.1);
      assert.equal(stats(model.root).draws, 1); const aliveTriangles = stats(model.root).triangles;
      model.setLifeState('caught'); assert.equal(stats(model.root).draws, 2); assert.equal(stats(model.root).triangles, aliveTriangles + 8);
      const boneTransforms = () => asset.rig.bones.map(b => [...b.position.toArray(), ...b.quaternion.toArray(), ...b.scale.toArray()]);
      const state = model.getState(), bones = boneTransforms();
      for (let i = 0; i < 100; i++) model.update(.1);
      assert.deepEqual(model.getState(), state); assert.equal(state.frequency, 0);
      assert.deepEqual(boneTransforms(), bones);
      const p = mesh.geometry.attributes.position;
      assert(Array.from({ length: p.count }, (_, i) => p.getX(i)).some(x => x < 0));
      assert(Array.from({ length: p.count }, (_, i) => p.getX(i)).some(x => x > 0));
      // Measure the projected marks against the actual reduced skull triangles,
      // rather than reproducing the face profile or relying on source Near.
      const body = asset.mesh.geometry, range = body.userData.partRanges.find((part: { name: string }) => part.name === 'continuous-head-neck-chest-belly-rump');
      const surfaceGeometry = new BufferGeometry().setAttribute('position', body.attributes.position);
      surfaceGeometry.setIndex(Array.from(body.index!.array.slice(range.start, range.start + range.count)));
      const material = new MeshBasicMaterial({ side: DoubleSide }), surface = new Mesh(surfaceGeometry, material);
      const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0)), point = new Vector3();
      try {
        for (let vertex = 0; vertex < p.count; vertex++) {
          point.fromBufferAttribute(p, vertex).add(asset.rig.pivots[3]); ray.ray.origin.set(point.x, 2, point.z);
          const hit = ray.intersectObject(surface, false)[0]; assert(hit, `${level} X lies above its skull`);
          const gap = point.y - hit.point.y;
          assert(gap > 0 && gap < .015 * asset.dimensions.scale, `${level} eye contact: ${gap}m`);
        }
      } finally { surfaceGeometry.dispose(); material.dispose(); }
    }
    for (const [attribute, before] of buffers) { assert.deepEqual(attribute.array, before.data); assert.equal(attribute.version, before.version); }
    assert.equal(JSON.stringify(model.physics), physics);
    model.dispose(); model.dispose(); assert.equal(skeletonDisposals, 1);
    assert.equal(getSeaOtterModel(model.root), undefined); assert.equal(getSeaOtter(model.visual), undefined);
    assert.equal(model.getState().disposed, true);
    for (const count of resources.values()) assert.equal(count, 1);
  } finally { model.dispose(); lod.dispose(); }
});

test('Natural cycle rests at the true waterline for 70%, then dives and resurfaces with all skinned LODs inside the walls and floor', async () => {
  for (const level of LOD_LEVELS) {
    const model = createSeaOtterModel({ seed: 19, lengthMeters: 1.5 }), asset = getSeaOtter(model.visual)!, lod = createLodController();
    const route = createSeaOtterRoute(model, { tankSize: TANK_SIZE, speed });
    try {
      await lod.register(model.root); lod.setMode(level); lod.update(camera, 800, 0, true);
      const stages = new Set<string>(), point = new Vector3(), prior = model.root.position.clone(), forward = new Vector3(), travel = new Vector3();
      let floating = 0, above = false, below = false, completelySubmerged = false;
      for (let step = 0; step < SEA_OTTER_CYCLE.seconds * 10; step++) {
        const phase = route.getPhase(); stages.add(phase.stage);
        if (Math.abs(model.root.position.y - TANK_SIZE.height / 2) < 1e-8) floating++;
        model.update(.1); route.update(.1); model.root.updateMatrixWorld(true); asset.rig.skeleton.update();
        travel.copy(model.root.position).sub(prior); assert(travel.length() < .13, 'bounded continuous movement');
        travel.y = 0; forward.set(-1, 0, 0).applyQuaternion(model.root.quaternion);
        assert(forward.dot(travel.normalize()) > .999, '−X nose follows the horizontal route'); prior.copy(model.root.position);
        let top = -Infinity;
        for (let vertex = 0; vertex < asset.mesh.geometry.attributes.position.count; vertex++) {
          asset.mesh.getVertexPosition(vertex, point).applyMatrix4(asset.mesh.matrixWorld);
          assert(point.toArray().every(Number.isFinite));
          assert(Math.abs(point.x) <= TANK_SIZE.width / 2 - .2, `${level}: side wall`);
          assert(Math.abs(point.z) <= TANK_SIZE.depth / 2 - .2, `${level}: front/back wall`);
          assert(point.y >= -TANK_SIZE.height / 2 + .2, `${level}: floor`);
          assert(point.y <= route.surfaceEnvelope.waterline + route.surfaceEnvelope.aboveSurfaceMeters, `${level}: surface allowance`);
          top = Math.max(top, point.y);
          if (phase.stage === 'float' && phase.time < 40) { above ||= point.y > TANK_SIZE.height / 2 + .1; below ||= point.y < TANK_SIZE.height / 2 - .1; }
        }
        if (phase.stage === 'swim') completelySubmerged ||= top < TANK_SIZE.height / 2 - .75;
      }
      assert(floating >= 699 && floating <= 702, `${level}: ${floating}/1000 floating frames`);
      assert.deepEqual(stages, new Set(['float', 'groom', 'dive', 'swim', 'resurface']));
      assert(above && below, 'floating body straddles the surface'); assert(completelySubmerged);
      close(model.root.position.y, TANK_SIZE.height / 2, 1e-8);
    } finally { model.dispose(); lod.dispose(); }
  }
});

test('Selected Tank and Demo dispatch the same surface route; mode overrides blend instead of snapping', () => {
  const first = createSeaOtterModel({ seed: 71 }), second = createSeaOtterModel({ seed: 71 });
  try {
    const swimmer = createSwimmer(first, speed), demo = createDemoRoute(second, { index: 0, radius: creatureRadius(second), habitat: { level: 4.5, wave: 0, width: .78, depth: .72 }, speed });
    assert('setActivity' in swimmer && 'surfaceAware' in demo); assert.equal(swimmer.getActivity(), 'cycle');
    const asset = getSeaOtter(first.visual)!, body = asset.rig.bones[0], priorQuaternion = new Quaternion();
    for (const activity of ['swim', 'surface', 'swim', 'cycle', 'surface'] as SeaOtterActivity[]) {
      const before = first.root.position.clone(); swimmer.setActivity(activity); assert(first.root.position.equals(before));
      for (let i = 0; i < 60; i++) {
        const previous = first.root.position.clone(); priorQuaternion.copy(body.quaternion);
        first.update(.1); swimmer.update(.1, 0);
        assert(first.root.position.distanceTo(previous) < .15);
        assert(body.quaternion.angleTo(priorQuaternion) < .25, 'roll follows one continuous hemisphere');
      }
      if (activity === 'surface') close(first.root.position.y, TANK_SIZE.height / 2);
      if (activity === 'swim') assert(first.root.position.y < TANK_SIZE.height / 2 - 2);
    }
    assert.throws(() => swimmer.setActivity('invalid' as SeaOtterActivity), /activity/);
  } finally { first.dispose(); second.dispose(); }
});

test('External, physics and caught placement stop route time and movement; release requires explicit resume', () => {
  const model = createSeaOtterModel({ seed: 7 }), route = createSeaOtterRoute(model, { tankSize: TANK_SIZE, speed });
  try {
    for (const owner of ['external', 'physics'] as const) {
      model.setMotionOwner(owner); model.root.position.set(2, 3, -1); model.root.rotation.set(.2, .7, -.1);
      const position = model.root.position.clone(), rotation = model.root.quaternion.clone(), phase = route.getPhase();
      for (let i = 0; i < 20; i++) { model.update(.1); route.update(.1); }
      assert(model.root.position.equals(position)); assert(model.root.quaternion.equals(rotation)); assert.deepEqual(route.getPhase(), phase);
      if (owner === 'physics') { route.resume(); assert.equal(model.getState().motionOwner, 'physics'); }
    }
    model.setMotionOwner('external'); route.resume(); assert.equal(model.getState().motionOwner, 'path'); close(model.root.position.y, 3);
    model.setLifeState('caught'); const position = model.root.position.clone(), phase = route.getPhase();
    route.resume(); route.update(.1); model.update(.1); assert(model.root.position.equals(position)); assert.deepEqual(route.getPhase(), phase);
    model.setLifeState('alive');
    const binding = bindFishPhysics(model, { readWorldPose(p, q) { p.set(2, 1, 0); q.identity(); } }); binding.sync();
    const ignored = createSeaOtterRoute(model, { tankSize: TANK_SIZE }); ignored.update(.1); assert.deepEqual(model.root.position.toArray(), [2, 1, 0]);
    binding.detach(); route.update(.1); assert.deepEqual(model.root.position.toArray(), [2, 1, 0]);
    route.resume(); assert.equal(model.getState().motionOwner, 'path');
  } finally { model.dispose(); }
});

test('Invalid or paused time does no work, long frames are bounded, and ordinary frame partitions agree', () => {
  const a = createSeaOtterModel({ seed: 4 }), b = createSeaOtterModel({ seed: 4 });
  const ra = createSeaOtterRoute(a, { tankSize: TANK_SIZE, speed }), rb = createSeaOtterRoute(b, { tankSize: TANK_SIZE, speed });
  try {
    const phase = ra.getPhase(), state = a.getState(), position = a.root.position.clone();
    for (const dt of [0, -1, NaN, Infinity]) { a.update(dt); ra.update(dt); }
    assert.deepEqual(ra.getPhase(), phase); assert.deepEqual(a.getState(), state); assert(a.root.position.equals(position));
    a.update(20); ra.update(20); b.update(.1); rb.update(.1);
    assert.deepEqual(ra.getPhase(), rb.getPhase()); assert(a.root.position.equals(b.root.position));
    for (let i = 0; i < 1000; i++) { a.update(.1); ra.update(.1); }
    for (let i = 0; i < 6000; i++) { b.update(1 / 60); rb.update(1 / 60); }
    close(ra.getPhase().time, rb.getPhase().time, 1e-8); close(ra.getDistance(), rb.getDistance(), .001);
    assert(a.root.position.distanceTo(b.root.position) < .001); close(a.getState().phase, b.getState().phase, 1e-7);
    a.dispose(); const frozen = ra.getPhase(); ra.update(.1); ra.resume(); assert.deepEqual(ra.getPhase(), frozen);
  } finally { a.dispose(); b.dispose(); }
});

test('Selecting an already-caught otter preserves placement until release and an explicit route resume', () => {
  const model = createSeaOtterModel({ seed: 6 });
  model.setLifeState('caught'); model.root.position.set(1, 0, -1);
  const initial = model.root.position.clone(), route = createSwimmer(model, speed);
  try {
    assert('getPhase' in route); assert.equal(model.getState().motionOwner, 'external'); assert(model.root.position.equals(initial));
    route.resume(); route.update(.1, 0); assert(model.root.position.equals(initial));
    model.setLifeState('alive'); route.update(.1, 0);
    assert(model.root.position.equals(initial)); assert.equal(model.getState().motionOwner, 'external');
    route.resume(); assert.equal(model.getState().motionOwner, 'path'); close(model.root.position.y, initial.y);
    const resumed = model.root.position.clone(); model.update(.1); route.update(.1, 0);
    assert(model.root.position.distanceTo(resumed) > 0); assert(model.root.position.distanceTo(resumed) < .15);
    for (let i = 0; i < 39; i++) { model.update(.1); route.update(.1, 0); }
    close(model.root.position.y, TANK_SIZE.height / 2);
  } finally { model.dispose(); }
});
