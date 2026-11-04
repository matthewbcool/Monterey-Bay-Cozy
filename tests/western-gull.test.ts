import {buildGullGeometry} from '../src/models/habitat/western-gull/geometry';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Color, BufferAttribute, BufferGeometry, Group, Mesh, MeshToonMaterial, PerspectiveCamera, SkinnedMesh, Vector3 } from 'three';
import { createWesternGull, getGullState, setGullPose, updateWesternGull } from '../src/models/habitat/western-gull/createWesternGull';
import { GULL, GULL_POSES, gullDimensions, gullPivots, type GullSex } from '../src/models/habitat/western-gull/definition';
import { disposeObject } from '../src/models/props/primitives';
import { createLodController } from '../src/models/shared/lod/controller';
import { geometryBytes, LOD_LEVELS, triangles } from '../src/models/shared/lod/geometry';

const sexes: readonly GullSex[] = ['male', 'female'];
const camera = new PerspectiveCamera(45, 1, .001, 10000);

function surface(root: Group) {
  const meshes: Mesh[] = [];
  root.traverse(node => { if (node instanceof Mesh) meshes.push(node); });
  assert.equal(meshes.length, 1, 'All visible body parts and the reusable effect share one draw');
  assert(meshes[0] instanceof SkinnedMesh);
  return meshes[0] as SkinnedMesh;
}

function state(root: Group) {
  const result = getGullState(root); assert(result, 'Live assets expose their animation state'); return result;
}

function assertSafeGeometry(geometry: BufferGeometry, detail: string) {
  const positions = geometry.getAttribute('position'), joints = geometry.getAttribute('skinIndex'), weights = geometry.getAttribute('skinWeight');
  assert(positions.count > 0 && joints && weights);
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    assert.equal(attribute.count, positions.count, `${detail}/${name} keeps complete vertex records`);
    assert(Array.from(attribute.array).every(Number.isFinite), `${detail}/${name} is finite`);
  }
  assert(geometry.index && geometry.index.count % 3 === 0);
  assert(Array.from(geometry.index.array).every(index => Number.isInteger(index) && index >= 0 && index < positions.count));
  const influences = new Set<number>();
  for (let vertex = 0; vertex < positions.count; vertex++) {
    let total = 0;
    for (let influence = 0; influence < 4; influence++) {
      const joint = joints.getComponent(vertex, influence), weight = weights.getComponent(vertex, influence);
      assert(Number.isInteger(joint) && joint >= 0 && joint < 10);
      assert(weight >= 0 && weight <= 1); total += weight;
      if (weight) influences.add(joint);
    }
    assert(Math.abs(total - 1) < 1e-7, `${detail} skin weights stay normalized`);
  }
  for (const joint of [0, 1, 2, 3, 4, 5, 6, 7]) assert(influences.has(joint), `${detail} retains body, both wing hinges, legs and tail`);
  if (detail !== 'far') for (const joint of [8, 9]) assert(influences.has(joint), `${detail} retains head motion and effect anatomy`);
}

function warm(mesh: SkinnedMesh) { mesh.updateWorldMatrix(true, true); mesh.skeleton.update(); }

type XzPoint = [number, number];
const signedArea = (points: XzPoint[]) => points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length]; return sum + point[0] * next[1] - next[0] * point[1];
}, 0) / 2;

/** Convex triangle clipping independent of the model's ear-clipping triangulator.
 * A shared point/edge has zero area; an overpainted patch has positive area. */
function triangleOverlapArea(subject: XzPoint[], clip: XzPoint[]) {
  let polygon = subject;
  const orientation = Math.sign(signedArea(clip));
  for (let edge = 0; edge < 3 && polygon.length; edge++) {
    const a = clip[edge], b = clip[(edge + 1) % 3], next: XzPoint[] = [];
    const distance = (p: XzPoint) => orientation * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    let previous = polygon[polygon.length - 1], previousDistance = distance(previous);
    for (const current of polygon) {
      const currentDistance = distance(current), previousInside = previousDistance >= 0, currentInside = currentDistance >= 0;
      if (previousInside !== currentInside) {
        const fraction = previousDistance / (previousDistance - currentDistance);
        next.push([previous[0] + (current[0] - previous[0]) * fraction, previous[1] + (current[1] - previous[1]) * fraction]);
      }
      if (currentInside) next.push(current);
      previous = current; previousDistance = currentDistance;
    }
    polygon = next;
  }
  return Math.abs(signedArea(polygon));
}

