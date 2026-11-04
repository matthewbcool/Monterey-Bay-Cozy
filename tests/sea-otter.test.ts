import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BufferAttribute, BufferGeometry, DoubleSide, Float32BufferAttribute, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, MeshToonMaterial, PerspectiveCamera, Raycaster, SkinnedMesh, Texture, Vector3 } from 'three';
import { createSeaOtter, getSeaOtter, setSeaOtterPose, updateSeaOtter } from '../src/models/habitat/sea-otter/createSeaOtter';
import { SEA_OTTER_BONE_NAMES } from '../src/models/habitat/sea-otter/definition';
import { createLodController } from '../src/models/shared/lod/controller';
import { geometryBytes, LOD_LEVELS, prepareGeometryLods, triangles } from '../src/models/shared/lod/geometry';
import { exportableClone, toonRamp } from '../src/models/shared/style';
import { disposeObject } from '../src/models/props/primitives';

type Otter = ReturnType<typeof createSeaOtter>;
const poses = ['float', 'swim', 'groom', 'dive'] as const;
const budgets = { near: 1500, mid: 700, far: 220 } as const;
const camera = new PerspectiveCamera(45, 1, .001, 10000);
const warm = (otter: Otter) => { otter.root.updateMatrixWorld(true); otter.mesh.skeleton.update(); };
const transforms = (otter: Otter) => otter.rig.bones.flatMap(bone => [...bone.position.toArray(), ...bone.quaternion.toArray(), ...bone.scale.toArray()]);
const close = (a: number, b: number, tolerance = 1e-7, message = '') => assert(Math.abs(a - b) < tolerance, `${message}: ${a} != ${b}`);
const joint = (name: typeof SEA_OTTER_BONE_NAMES[number]) => SEA_OTTER_BONE_NAMES.indexOf(name);

function jointVertices(geometry: BufferGeometry, bone: number) {
  const skin = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight, indices: number[] = [];
  for (let i = 0; i < skin.count; i++) for (let k = 0; k < 4; k++)
    if (skin.getComponent(i, k) === bone && weights.getComponent(i, k) > .5) { indices.push(i); break; }
  assert(indices.length > 0, SEA_OTTER_BONE_NAMES[bone] + ' has a visible surface');
  return indices;
}

function assertGeometry(geometry: BufferGeometry, jointCount: number) {
  const position = geometry.attributes.position, joints = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
  assert(position && joints && weights && geometry.attributes.normal && geometry.attributes.color);
  assert(geometry.index); assert.equal(geometry.index.count % 3, 0);
  assert(geometry.index.count > 0);
  for (const index of geometry.index.array) assert(Number.isInteger(index) && index >= 0 && index < position.count);
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    assert.equal(attribute.count, position.count, name + ' vertex records match');
    assert(attribute.array.every(Number.isFinite), name + ' finite values');
  }
  assert.equal(joints.itemSize, 4); assert.equal(weights.itemSize, 4);
  const used = new Set<number>();
  for (let i = 0; i < position.count; i++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      const joint = joints.getComponent(i, k), weight = weights.getComponent(i, k);
      assert(Number.isInteger(joint) && joint >= 0 && joint < jointCount);
      assert(weight >= 0 && weight <= 1); sum += weight;
      if (weight > 0) used.add(joint);
    }
    close(sum, 1, 1e-6, 'normalized skin');
  }
  return used;
}

