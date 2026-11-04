import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BufferAttribute, BufferGeometry, Group, Mesh, MeshToonMaterial, PerspectiveCamera, SkinnedMesh, Vector3 } from 'three';
import { createMonarchButterfly, getMonarchState, setMonarchPose, updateMonarchButterfly } from '../src/models/habitat/monarch-butterfly/createMonarchButterfly';
import { propCollection } from '../src/models/props/catalogue';
import { PROP_BUDGETS, SIZE_REFERENCES } from '../src/models/props/dimensions';
import { disposeObject } from '../src/models/props/primitives';
import { createLodController } from '../src/models/shared/lod/controller';
import { LOD_LEVELS, triangles } from '../src/models/shared/lod/geometry';

function surface(root: Group) {
  const meshes: Mesh[] = [];
  root.traverse(node => { if (node instanceof Mesh) meshes.push(node); });
  assert.equal(meshes.length, 1, 'The living butterfly fits in one opaque render batch');
  assert(meshes[0] instanceof SkinnedMesh, 'Wings animate with a shared skeleton');
  return meshes[0] as SkinnedMesh;
}

function state(root: Group) {
  const value = getMonarchState(root); assert(value, 'A live butterfly exposes its motion state'); return value;
}

function vertexBounds(mesh: SkinnedMesh) {
  mesh.updateWorldMatrix(true, true); mesh.skeleton.update();
  const bounds = new Box3(), point = new Vector3();
  for (let i = 0; i < mesh.geometry.attributes.position.count; i++) bounds.expandByPoint(mesh.getVertexPosition(i, point));
  return bounds;
}

function finiteSkin(geometry: BufferGeometry) {
  const positions = geometry.attributes.position;
  for (const attribute of Object.values(geometry.attributes)) {
    assert.equal(attribute.count, positions.count);
    assert(Array.from(attribute.array).every(Number.isFinite));
  }
  assert(geometry.index && Array.from(geometry.index.array).every(index => index >= 0 && index < positions.count));
  const indices = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
  const influences = new Set<number>();
  for (let i = 0; i < positions.count; i++) {
    let total = 0;
    for (let j = 0; j < 4; j++) {
      const index = indices.getComponent(i, j), weight = weights.getComponent(i, j);
      assert(Number.isInteger(index) && index >= 0 && index < 5);
      assert(weight >= 0 && weight <= 1); total += weight;
      if (weight > 0) influences.add(index);
    }
    assert(Math.abs(total - 1) < 1e-6, 'Every vertex keeps normalized skeletal weights');
  }
  assert.deepEqual([...influences].sort(), [0, 1, 2, 3, 4], 'The body and all four wing membranes survive');
}

// Average pigment by visible surface area, not vertex count. Tiny spots and
// dense vein boundaries must not conceal a LOD that has lost the orange fill.
function wingPigment(geometry: BufferGeometry) {
  const positions = geometry.attributes.position, colors = geometry.attributes.color;
  const normals = geometry.attributes.normal, skin = geometry.attributes.skinIndex, indices = geometry.index!;
  const totals = { dorsal: { area: 0, warmth: 0 }, ventral: { area: 0, warmth: 0 } };
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (let i = 0; i < indices.count; i += 3) {
    const vertices = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
    if (!vertices.every(index => skin.getX(index) > 0)) continue;
    const normalY = vertices.reduce((sum, index) => sum + normals.getY(index), 0) / 3;
    if (Math.abs(normalY) < .8) continue;
    a.fromBufferAttribute(positions, vertices[0]); b.fromBufferAttribute(positions, vertices[1]).sub(a); c.fromBufferAttribute(positions, vertices[2]).sub(a);
    const area = b.cross(c).length() / 2;
    const warmth = vertices.reduce((sum, index) => sum + Math.max(0, colors.getX(index) - colors.getY(index)), 0) / 3;
    const side = normalY > 0 ? totals.dorsal : totals.ventral;
    side.area += area; side.warmth += area * warmth;
  }
  return Object.fromEntries(Object.entries(totals).map(([side, { area, warmth }]) => {
    assert(area > 0, `${side} retains its wing membrane`); return [side, warmth / area];
  })) as Record<'dorsal' | 'ventral', number>;
}