test('60 seeds per sex stay finite and within a single-draw budget at all three authored LODs', async () => {
  for (const sex of sexes) for (let seed = 0; seed < 60; seed++) {
    const root = createWesternGull({ sex, seed }), mesh = surface(root), lod = createLodController();
    try {
      assert.equal(root.userData.seed, seed); assert.equal(mesh.skeleton.bones.length, 10);
      assert(mesh.material instanceof MeshToonMaterial);
      assert.equal(mesh.material.transparent, false); assert.equal(mesh.material.userData.rim, false);
      assert.equal(mesh.material.map, null); assert.equal(mesh.material.normalMap, null); assert.equal(mesh.material.bumpMap, null);
      await lod.register(root); const counts = lod.stats(root);
      assert(counts.near.triangles <= GULL.budget.triangles);
      assert(counts.mid.triangles < counts.near.triangles * .5, 'Mid removes small anatomy and reduces body tessellation');
      assert(counts.far.triangles <= 32, 'Long-range birds retain only a cheap silhouette');
      const bytes: number[] = [];
      for (const level of LOD_LEVELS) {
        lod.setMode(level); lod.update(camera, 900, 0, true);
        assertSafeGeometry(mesh.geometry, level); assert.equal(counts[level].draws, 1);
        assert.equal(counts[level].triangles, triangles(mesh.geometry)); bytes.push(geometryBytes(mesh.geometry));
      }
      assert(bytes[2] < bytes[1] && bytes[1] < bytes[0], 'Storage falls with visual complexity');
      assert.equal(counts.bytes, bytes.reduce((sum, value) => sum + value, 0));
    } finally { disposeObject(root); assert.equal(lod.size, 0); lod.dispose(); }
  }
});

test('Art-directed sex palettes retain proportional metre geometry, attachments and colliders', () => {
  const male = createWesternGull({ sex: 'male', seed: 42 }), female = createWesternGull({ sex: 'female', seed: 42 });
  try {
    const a = surface(male), b = surface(female), ratio = gullDimensions('female').scale / gullDimensions('male').scale;
    assert.notDeepEqual(a.geometry.getAttribute('color').array, b.geometry.getAttribute('color').array, 'Female has the requested authored color distinction');
    for (const root of [male, female]) {
      assert.equal(root.userData.units, 'metres'); assert(root.userData.source.startsWith('https://'));
      assert.match(root.userData.sizeBasis, /combined.sex.*overlapping/i);
      assert.deepEqual(root.scale.toArray(), [1, 1, 1]);
      assert(root.userData.lengthMeters >= GULL.lengthRangeMeters[0] && root.userData.lengthMeters <= GULL.lengthRangeMeters[1]);
      assert(root.userData.wingspanMeters >= GULL.wingspanRangeMeters[0] && root.userData.wingspanMeters <= GULL.wingspanRangeMeters[1]);
      const positions = surface(root).geometry.getAttribute('position'), box = new Box3().setFromBufferAttribute(positions as BufferAttribute);
      const size = box.getSize(new Vector3());
      assert(Math.abs(size.x - root.userData.wingspanMeters) < 1e-6);
      assert(Math.abs(size.z - root.userData.lengthMeters) < 1e-6);
      assert(root.userData.physics.colliders.length > 0 && root.userData.sourceParts.length > 8);
    }
    const positionsA = a.geometry.getAttribute('position'), positionsB = b.geometry.getAttribute('position');
    assert.equal(positionsA.count, positionsB.count);
    for (let vertex = 0; vertex < positionsA.count; vertex++) for (let axis = 0; axis < 3; axis++) {
      assert(Math.abs(positionsA.getComponent(vertex, axis) * ratio - positionsB.getComponent(vertex, axis)) < 1e-7);
    }
    for (const key of Object.keys(male.userData.physics.anchors)) {
      const anchorA = new Vector3(...male.userData.physics.anchors[key] as [number, number, number]);
      const anchorB = new Vector3(...female.userData.physics.anchors[key] as [number, number, number]);
      assert(anchorA.multiplyScalar(ratio).distanceTo(anchorB) < 1e-10);
    }
    const colliderA = male.userData.physics.colliders[0], colliderB = female.userData.physics.colliders[0];
    assert(Math.abs(colliderA.radius * ratio - colliderB.radius) < 1e-10);
    assert(Math.abs(colliderA.halfLength * ratio - colliderB.halfLength) < 1e-10);
  } finally { disposeObject(male); disposeObject(female); }
});