test('32 seeded sea otters retain one matte skin and bounded finite geometry at every authored detail level', async () => {
  let referenceAttributes: Record<string, ArrayLike<number>> | undefined, varied = false;
  for (let seed = 0; seed < 32; seed++) {
    const otter = createSeaOtter({ seed }), levels = await prepareGeometryLods(otter.mesh.geometry);
    try {
      assert(otter.mesh instanceof SkinnedMesh);
      const meshes: Mesh[] = []; otter.root.traverse(o => { if (o instanceof Mesh) meshes.push(o); });
      assert.deepEqual(meshes, [otter.mesh]);
      assert(otter.mesh.material instanceof MeshToonMaterial);
      assert.equal(otter.mesh.material.gradientMap, toonRamp('matte'));
      assert.equal(otter.mesh.material.transparent, false);
      for (const [key, value] of Object.entries(otter.mesh.material)) if (value instanceof Texture) assert.equal(key, 'gradientMap', 'shared generated ramp only');
      assert.deepEqual(otter.root.scale.toArray(), [1, 1, 1]);
      assert.equal(otter.root.userData.units, 'metres'); assert.equal(otter.root.userData.seed, seed);
      assert.equal(getSeaOtter(otter.root), otter);
      const nearJoints = assertGeometry(levels.near, otter.rig.bones.length);
      const costs: number[] = [], bytes: number[] = [];
      for (const level of LOD_LEVELS) {
        const geometry = levels[level];
        assert.deepEqual(assertGeometry(geometry, otter.rig.bones.length), nearJoints, level + ' keeps the same articulated anatomy');
        assert(triangles(geometry) <= budgets[level], `${level}: ${triangles(geometry)} triangles`);
        assert.equal(geometry.hasAttribute('uv'), false, 'no downloaded fur texture');
        costs.push(triangles(geometry)); bytes.push(geometryBytes(geometry));
      }
      assert(costs[0] > costs[1] && costs[1] > costs[2], 'distant otters genuinely reduce geometry');
      assert(bytes[0] > bytes[1] && bytes[1] > bytes[2]);
      if (!referenceAttributes) referenceAttributes = Object.fromEntries(Object.entries(levels.near.attributes).map(([name, attribute]) => [name, attribute.array.slice()]));
      else varied ||= Object.entries(levels.near.attributes).some(([name, attribute]) => Array.from(attribute.array).some((value, i) => value !== referenceAttributes![name][i]));
      if (!seed) console.log('Sea otter LOD', { triangles: costs, draws: 1, geometryBytes: bytes, totalBytes: bytes.reduce((a, b) => a + b, 0) });
    } finally { otter.dispose(); }
  }
  assert(varied, 'the seeded specimen has reproducible natural variation');
  const a = createSeaOtter({ seed: 19 }), b = createSeaOtter({ seed: 19 });
  try {
    const first = await prepareGeometryLods(a.mesh.geometry), second = await prepareGeometryLods(b.mesh.geometry);
    for (const level of LOD_LEVELS) {
      assert.deepEqual(first[level].index!.array, second[level].index!.array);
      for (const name of Object.keys(first[level].attributes)) assert.deepEqual(first[level].attributes[name].array, second[level].attributes[name].array);
    }
  } finally { a.dispose(); b.dispose(); }
});

test('every pose stays inside conservative motion bounds without rewriting the geometry, host transform or physics', async () => {
  const otter = createSeaOtter({ seed: 42 }), lod = createLodController(), point = new Vector3();
  otter.root.position.set(3, 4, -5); otter.root.rotation.set(.2, -.7, .1); otter.root.updateMatrix();
  const placement = otter.root.matrix.clone(), physics = JSON.stringify(otter.physics), skeleton = otter.mesh.skeleton;
  try {
    await lod.register(otter.root);
    assert(otter.mesh.boundingBox && otter.mesh.boundingSphere);
    const box = otter.mesh.boundingBox.clone().expandByScalar(1e-6), sphere = otter.mesh.boundingSphere.clone();
    for (const level of LOD_LEVELS) {
      lod.setMode(level); lod.update(camera, 900, 0, true);
      const geometry = otter.mesh.geometry;
      const buffers = [...Object.values(geometry.attributes), geometry.index!].map(a => ({ attribute: a as BufferAttribute, array: a.array, values: a.array.slice(), version: (a as BufferAttribute).version }));
      for (const pose of poses) for (let i = 0; i < 80; i++) {
        otter.poseAt(i * .173, { pose }); warm(otter);
        for (let vertex = 0; vertex < geometry.attributes.position.count; vertex++) {
          otter.mesh.getVertexPosition(vertex, point);
          assert(point.toArray().every(Number.isFinite));
          assert(box.containsPoint(point), `${level}/${pose}: box misses ${point.toArray()}`);
          assert(sphere.distanceToPoint(point) <= 1e-6, `${level}/${pose}: sphere misses ${point.toArray()}`);
        }
      }
      for (const buffer of buffers) {
        assert.equal(buffer.attribute.array, buffer.array); assert.equal(buffer.attribute.version, buffer.version);
        assert.deepEqual(buffer.array, buffer.values);
      }
      assert.equal(otter.mesh.geometry, geometry); assert.equal(otter.mesh.skeleton, skeleton);
    }
    otter.root.updateMatrix(); assert(otter.root.matrix.equals(placement));
    assert.equal(JSON.stringify(otter.physics), physics);
  } finally { lod.dispose(); otter.dispose(); }
});