test('Living monarch is a distinct animated Habitat entry with sourced metre dimensions', () => {
  const entry = propCollection.find(item => item.id === 'monarch-butterfly');
  assert(entry && entry.category === 'Habitat' && entry.random && entry.animate);
  assert(propCollection.some(item => item.id === 'butterfly-statue'), 'Keep the separate granite monument');
  assert(SIZE_REFERENCES['monarch-butterfly'].url?.startsWith('https://'));
  assert(PROP_BUDGETS['monarch-butterfly'].triangles <= 1000);
  assert.equal(PROP_BUDGETS['monarch-butterfly'].drawCalls, 1);
  const root = entry.create();
  try {
    assert.equal(root.userData.assetId, 'monarch-butterfly');
    assert.equal(root.userData.units, 'metres');
    assert.deepEqual(root.scale.toArray(), [1, 1, 1]);
    assert(Array.isArray(root.userData.sourceParts) && root.userData.sourceParts.length >= 6);
    assert(root.userData.physics, 'Future placement and physics have a stable body descriptor');
    const geometry = surface(root).geometry, positions = geometry.attributes.position;
    const xs = Array.from({ length: positions.count }, (_, i) => positions.getX(i));
    assert(Math.abs(Math.max(...xs) - Math.min(...xs) - .10) < 1e-6, 'The default open wingspan is 10 cm');
  } finally { disposeObject(root); }
});

test('Monarch seeds reproduce geometry and pigment while keeping one matte batch below its ceiling', () => {
  for (let seed = 0; seed < 32; seed++) {
    const root = createMonarchButterfly({ seed });
    try {
      const mesh = surface(root), material = mesh.material;
      assert.equal(root.userData.seed, seed); assert.equal(mesh.skeleton.bones.length, 5);
      assert(material instanceof MeshToonMaterial);
      assert.equal(material.userData.toon, 'matte'); assert.equal(material.transparent, false);
      assert.equal(material.map, null); assert.equal(material.normalMap, null); assert.equal(material.bumpMap, null);
      assert(triangles(mesh.geometry) <= 1000, `Seed ${seed}: ${triangles(mesh.geometry)} triangles`);
      finiteSkin(mesh.geometry);
    } finally { disposeObject(root); }
  }
  const a = createMonarchButterfly({ seed: 42 }), b = createMonarchButterfly({ seed: 42 }), c = createMonarchButterfly({ seed: 7 });
  try {
    for (const key of ['position', 'color', 'skinIndex', 'skinWeight']) {
      assert.deepEqual(surface(a).geometry.attributes[key].array, surface(b).geometry.attributes[key].array);
    }
    assert.notDeepEqual(surface(a).geometry.attributes.color.array, surface(c).geometry.attributes.color.array, 'Natural pigment varies reproducibly');
  } finally { [a, b, c].forEach(disposeObject); }
  for (const seed of [-1, .5, NaN, Infinity, 2 ** 32]) assert.throws(() => createMonarchButterfly({ seed }));
  for (const wingspanMeters of [-1, 0, NaN, Infinity]) assert.throws(() => createMonarchButterfly({ wingspanMeters }));
});

test('Wings attach at the thorax and carry different dorsal and ventral pigment without texture layers', () => {
  const root = createMonarchButterfly({ seed: 7, pose: 'basking' });
  try {
    const mesh = surface(root), geometry = mesh.geometry;
    const positions = geometry.attributes.position, normals = geometry.attributes.normal;
    const colors = geometry.attributes.color, indices = geometry.attributes.skinIndex;
    const dorsal = new Vector3(), ventral = new Vector3(); let above = 0, below = 0;
    for (let wing = 1; wing <= 4; wing++) {
      const pivot = mesh.skeleton.bones[wing].position, point = new Vector3();
      let distance = Infinity;
      assert(pivot.length() < .02, 'Wing hinges stay in the body region, not at the tips');
      for (let i = 0; i < positions.count; i++) if (indices.getX(i) === wing) {
        distance = Math.min(distance, point.fromBufferAttribute(positions, i).distanceTo(pivot));
        if (normals.getY(i) > .9) { dorsal.add(new Vector3().fromBufferAttribute(colors, i)); above++; }
        if (normals.getY(i) < -.9) { ventral.add(new Vector3().fromBufferAttribute(colors, i)); below++; }
      }
      assert(distance < .004, `Wing ${wing} membrane meets its thorax hinge`);
    }
    assert(above > 0 && below > 0, 'Both sides are actual visible faces');
    dorsal.divideScalar(above); ventral.divideScalar(below);
    assert(dorsal.distanceTo(ventral) > .015, 'The underside keeps its own tawny pigment');
    const width = vertexBounds(mesh).getSize(new Vector3()).x;
    setMonarchPose(root, 'perched');
    assert(vertexBounds(mesh).getSize(new Vector3()).x < width * .4, 'Perching folds the wings above the body');
  } finally { disposeObject(root); }
});