test('Seeded pigment is reproducible and malformed factory inputs are rejected', () => {
  const a = createWesternGull({ seed: 42 }), b = createWesternGull({ seed: 42 }), c = createWesternGull({ seed: 7 });
  try {
    for (const key of Object.keys(surface(a).geometry.attributes)) assert.deepEqual(surface(a).geometry.attributes[key].array, surface(b).geometry.attributes[key].array);
    assert.notDeepEqual(surface(a).geometry.getAttribute('color').array, surface(c).geometry.getAttribute('color').array);
    for (const seed of [-1, .1, NaN, Infinity, 2 ** 32]) assert.throws(() => createWesternGull({ seed }));
    assert.throws(() => createWesternGull({ sex: 'other' as GullSex }));
    assert.throws(() => createWesternGull({ pose: 'other' as 'flight' }));
    assert.throws(() => setGullPose(a, 'other' as 'flight'));
  } finally { [a, b, c].forEach(disposeObject); }
});

test('Near and Mid wing paint partitions share edges without coplanar triangle overlap', async () => {
  const control: XzPoint[] = [[0, 0], [1, 0], [0, 1]];
  assert(Math.abs(triangleOverlapArea(control, control) - .5) < 1e-12, 'The probe detects a fully duplicated face');
  assert(triangleOverlapArea(control, [[.1, .1], [.2, .1], [.1, .2]]) > .0049, 'The probe detects a small painted overlay');
  assert.equal(triangleOverlapArea(control, [[0, 0], [1, 0], [0, -1]]), 0, 'A shared boundary is allowed');
  for (const sex of sexes) {
    const root = createWesternGull({ sex, seed: 42 }), mesh = surface(root), lod = createLodController();
    try {
      await lod.register(root);
      for (const level of ['near', 'mid'] as const) {
        lod.setMode(level); lod.update(camera, 900, 0, true);
        const geometry = mesh.geometry, positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
        const joints = geometry.getAttribute('skinIndex'), index = geometry.index!;
        const wings = new Map<number, { points: XzPoint[]; height: number; face: number }[]>();
        for (let face = 0; face < index.count; face += 3) {
          const vertices = [index.getX(face), index.getX(face + 1), index.getX(face + 2)], joint = joints.getX(vertices[0]);
          if (joint < 1 || joint > 4 || !vertices.every(vertex => joints.getX(vertex) === joint && normals.getY(vertex) > .99)) continue;
          const height = positions.getY(vertices[0]);
          assert(vertices.every(vertex => Math.abs(positions.getY(vertex) - height) < 1e-7), 'Upward wing paint is one plane per joint');
          const triangles = wings.get(joint) ?? [];
          triangles.push({ points: vertices.map(vertex => [positions.getX(vertex), positions.getZ(vertex)]), height, face: face / 3 }); wings.set(joint, triangles);
        }
        assert.deepEqual([...wings.keys()].sort(), [1, 2, 3, 4], 'All four wing panels participate in the overlap check');
        for (const [joint, triangles] of wings) for (let a = 0; a < triangles.length; a++) for (let b = a + 1; b < triangles.length; b++) {
          if (Math.abs(triangles[a].height - triangles[b].height) > 1e-7) continue;
          const overlap = triangleOverlapArea(triangles[a].points, triangles[b].points);
          assert(overlap < 1e-9, `${sex}/${level} joint ${joint} faces ${triangles[a].face}/${triangles[b].face} overlap ${overlap} square metres`);
        }
      }
    } finally { disposeObject(root); lod.dispose(); }
  }
});