test('both grooming paws approach the actual face while the floating pose keeps them near the chest', async () => {
  const otter = createSeaOtter({ seed: 17 }), lod = createLodController();
  const pawJoints = [joint('left-paw'), joint('right-paw')], p = new Vector3(), q = new Vector3();
  try {
    await lod.register(otter.root);
    for (const level of LOD_LEVELS) {
      lod.setMode(level); lod.update(camera, 900, 0, true);
      const geometry = otter.mesh.geometry, head = jointVertices(geometry, joint('head'));
      const paws = pawJoints.map(bone => jointVertices(geometry, bone));
      const faceFeatures = [...new Set((geometry.userData.partRanges as { name: string; start: number; count: number }[])
        .filter(part => ['small-dark-eye', 'cream-muzzle-lobe', 'broad-dark-nose'].includes(part.name))
        .flatMap(part => Array.from({ length: part.count }, (_, i) => geometry.index!.getX(part.start + i))))];
      assert(faceFeatures.length > 0);
      function distanceToFace(vertices: number[], landmarks = head) {
        let distance = Infinity;
        for (const vertex of vertices) {
          otter.mesh.getVertexPosition(vertex, p);
          for (const face of landmarks) { otter.mesh.getVertexPosition(face, q); distance = Math.min(distance, p.distanceTo(q)); }
        }
        return distance;
      }
      otter.poseAt(0, { pose: 'float' }); warm(otter);
      const resting = paws.map(vertices => distanceToFace(vertices)), nearest = [Infinity, Infinity], nearestFeatures = [Infinity, Infinity], farthest = [0, 0];
      for (let frame = 0; frame < 48; frame++) {
        otter.poseAt(frame * .113, { pose: 'groom' }); warm(otter);
        paws.forEach((vertices, side) => {
          const distance = distanceToFace(vertices);
          nearest[side] = Math.min(nearest[side], distance); farthest[side] = Math.max(farthest[side], distance);
          nearestFeatures[side] = Math.min(nearestFeatures[side], distanceToFace(vertices, faceFeatures));
        });
      }
      for (let side = 0; side < 2; side++) {
        assert(nearest[side] < otter.dimensions.lengthMeters * .045, `${level} paw ${side} actually reaches the cheek surface (${nearest[side]}m)`);
        assert(nearestFeatures[side] < otter.dimensions.lengthMeters * .07, `${level} paw ${side} approaches the eyes/muzzle region, not just the back of the skull or neck`);
        assert(resting[side] - nearest[side] > otter.dimensions.lengthMeters * .035, `${level} grooming lifts the paw from its chest resting position`);
        assert(farthest[side] - nearest[side] > .003, 'grooming has a rubbing motion rather than a static raised paw');
      }
    }
  } finally { lod.dispose(); otter.dispose(); }
});