test('Wing playback uses seconds and changes no root transforms or uploaded vertex buffers', () => {
  const a = createMonarchButterfly({ seed: 42, pose: 'flight' }), b = createMonarchButterfly({ seed: 42, pose: 'flight' });
  try {
    a.position.set(2, 3, 4); a.rotation.set(.1, .2, .3); a.updateMatrix();
    const transform = a.matrix.clone(), physics = JSON.stringify(a.userData.physics);
    const mesh = surface(a), snapshots = Object.entries(mesh.geometry.attributes).map(([key, value]) => ({
      key, reference: value.array, values: value.array.slice(), version: (value as BufferAttribute).version,
    }));
    const initial = state(a).wingAngles.slice(); let excursion = 0;
    for (let i = 0; i < 60; i++) {
      updateMonarchButterfly(a, 1 / 60);
      excursion = Math.max(excursion, ...state(a).wingAngles.map((angle, index) => Math.abs(angle - initial[index])));
    }
    for (let i = 0; i < 30; i++) updateMonarchButterfly(b, 1 / 30);
    const first = state(a), second = state(b);
    assert(Math.abs(first.time - second.time) < 1e-10);
    first.wingAngles.forEach((angle, index) => assert(Math.abs(angle - second.wingAngles[index]) < 1e-9));
    assert(excursion > .5, 'Flight advances a visible wingbeat');
    const stopped = JSON.stringify(first);
    for (const dt of [0, -1, NaN, Infinity]) updateMonarchButterfly(a, dt);
    assert.equal(JSON.stringify(state(a)), stopped, 'Pause and invalid deltas leave animation unchanged');
    for (const pose of ['perched', 'basking', 'flight'] as const) {
      setMonarchPose(a, pose); const before = JSON.stringify(state(a)); updateMonarchButterfly(a, .02);
      if (pose !== 'flight') assert.equal(JSON.stringify(state(a)), before, 'Resting poses remain still');
    }
    a.updateMatrix(); assert.deepEqual(a.matrix.toArray(), transform.toArray());
    assert.equal(JSON.stringify(a.userData.physics), physics);
    for (const { key, reference, values, version } of snapshots) {
      const attribute = mesh.geometry.attributes[key] as BufferAttribute;
      assert.equal(attribute.array, reference); assert.equal(attribute.version, version); assert.deepEqual(attribute.array, values);
    }
  } finally { [a, b].forEach(disposeObject); }
});

test('Sizing scales geometry and animation hinges together without scaling the public root', () => {
  const a = createMonarchButterfly({ seed: 9, wingspanMeters: .10 }), b = createMonarchButterfly({ seed: 9, wingspanMeters: .12 });
  try {
    const ma = surface(a), mb = surface(b), pa = ma.geometry.attributes.position, pb = mb.geometry.attributes.position;
    assert.equal(pa.count, pb.count); const p = new Vector3(), q = new Vector3();
    for (let i = 0; i < pa.count; i++) {
      assert(p.fromBufferAttribute(pa, i).multiplyScalar(1.2).distanceTo(q.fromBufferAttribute(pb, i)) < 1e-7);
    }
    ma.skeleton.bones.forEach((bone, i) => assert(bone.position.clone().multiplyScalar(1.2).distanceTo(mb.skeleton.bones[i].position) < 1e-9));
    const physicsA = a.userData.physics, physicsB = b.userData.physics;
    assert(Math.abs(physicsB.colliders[0].radius - physicsA.colliders[0].radius * 1.2) < 1e-10);
    assert(Math.abs(physicsB.colliders[0].halfLength - physicsA.colliders[0].halfLength * 1.2) < 1e-10);
    for (const key of Object.keys(physicsA.anchors)) {
      const anchorA = new Vector3(...physicsA.anchors[key] as [number, number, number]);
      const anchorB = new Vector3(...physicsB.anchors[key] as [number, number, number]);
      assert(anchorA.multiplyScalar(1.2).distanceTo(anchorB) < 1e-10);
    }
    assert.deepEqual(a.scale.toArray(), [1, 1, 1]); assert.deepEqual(b.scale.toArray(), [1, 1, 1]);
  } finally { [a, b].forEach(disposeObject); }
});