test('All poses and both sexes remain inside fixed animated bounds through every LOD', async () => {
  const point = new Vector3();
  for (const sex of sexes) {
    const root = createWesternGull({ sex, seed: 42 }), mesh = surface(root), lod = createLodController();
    const physics = JSON.stringify(root.userData.physics), skeleton = mesh.skeleton;
    try {
      await lod.register(root);
      assert(mesh.boundingBox && mesh.boundingSphere);
      const envelope = mesh.boundingBox.clone().expandByScalar(1e-7), sphere = mesh.boundingSphere.clone();
      for (const level of LOD_LEVELS) {
        lod.setMode(level); lod.update(camera, 900, 0, true);
        const geometry = mesh.geometry;
        for (const pose of GULL_POSES) {
          setGullPose(root, pose);
          for (let frame = 0; frame < (pose === 'standing' ? 1 : 72); frame++) {
            updateWesternGull(root, pose === 'flight' ? .157 : .025); warm(mesh);
            for (let vertex = 0; vertex < geometry.getAttribute('position').count; vertex++) {
              mesh.getVertexPosition(vertex, point);
              assert(point.toArray().every(Number.isFinite));
              assert(envelope.containsPoint(point), `${sex}/${level}/${pose} box excludes ${point.toArray()}`);
              assert(sphere.distanceToPoint(point) < 1e-7, `${sex}/${level}/${pose} sphere excludes ${point.toArray()}`);
            }
            assert.equal(mesh.geometry, geometry); assert.equal(mesh.skeleton, skeleton);
          }
        }
        assert.equal(JSON.stringify(root.userData.physics), physics); assert.deepEqual(root.scale.toArray(), [1, 1, 1]);
      }
    } finally { disposeObject(root); lod.dispose(); }
  }
});

// Independent analytic reconstruction of the flock's two-hinge vertex transform.
// Comparing positions (not only angles) detects bind-pose, pivot and hierarchy drift.
function flockFlight(point: Vector3, joint: number, sex: GullSex, seconds: number) {
  if (joint < 1 || joint > 4) return point;
  const smooth = (a: number, b: number, value: number) => { const t = Math.max(0, Math.min(1, (value - a) / (b - a))); return t * t * (3 - 2 * t); };
  const cycle = seconds % 8, strength = 1 - smooth(3.2, 3.8, cycle) * (1 - smooth(6.4, 7, cycle)) * .94;
  const phase = seconds * Math.PI * 2 * 2.3, side = joint % 2 === 0 ? 1 : -1, pivots = gullPivots(sex);
  const around = (pivot: Vector3, angle: number) => {
    point.sub(pivot); const x = point.x, y = point.y;
    point.x = x * Math.cos(angle) - y * Math.sin(angle); point.y = x * Math.sin(angle) + y * Math.cos(angle); point.add(pivot);
  };
  if (joint >= 3) around(pivots[joint], Math.sin(phase - .45) * .24 * strength * side);
  around(pivots[side < 0 ? 1 : 2], (Math.sin(phase) * .48 * strength + .10) * side);
  return point;
}

test('Skinned flight matches the instanced two-hinge transform during strokes, glides and cycle boundaries', async () => {
  const times = [0, .071, .19, .337, 3.2, 3.5, 3.8, 4.17, 6.4, 6.7, 7, 7.999, 8, 8.29, 16.11];
  const expected = new Vector3(), actual = new Vector3();
  for (const sex of sexes) {
    const root = createWesternGull({ sex, seed: 42 }), mesh = surface(root), lod = createLodController();
    try {
      await lod.register(root);
      for (const level of LOD_LEVELS) {
        lod.setMode(level); lod.update(camera, 900, 0, true);
        const positions = mesh.geometry.getAttribute('position'), joints = mesh.geometry.getAttribute('skinIndex');
        for (const time of times) {
          setGullPose(root, 'flight'); updateWesternGull(root, time); warm(mesh);
          for (let vertex = 0; vertex < positions.count; vertex++) {
            const joint = joints.getX(vertex); if ([5, 6, 9].includes(joint)) continue;
            flockFlight(expected.fromBufferAttribute(positions, vertex), joint, sex, time);
            mesh.getVertexPosition(vertex, actual);
            assert(expected.distanceTo(actual) < 2e-7, `${sex}/${level}/${time}s joint ${joint} differs from flock flight`);
          }
        }
      }
    } finally { disposeObject(root); lod.dispose(); }
  }
});