test('both eyes and muzzle pads overlap the actual head surface at every LOD and physical size', async () => {
  const material = new MeshBasicMaterial({ side: DoubleSide }), ray = new Raycaster();
  type PartRange = { name: string; start: number; count: number };
  function sourcePart(source: BufferGeometry, range: PartRange) {
    const values: number[] = [], positions = source.attributes.position;
    for (let n = range.start; n < range.start + range.count; n++) {
      const i = source.index!.getX(n); values.push(positions.getX(i), positions.getY(i), positions.getZ(i));
    }
    const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(values, 3));
    const mesh = new Mesh(geometry, material); mesh.updateMatrixWorld(true); return mesh;
  }
  /** Vertical probes compare the actual triangulated skull and facial surfaces.
   * No profile radii, eye coordinates or projection offsets are reproduced here. */
  function clearance(part: Mesh, head: Mesh, length: number) {
    const p = part.geometry.attributes.position;
    head.geometry.computeBoundingBox(); const top = head.geometry.boundingBox!.max.y + length * .25;
    let lowest = Infinity, highest = -Infinity, hits = 0;
    for (let i = 0; i < p.count; i++) {
      ray.set(new Vector3(p.getX(i), top, p.getZ(i)), new Vector3(0, -1, 0));
      const surface = ray.intersectObject(head)[0];
      if (!surface) continue; // Forward muzzle tips may naturally overhang the nose.
      const gap = p.getY(i) - surface.point.y;
      lowest = Math.min(lowest, gap); highest = Math.max(highest, gap); hits++;
    }
    return { lowest, highest, hits };
  }
  try {
    for (const lengthMeters of [1, 1.5]) {
      const otter = createSeaOtter({ seed: 23, lengthMeters });
      try {
        const levels = await prepareGeometryLods(otter.mesh.geometry);
        for (const level of LOD_LEVELS) {
          const geometry = levels[level], ranges = geometry.userData.partRanges as PartRange[];
          assert(Array.isArray(ranges), 'named source geometry remains inspectable after batching');
          const headRange = ranges.find(range => range.name === 'continuous-head-neck-chest-belly-rump');
          assert(headRange); const head = sourcePart(geometry, headRange);
          const eyeRanges = ranges.filter(range => range.name === 'small-dark-eye'), muzzleRanges = ranges.filter(range => range.name === 'cream-muzzle-lobe');
          assert.equal(eyeRanges.length, 2); assert.equal(muzzleRanges.length, 2);
          const earRanges = ranges.filter(range => range.name === 'small-ear-silhouette' || range.name === 'small-rounded-ear');
          assert.equal(earRanges.length, 2);
          const eyes = eyeRanges.map(range => sourcePart(geometry, range)), muzzles = muzzleRanges.map(range => sourcePart(geometry, range)), ears = earRanges.map(range => sourcePart(geometry, range));
          try {
            for (const [i, eye] of eyes.entries()) {
              const contact = clearance(eye, head, lengthMeters);
              assert(contact.hits >= eye.geometry.attributes.position.count * .75, `${level} eye ${i} lies over the actual skull`);
              assert(contact.lowest <= .0015 * lengthMeters, `${level} eye ${i} floats ${contact.lowest}m away from the skull`);
              assert(contact.highest > .001 * lengthMeters, `${level} eye ${i} stays visible above the coat`);
            }
            for (const [i, muzzle] of muzzles.entries()) {
              const contact = clearance(muzzle, head, lengthMeters);
              assert(contact.hits >= 3, 'muzzle attachment is supported by real head geometry');
              assert(contact.lowest <= .0015 * lengthMeters, `${level} muzzle ${i} floats above the face`);
              assert(contact.highest > .001 * lengthMeters, 'muzzle still projects beyond the coat');
            }
            for (const [side, ear] of ears.entries()) {
              const p = ear.geometry.attributes.position, center = new Vector3(), a = new Vector3(), b = new Vector3(), c = new Vector3(), normal = new Vector3(), face = new Vector3();
              for (let i = 0; i < p.count; i++) center.add(a.fromBufferAttribute(p, i));
              center.divideScalar(p.count);
              const edges = new Map<string, number>();
              const vertexKey = (i: number) => [p.getX(i), p.getY(i), p.getZ(i)].map(value => Math.round(value * 1e7)).join(',');
              for (let i = 0; i < p.count; i += 3) {
                a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
                face.copy(a).add(b).add(c).divideScalar(3).sub(center);
                normal.crossVectors(b.sub(a), c.sub(a));
                assert(normal.dot(face) > 0, `${level} ear ${side} has outward-facing triangles on both mirrored sides`);
                for (let edge = 0; edge < 3; edge++) {
                  const pair = [vertexKey(i + edge), vertexKey(i + (edge + 1) % 3)].sort().join('|');
                  edges.set(pair, (edges.get(pair) ?? 0) + 1);
                }
              }
              assert([...edges.values()].every(count => count === 2), `${level} ear ${side} is closed without missing/back-to-back faces`);
            }
            const detached = new Mesh(eyes[0].geometry.clone().translate(0, .04 * lengthMeters, 0), material);
            detached.updateMatrixWorld(true);
            try { assert(clearance(detached, head, lengthMeters).lowest > .015 * lengthMeters, 'negative control detects a visibly detached eye'); }
            finally { detached.geometry.dispose(); }
          } finally { for (const part of [head, ...eyes, ...muzzles, ...ears]) part.geometry.dispose(); }
        }
      } finally { otter.dispose(); }
    }
  } finally { material.dispose(); }
});

test('swimming visibly strokes the large hind flippers while the front paws remain restrained', async () => {
  const otter = createSeaOtter({ seed: 6 }), lod = createLodController();
  const roles = ['left-paw', 'right-paw', 'left-hind-flipper', 'right-hind-flipper'] as const;
  const point = new Vector3(), bodyInverse = new Matrix4();
  try {
    await lod.register(otter.root);
    for (const level of LOD_LEVELS) {
      lod.setMode(level); lod.update(camera, 900, 0, true);
      const geometry = otter.mesh.geometry;
      const tips = roles.map(name => {
        const bone = joint(name), pivot = otter.rig.pivots[bone], vertices = jointVertices(geometry, bone);
        let selected = vertices[0], distance = -Infinity;
        for (const vertex of vertices) {
          const d = point.fromBufferAttribute(geometry.attributes.position, vertex).distanceToSquared(pivot);
          if (d > distance) { selected = vertex; distance = d; }
        }
        return selected;
      });
      const envelopes = tips.map(() => new Box3());
      for (let frame = 0; frame < 72; frame++) {
        otter.poseAt(frame * .097, { pose: 'swim' }); warm(otter);
        bodyInverse.copy(otter.rig.bones[joint('body')].matrixWorld).invert();
        tips.forEach((vertex, i) => {
          otter.mesh.getVertexPosition(vertex, point).applyMatrix4(otter.mesh.matrixWorld).applyMatrix4(bodyInverse);
          envelopes[i].expandByPoint(point);
        });
      }
      const excursions = envelopes.map(box => box.getSize(point).length());
      const front = Math.max(excursions[0], excursions[1]), hind = Math.min(excursions[2], excursions[3]);
      assert(hind > otter.dimensions.lengthMeters * .07, `${level} both hind flippers make a visible propulsive stroke: ${excursions}`);
      assert(hind > front * 2, `${level} hind propulsion dominates front-paw movement: ${excursions}`);
    }
  } finally { lod.dispose(); otter.dispose(); }
});