test('Every monarch LOD retains safe skinning, useful reductions and a conservative animated envelope', async () => {
  const camera = new PerspectiveCamera(45, 1, .001, 100), point = new Vector3();
  for (const seed of [0, 7, 42]) {
    const root = createMonarchButterfly({ seed }), mesh = surface(root), lod = createLodController();
    const attributes = Object.keys(mesh.geometry.attributes), physics = JSON.stringify(root.userData.physics);
    try {
      await lod.register(root); const stats = lod.stats(root);
      assert(stats.mid.triangles < stats.near.triangles);
      assert(stats.far.triangles < stats.near.triangles * .7, JSON.stringify(stats));
      for (const level of LOD_LEVELS) {
        lod.setMode(level); lod.update(camera, 900, 0, true);
        assert.equal(stats[level].draws, 1); finiteSkin(mesh.geometry);
        assert.deepEqual(Object.keys(mesh.geometry.attributes), attributes);
        for (const pose of ['basking', 'perched', 'flight'] as const) {
          setMonarchPose(root, pose);
          for (let frame = 0; frame < (pose === 'flight' ? 36 : 1); frame++) {
            updateMonarchButterfly(root, .173); root.updateMatrixWorld(true); mesh.skeleton.update();
            assert(mesh.boundingBox && mesh.boundingSphere, 'The skinned asset declares its motion envelope');
            const envelope = mesh.boundingBox.clone().expandByScalar(1e-7);
            for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
              mesh.getVertexPosition(i, point);
              assert(point.toArray().every(Number.isFinite));
              assert(envelope.containsPoint(point), `${level}/${pose} box contains ${point.toArray()}`);
              assert(mesh.boundingSphere.distanceToPoint(point) <= 1e-7, `${level}/${pose} sphere contains ${point.toArray()}`);
            }
          }
        }
        assert.equal(JSON.stringify(root.userData.physics), physics); assert.deepEqual(root.scale.toArray(), [1, 1, 1]);
      }
    } finally { disposeObject(root); assert.equal(lod.size, 0); lod.dispose(); }
  }
});

test('Reduced monarch wings retain orange and brown pigment coverage instead of collapsing into black panels', async () => {
  const camera = new PerspectiveCamera(45, 1, .001, 100);
  for (const seed of [0, 7, 42]) {
    const root = createMonarchButterfly({ seed }), mesh = surface(root), lod = createLodController();
    try {
      const near = wingPigment(mesh.geometry); await lod.register(root);
      assert(near.dorsal > near.ventral, 'The open upper wing is brighter orange than the brown underside');
      for (const level of ['mid', 'far'] as const) {
        lod.setMode(level); lod.update(camera, 900, 0, true);
        const reduced = wingPigment(mesh.geometry);
        for (const side of ['dorsal', 'ventral'] as const) {
          assert(reduced[side] >= near[side] * .65, `${level} ${side} retains at least 65% of its area-weighted warm pigment (${reduced[side]} versus ${near[side]})`);
        }
      }
    } finally { disposeObject(root); lod.dispose(); }
  }
});

test('Disposing an active Far butterfly releases every geometry level and its skeleton exactly once', async () => {
  const root = createMonarchButterfly({ seed: 42 }), mesh = surface(root), lod = createLodController();
  const camera = new PerspectiveCamera(45, 1, .001, 100), counts = new Map<BufferGeometry, number>();
  await lod.register(root);
  for (const level of LOD_LEVELS) {
    lod.setMode(level); lod.update(camera, 900, 0, true);
    const geometry = mesh.geometry;
    if (!counts.has(geometry)) { counts.set(geometry, 0); geometry.addEventListener('dispose', () => counts.set(geometry, counts.get(geometry)! + 1)); }
  }
  let skeletonReleases = 0;
  const disposeSkeleton = mesh.skeleton.dispose.bind(mesh.skeleton);
  mesh.skeleton.dispose = () => { skeletonReleases++; disposeSkeleton(); };
  disposeObject(root);
  assert.equal(skeletonReleases, 1); assert.equal(lod.size, 0);
  assert.equal(getMonarchState(root), undefined, 'Released assets retain no animation state');
  assert(counts.size > 1); assert([...counts.values()].every(value => value === 1));
  lod.dispose(); assert.equal(skeletonReleases, 1);
});