test('Animation uses elapsed seconds without rewriting vertex buffers, moving the host root or changing physics', () => {
  const a = createWesternGull({ seed: 42 }), b = createWesternGull({ seed: 42 }), mesh = surface(a);
  try {
    a.position.set(2, 3, -4); a.rotation.set(.2, .4, .1); a.updateMatrix();
    const matrix = a.matrix.clone(), physics = JSON.stringify(a.userData.physics);
    const snapshots = Object.values(mesh.geometry.attributes).map(attribute => ({ attribute: attribute as BufferAttribute, array: attribute.array, contents: attribute.array.slice(), version: (attribute as BufferAttribute).version }));
    for (let frame = 0; frame < 120; frame++) updateWesternGull(a, 1 / 60);
    for (let frame = 0; frame < 60; frame++) updateWesternGull(b, 1 / 30);
    assert(Math.abs(state(a).time - state(b).time) < 1e-10);
    state(a).wingAngles.forEach((angle, index) => assert(Math.abs(angle - state(b).wingAngles[index]) < 1e-10));
    for (const pose of GULL_POSES) {
      setGullPose(a, pose); const before = JSON.stringify(state(a));
      for (const delta of [0, -1, NaN, Infinity]) updateWesternGull(a, delta);
      assert.equal(JSON.stringify(state(a)), before);
    }
    setGullPose(a, 'standing'); const standing = JSON.stringify(state(a)); updateWesternGull(a, 100); assert.equal(JSON.stringify(state(a)), standing);
    a.updateMatrix(); assert(a.matrix.equals(matrix)); assert.equal(JSON.stringify(a.userData.physics), physics);
    for (const snapshot of snapshots) {
      assert.equal(snapshot.attribute.array, snapshot.array); assert.equal(snapshot.attribute.version, snapshot.version);
      assert.deepEqual(snapshot.attribute.array, snapshot.contents);
    }
  } finally { disposeObject(a); disposeObject(b); }
});

test('Optional pose blends unfold and settle continuously without changing host placement or vertex buffers', () => {
  for (const sex of sexes) {
    const root = createWesternGull({ sex, seed: 42, pose: 'standing' });
    const reference = createWesternGull({ sex, seed: 42, pose: 'flight' }), mesh = surface(root), target = surface(reference);
    const bones = mesh.skeleton.bones;
    const pose = () => bones.map(bone => ({ position: bone.position.clone(), rotation: bone.quaternion.clone(), scale: bone.scale.clone() }));
    const assertPose = (expected: ReturnType<typeof pose>, tolerance = 1e-7) => bones.forEach((bone, index) => {
      assert(bone.position.distanceTo(expected[index].position) < tolerance);
      assert(bone.quaternion.angleTo(expected[index].rotation) < tolerance);
      assert(bone.scale.distanceTo(expected[index].scale) < tolerance);
    });
    try {
      root.position.set(2, 3, -4); root.rotation.set(.2, .4, .1); root.updateMatrix();
      const placement = root.matrix.clone(), physics = JSON.stringify(root.userData.physics), geometry = mesh.geometry, skeleton = mesh.skeleton;
      const buffers = Object.values(geometry.attributes).map(attribute => ({ attribute: attribute as BufferAttribute, array: attribute.array, contents: attribute.array.slice(), version: (attribute as BufferAttribute).version }));
      const standing = pose();
      setGullPose(root, 'flight', .32); assertPose(standing);
      updateWesternGull(root, .0001); assertPose(standing, 1e-5);
      updateWesternGull(root, .1599);
      assert(bones[1].quaternion.angleTo(standing[1].rotation) > .1, 'The wings visibly unfold during the blend');
      updateWesternGull(root, .16); updateWesternGull(reference, .32);
      bones.forEach((bone, index) => {
        assert(bone.position.distanceTo(target.skeleton.bones[index].position) < 1e-7);
        assert(bone.quaternion.angleTo(target.skeleton.bones[index].quaternion) < 1e-7);
        assert(bone.scale.distanceTo(target.skeleton.bones[index].scale) < 1e-7);
      });
      const airborne = pose(); setGullPose(root, 'standing', .32); assertPose(airborne);
      updateWesternGull(root, .16);
      assert(bones[1].quaternion.angleTo(standing[1].rotation) < airborne[1].rotation.angleTo(standing[1].rotation), 'Landing folds the wings gradually');
      updateWesternGull(root, .16); assertPose(standing);
      assert.equal(state(root).pose, 'standing'); assert.equal(state(root).time, 0);
      updateWesternGull(root, 10); assertPose(standing);
      root.updateMatrix(); assert(root.matrix.equals(placement)); assert.equal(JSON.stringify(root.userData.physics), physics);
      assert.equal(mesh.geometry, geometry); assert.equal(mesh.skeleton, skeleton);
      for (const buffer of buffers) {
        assert.equal(buffer.attribute.array, buffer.array); assert.equal(buffer.attribute.version, buffer.version);
        assert.deepEqual(buffer.attribute.array, buffer.contents);
      }
    } finally { disposeObject(root); disposeObject(reference); }
  }
});