test('surface floating holds paws above the torso while underwater cruising tucks them below an upright forward head at every LOD', async () => {
  const otter = createSeaOtter({ seed: 12 }), lod = createLodController(), point = new Vector3();
  try {
    await lod.register(otter.root);
    for (const level of LOD_LEVELS) {
      lod.setMode(level); lod.update(camera, 900, 0, true);
      const geometry = otter.mesh.geometry, positions = geometry.attributes.position;
      const parts = geometry.userData.partRanges as { name: string; start: number; count: number }[];
      const body = parts
        .find(part => part.name === 'continuous-head-neck-chest-belly-rump');
      assert(body, 'the connected torso remains independently inspectable');
      const middle = [...new Set(Array.from({ length: body.count }, (_, i) => geometry.index!.getX(body.start + i)))]
        .filter(i => Math.abs(positions.getZ(i)) < otter.dimensions.lengthMeters * .12);
      assert(middle.length > 0, 'the actual torso supplies the orientation landmarks');
      const paws = (['left-paw', 'right-paw'] as const).map(name => jointVertices(geometry, joint(name)));
      const featureVertices = (name: string) => [...new Set(parts.filter(part => part.name === name)
        .flatMap(part => Array.from({ length: part.count }, (_, i) => geometry.index!.getX(part.start + i))))];
      const eyes = featureVertices('small-dark-eye'), nose = featureVertices('broad-dark-nose');
      assert(eyes.length > 0 && nose.length > 0);
      const center = (vertices: number[], target: Vector3) => {
        target.set(0, 0, 0);
        for (const vertex of vertices) target.add(otter.mesh.getVertexPosition(vertex, point));
        return target.divideScalar(vertices.length);
      };
      const eyeCenter = new Vector3(), noseCenter = new Vector3(), torsoCenter = new Vector3(), pawCenter = new Vector3();
      for (const time of [0, .4, 1.1, 2.3, 4.7]) {
        otter.poseAt(time, { pose: 'float' }); warm(otter);
        center(middle, torsoCenter);
        for (const [side, vertices] of paws.entries()) {
          center(vertices, pawCenter);
          assert(pawCenter.y > torsoCenter.y + otter.dimensions.lengthMeters * .04, `${level} floating paw ${side} rests above the chest`);
        }
        otter.poseAt(time, { pose: 'swim' }); warm(otter);
        center(middle, torsoCenter);
        // The uniform torso has no visible belly/back marking. Require the
        // observable swimming anatomy instead of a hidden 180-degree skin roll
        // that would unnecessarily twist the continuous neck surface.
        for (const [side, vertices] of paws.entries()) {
          center(vertices, pawCenter);
          assert(pawCenter.y < torsoCenter.y - otter.dimensions.lengthMeters * .035, `${level} underwater paw ${side} tucks beneath the torso rather than remaining in a floating pose`);
        }
        center(eyes, eyeCenter); center(nose, noseCenter);
        assert(eyeCenter.y > noseCenter.y + otter.dimensions.lengthMeters * .005, `${level} cruising eyes stay above the muzzle instead of inheriting an inverted face`);
        assert(noseCenter.z < eyeCenter.z - otter.dimensions.lengthMeters * .015, `${level} cruising muzzle points forward along local −Z`);
      }
    }
    assert.deepEqual(otter.root.position.toArray(), [0, 0, 0]);
    assert.deepEqual(otter.root.rotation.toArray().slice(0, 3), [0, 0, 0]);
    assert.deepEqual(otter.root.scale.toArray(), [1, 1, 1]);
  } finally { lod.dispose(); otter.dispose(); }
});