test('Automatic LOD reaches the sky silhouette at long range without resetting motion or host placement', async () => {
  const root = createWesternGull({ sex: 'female', seed: 42 }), mesh = surface(root), lod = createLodController();
  const view = new PerspectiveCamera(45, 1, .001, 10000);
  try {
    root.position.set(17, 28, -35); root.rotation.y = .71; root.updateMatrix();
    updateWesternGull(root, 4.2);
    const motion = JSON.stringify(state(root)), physics = JSON.stringify(root.userData.physics), placement = root.matrix.clone(), skeleton = mesh.skeleton;
    await lod.register(root);
    for (const [distance, expected] of [[3, 'near'], [30, 'mid'], [500, 'far'], [3, 'near']] as const) {
      view.position.copy(root.position).add(new Vector3(0, .34, distance)); view.lookAt(root.position.clone().add(new Vector3(0, .34, 0)));
      lod.update(view, 900, .2, true);
      assert.equal(lod.inspect(root)[0].level, expected);
      assert.equal(JSON.stringify(state(root)), motion); assert.equal(JSON.stringify(root.userData.physics), physics);
      root.updateMatrix(); assert(root.matrix.equals(placement)); assert.equal(mesh.skeleton, skeleton);
    }
  } finally { disposeObject(root); lod.dispose(); }
});

test('Standing and walking retain ground contact at every LOD and visibly alternate the lifted foot', async () => {
  const point = new Vector3();
  for (const sex of sexes) {
    const root = createWesternGull({ sex, seed: 42 }), mesh = surface(root), lod = createLodController();
    const scale = gullDimensions(sex).scale;
    try {
      await lod.register(root);
      for (const level of LOD_LEVELS) {
        lod.setMode(level); lod.update(camera, 900, 0, true);
        const positions = mesh.geometry.getAttribute('position'), joints = mesh.geometry.getAttribute('skinIndex');
        const feet = [5, 6].map(joint => Array.from({ length: positions.count }, (_, i) => i).filter(i => joints.getX(i) === joint && positions.getY(i) < .016 * scale));
        assert(feet.every(vertices => vertices.length > 0));
        setGullPose(root, 'standing'); warm(mesh);
        for (const foot of feet) {
          const lowest = Math.min(...foot.map(vertex => mesh.getVertexPosition(vertex, point).y / scale));
          assert(lowest >= 0 && lowest < .01, `${sex}/${level} standing foot remains on its perch`);
        }
        const maximumLift = [0, 0]; setGullPose(root, 'walking');
        for (let frame = 0; frame < 100; frame++) {
          updateWesternGull(root, 1 / (GULL.walkHz * 50)); warm(mesh);
          const minHeights = feet.map((vertices, side) => {
            const heights = vertices.map(vertex => mesh.getVertexPosition(vertex, point).y / scale);
            maximumLift[side] = Math.max(maximumLift[side], Math.min(...heights));
            assert(Math.min(...heights) > -.012, 'Rigid webbing may tilt slightly through the plane without burying the leg');
            return Math.min(...heights);
          });
          assert(Math.min(...minHeights) < .013, `${sex}/${level} always has a ground contact`);
        }
        assert(maximumLift.every(height => height > .015), 'Both feet take a visible step instead of sliding together');
      }
    } finally { disposeObject(root); lod.dispose(); }
  }
});