test('surface, underwater and grooming transitions keep the skin continuous, bounded and independent of its placement root', () => {
  const otter = createSeaOtter({ seed: 14 }), point = new Vector3();
  otter.root.position.set(11, 2, -7); otter.root.rotation.y = .8; otter.root.updateMatrix();
  const placement = otter.root.matrix.clone();
  const envelope = otter.mesh.boundingBox!.clone().expandByScalar(1e-6);
  const sample = () => Array.from({ length: otter.mesh.geometry.attributes.position.count }, (_, i) => otter.mesh.getVertexPosition(i, new Vector3()));
  try {
    warm(otter); let previous = sample();
    for (const pose of ['swim', 'float', 'dive', 'swim', 'groom', 'float'] as const) {
      otter.setPose(pose, .55); warm(otter);
      sample().forEach((p, i) => assert(p.distanceTo(previous[i]) < 1e-7, 'requesting the roll cannot teleport a vertex'));
      for (let frame = 0; frame < 225; frame++) {
        otter.update(1 / 120); warm(otter);
        for (let i = 0; i < previous.length; i++) {
          otter.mesh.getVertexPosition(i, point);
          assert(point.distanceTo(previous[i]) < otter.dimensions.lengthMeters * .04, `${pose}: no sudden skin jump during the pose transition`);
          assert(envelope.containsPoint(point), `${pose}: intermediate pose stays within the fixed culling bounds`);
          previous[i].copy(point);
        }
      }
    }
    otter.root.updateMatrix(); assert(otter.root.matrix.equals(placement));
  } finally { otter.dispose(); }
});

test('the default floating frame is belly-up and a dive lowers the head locally without translating the host', () => {
  const otter = createSeaOtter({ seed: 12 }), point = new Vector3();
  try {
    assert(otter.rig.pivots[joint('head')].z < otter.rig.pivots[joint('chest')].z, 'head points toward local −Z');
    assert(otter.rig.pivots[joint('left-paw')].y > otter.rig.pivots[joint('chest')].y, 'resting paws sit above the belly');
    const head = jointVertices(otter.mesh.geometry, joint('head')), tail = jointVertices(otter.mesh.geometry, joint('tail-tip'));
    function meanY(vertices: number[]) {
      let y = 0; for (const vertex of vertices) y += otter.mesh.getVertexPosition(vertex, point).y;
      return y / vertices.length;
    }
    otter.poseAt(0, { pose: 'float' }); warm(otter); const floatingHead = meanY(head);
    let lowered = Infinity, tailAboveHead = 0;
    for (const time of [.5, 1, 1.5, 2, 3, 4, 5]) {
      otter.poseAt(time, { pose: 'dive' }); warm(otter);
      const y = meanY(head); lowered = Math.min(lowered, y); tailAboveHead = Math.max(tailAboveHead, meanY(tail) - y);
    }
    assert(lowered < floatingHead - otter.dimensions.lengthMeters * .2, 'dive actually tips the nose below its floating position');
    assert(tailAboveHead > otter.dimensions.lengthMeters * .4, 'tail follows above the diving head');
    assert.deepEqual(otter.root.position.toArray(), [0, 0, 0]); assert.deepEqual(otter.root.rotation.toArray().slice(0, 3), [0, 0, 0]);
  } finally { otter.dispose(); }
});

function assertScaledNumbers(small: unknown, large: unknown, ratio: number, path: string) {
  if (typeof small === 'number') { assert.equal(typeof large, 'number'); close(large as number, small * ratio, 1e-6, path); }
  else if (Array.isArray(small)) {
    assert(Array.isArray(large)); assert.equal(large.length, small.length);
    small.forEach((value, i) => assertScaledNumbers(value, large[i], ratio, path + '/' + i));
  } else if (small && typeof small === 'object') {
    assert(large && typeof large === 'object');
    for (const [key, value] of Object.entries(small)) assertScaledNumbers(value, (large as Record<string, unknown>)[key], ratio, path + '/' + key);
  } else assert.equal(large, small, path);
}

test('the default 1.2m adult and accepted size range scale skin, rig and physical anchors together without scaling the root', async () => {
  const normal = createSeaOtter({ seed: 9 }), small = createSeaOtter({ seed: 9, lengthMeters: 1 }), large = createSeaOtter({ seed: 9, lengthMeters: 1.5 });
  try {
    assert.equal(normal.dimensions.lengthMeters, 1.2);
    assert.equal(small.dimensions.lengthMeters, 1); assert.equal(large.dimensions.lengthMeters, 1.5);
    for (const otter of [normal, small, large]) {
      assert.deepEqual(otter.root.scale.toArray(), [1, 1, 1]);
      assert.equal(otter.root.userData.lengthMeters, otter.dimensions.lengthMeters);
      assert(otter.physics.colliders.length > 0 && otter.physics.colliders.length <= 3, 'cheap future-physics proxies');
    }
    const a = await prepareGeometryLods(small.mesh.geometry), b = await prepareGeometryLods(large.mesh.geometry);
    for (const level of LOD_LEVELS) {
      const p = a[level].attributes.position, q = b[level].attributes.position;
      assert.equal(p.count, q.count);
      for (let i = 0; i < p.array.length; i++) close(q.array[i], p.array[i] * 1.5, 2e-7, level + ' metre geometry');
      assert.deepEqual(a[level].attributes.skinIndex.array, b[level].attributes.skinIndex.array);
      assert.deepEqual(a[level].attributes.skinWeight.array, b[level].attributes.skinWeight.array);
      assert.deepEqual(a[level].index!.array, b[level].index!.array);
      for (const [otter, geometry] of [[small, a[level]], [large, b[level]]] as const) {
        otter.mesh.geometry = geometry;
        for (const pose of poses) {
          otter.poseAt(2.3, { pose }); warm(otter);
          const point = new Vector3(), envelope = otter.mesh.boundingBox!.clone().expandByScalar(1e-6);
          for (let i = 0; i < geometry.attributes.position.count; i++) {
            otter.mesh.getVertexPosition(i, point); assert(envelope.containsPoint(point), 'scaled posed geometry keeps conservative bounds');
          }
        }
      }
    }
    small.rig.pivots.forEach((pivot, i) => assert(large.rig.pivots[i].distanceTo(pivot.clone().multiplyScalar(1.5)) < 1e-7));
    assertScaledNumbers(small.physics.colliders, large.physics.colliders, 1.5, 'colliders');
    assertScaledNumbers(small.physics.anchors, large.physics.anchors, 1.5, 'anchors');
    const point = new Vector3(); let minZ = Infinity, maxZ = -Infinity;
    normal.poseAt(0, { pose: 'float' }); warm(normal);
    for (let i = 0; i < normal.mesh.geometry.attributes.position.count; i++) {
      normal.mesh.getVertexPosition(i, point); minZ = Math.min(minZ, point.z); maxZ = Math.max(maxZ, point.z);
    }
    assert(maxZ - minZ > 1.08 && maxZ - minZ < 1.32, 'actual floating silhouette agrees with the nominal 1.2m adult length');
  } finally { normal.dispose(); small.dispose(); large.dispose(); }
  for (const lengthMeters of [0, -.1, .99, 1.51, NaN, Infinity]) assert.throws(() => createSeaOtter({ lengthMeters }), /length|metre|range/i);
  for (const seed of [-1, .5, 2 ** 32, NaN]) assert.throws(() => createSeaOtter({ seed }), /seed|uint32/i);
  assert.throws(() => createSeaOtter({ pose: 'walking' as never }), /pose/i);
});

test('transitions begin continuously, absolute samples repeat, time partitions agree and reduced motion freezes clocks and bones', () => {
  const a = createSeaOtter({ seed: 4 }), b = createSeaOtter({ seed: 4 });
  try {
    const initial = transforms(a);
    setSeaOtterPose(a.root, 'groom', .6);
    assert.deepEqual(transforms(a), initial, 'requesting a blend never teleports the paws');
    updateSeaOtter(a.root, .0001);
    assert(Math.max(...transforms(a).map((value, i) => Math.abs(value - initial[i]))) < .001);
    a.update(.2999);
    assert.notDeepEqual(transforms(a), initial, 'the blend actually articulates the rig');
    const frozen = transforms(a), time = a.time, pose = a.pose;
    a.update(1, { reducedMotion: true, pose: 'dive' });
    assert.equal(a.time, time); assert.equal(a.pose, pose); assert.deepEqual(transforms(a), frozen);
    for (const dt of [0, -1, NaN, Infinity]) a.update(dt);
    assert.equal(a.time, time); assert.deepEqual(transforms(a), frozen);
    for (const at of [-1, NaN, Infinity]) a.poseAt(at, { pose: 'dive' });
    assert.equal(a.time, time); assert.deepEqual(transforms(a), frozen);
    a.poseAt(2.3, { pose: 'groom' }); const groom = transforms(a);
    a.poseAt(9.7, { pose: 'dive' }); a.poseAt(2.3, { pose: 'groom' });
    assert.deepEqual(transforms(a), groom);
    a.poseAt(0, { pose: 'swim' }); b.poseAt(0, { pose: 'swim' });
    for (let i = 0; i < 120; i++) a.update(1 / 60);
    for (let i = 0; i < 60; i++) b.update(1 / 30);
    close(a.time, b.time, 1e-10);
    transforms(a).forEach((value, i) => close(value, transforms(b)[i], 1e-8, 'frame-independent motion'));
    a.setPose('float', 0); assert.equal(a.pose, 'float');
    assert.throws(() => a.setPose('standing' as never), /pose/i);
  } finally { a.dispose(); b.dispose(); }
});