test('Poop is one bounded reusable effect, can be interrupted, and resets after a hitch without accumulating objects', () => {
  const root = createWesternGull({ seed: 42, pose: 'standing' }), mesh = surface(root);
  try {
    let objectCount = 0; root.traverse(() => objectCount++);
    const initialGeometry = mesh.geometry, droplet = mesh.skeleton.bones[9];
    for (let attempt = 0; attempt < 20; attempt++) {
      setGullPose(root, 'pooping'); assert.equal(state(root).poopActive, false);
      updateWesternGull(root, .41); assert.equal(state(root).poopActive, true);
      const start = droplet.position.y;
      updateWesternGull(root, .1); assert(droplet.position.y < start, 'The droplet falls after release');
      updateWesternGull(root, .65); assert.equal(state(root).poopActive, false, 'The effect clears before the pose finishes');
      updateWesternGull(root, GULL.poopDurationSeconds); assert.equal(state(root).pose, 'standing'); assert.equal(state(root).time, 0);
      let currentObjects = 0; root.traverse(() => currentObjects++); assert.equal(currentObjects, objectCount); assert.equal(mesh.geometry, initialGeometry);
    }
    setGullPose(root, 'pooping'); updateWesternGull(root, .5); assert(state(root).poopActive);
    setGullPose(root, 'flight'); assert.equal(state(root).poopActive, false);
    setGullPose(root, 'pooping'); updateWesternGull(root, 100); assert.equal(state(root).pose, 'standing'); assert.equal(state(root).poopActive, false);
  } finally { disposeObject(root); }
});

test('Disposing with Far active releases all geometry, material and skeleton once and unregisters animation', async () => {
  const root = createWesternGull({ seed: 42 }), mesh = surface(root), lod = createLodController();
  const releases = new Map<BufferGeometry, number>();
  await lod.register(root);
  for (const level of LOD_LEVELS) {
    lod.setMode(level); lod.update(camera, 900, 0, true); const geometry = mesh.geometry;
    releases.set(geometry, 0); geometry.addEventListener('dispose', () => releases.set(geometry, releases.get(geometry)! + 1));
  }
  let skeletonDisposals = 0, materialDisposals = 0;
  const originalDispose = mesh.skeleton.dispose.bind(mesh.skeleton);
  mesh.skeleton.dispose = () => { skeletonDisposals++; originalDispose(); };
  assert(!Array.isArray(mesh.material)); mesh.material.addEventListener('dispose', () => materialDisposals++);
  disposeObject(root);
  assert.equal(lod.size, 0); assert.equal(getGullState(root), undefined);
  assert.equal(releases.size, 3); assert([...releases.values()].every(count => count === 1));
  assert.equal(skeletonDisposals, 1); assert.equal(materialDisposals, 1);
  setGullPose(root, 'flight'); updateWesternGull(root, 1); assert.equal(getGullState(root), undefined);
  lod.dispose(); assert.equal(skeletonDisposals, 1);
});

test('female cream palette persists at every detail level with no topology or draw-cost change',()=>{
 for(const detail of LOD_LEVELS){
  const male=buildGullGeometry({sex:'male',seed:42,detail}),female=buildGullGeometry({sex:'female',seed:42,detail});
  try{
   assert.equal(triangles(male),triangles(female));assert.deepEqual(male.index!.array,female.index!.array);
   assert.notDeepEqual(male.attributes.color.array,female.attributes.color.array);
   for(const [g,hex] of [[male,'#deddd1'],[female,'#eee2cc']] as const){
    const expected=new Color(hex),a=g.attributes.color;let found=false;
    for(let i=0;i<a.count;i++)if(Math.abs(a.getX(i)-expected.r)<1e-6&&Math.abs(a.getY(i)-expected.g)<1e-6&&Math.abs(a.getZ(i)-expected.b)<1e-6)found=true;
    assert(found,detail+' retains body palette');
   }
  }finally{male.dispose();female.dispose();}
 }
});