test('automatic distance detail preserves pose/physics and export clones retain independent skin bindings at the selected level', async () => {
  const otter = createSeaOtter({ seed: 21 }), lod = createLodController();
  otter.root.position.set(17, 28, -35); otter.root.rotation.y = .71; otter.root.updateMatrix();
  otter.poseAt(2.7, { pose: 'groom' }); warm(otter);
  const placement = otter.root.matrix.clone(), physics = JSON.stringify(otter.physics), motion = transforms(otter), time = otter.time;
  try {
    await lod.register(otter.root);
    const target = otter.mesh.localToWorld(otter.mesh.boundingSphere!.center.clone());
    for (const [distance, expected] of [[3, 'near'], [30, 'mid'], [500, 'far'], [3, 'near']] as const) {
      camera.position.copy(target).add(new Vector3(0, 0, distance)); camera.lookAt(target);
      lod.update(camera, 900, .2, true);
      assert.equal(lod.inspect(otter.root)[0].level, expected);
      assert.deepEqual(transforms(otter), motion); assert.equal(otter.time, time);
      assert.equal(JSON.stringify(otter.physics), physics);
      otter.root.updateMatrix(); assert(otter.root.matrix.equals(placement));
    }
    lod.setMode('far'); lod.update(camera, 900, 0, true);
    const sourceMaterial = otter.mesh.material, copy = exportableClone(otter.root);
    try {
      const meshes: SkinnedMesh[] = []; copy.clone.traverse(o => { if (o instanceof SkinnedMesh) meshes.push(o); });
      assert.equal(meshes.length, 1); const cloned = meshes[0];
      assert(cloned.material instanceof MeshStandardMaterial); assert.equal(cloned.material.vertexColors, true);
      assert.equal(cloned.geometry, otter.mesh.geometry, 'export uses the displayed distance variant');
      assert.notEqual(cloned.skeleton, otter.mesh.skeleton);
      const objects = new Set<object>(); copy.clone.traverse(o => objects.add(o));
      cloned.skeleton.bones.forEach((bone, i) => { assert.notEqual(bone, otter.rig.bones[i]); assert(objects.has(bone), 'export skin references its own cloned bones'); });
      copy.clone.updateMatrixWorld(true); cloned.skeleton.update(); warm(otter);
      const a = new Vector3(), b = new Vector3();
      for (let i = 0; i < cloned.geometry.attributes.position.count; i++) {
        cloned.getVertexPosition(i, a); otter.mesh.getVertexPosition(i, b);
        assert(a.distanceTo(b) < 1e-6, 'export preserves the actual posed surface');
      }
    } finally { copy.dispose(); }
    assert.equal(otter.mesh.material, sourceMaterial); assert(otter.mesh.material instanceof MeshToonMaterial);
  } finally { lod.dispose(); otter.dispose(); }
});

test('Far-active disposal releases all owned variants, material and skeleton once and unregisters the model', async () => {
  const otter = createSeaOtter({ seed: 8 }), lod = createLodController();
  await lod.register(otter.root);
  const levels = await prepareGeometryLods(otter.mesh.geometry), released = [0, 0, 0];
  LOD_LEVELS.forEach((level, i) => levels[level].addEventListener('dispose', () => released[i]++));
  let skeletonDisposals = 0, materialDisposals = 0;
  const original = otter.rig.skeleton.dispose.bind(otter.rig.skeleton);
  otter.rig.skeleton.dispose = () => { skeletonDisposals++; original(); };
  assert(!Array.isArray(otter.mesh.material)); otter.mesh.material.addEventListener('dispose', () => materialDisposals++);
  lod.setMode('far'); lod.update(camera, 900, 0, true);
  assert.equal(otter.mesh.geometry, levels.far);
  assert.equal(lod.stats(otter.root).far.draws, 1);
  const pose = transforms(otter), time = otter.time;
  disposeObject(otter.root); otter.dispose();
  assert.deepEqual(released, [1, 1, 1]); assert.equal(skeletonDisposals, 1); assert.equal(materialDisposals, 1);
  assert.equal(lod.size, 0); assert.equal(getSeaOtter(otter.root), undefined);
  updateSeaOtter(otter.root, 1); setSeaOtterPose(otter.root, 'dive'); otter.update(1); otter.poseAt(8, { pose: 'swim' });
  assert.equal(otter.time, time); assert.deepEqual(transforms(otter), pose);
  lod.dispose(); assert.equal(skeletonDisposals, 1);
});
