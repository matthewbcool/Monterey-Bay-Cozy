import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BufferGeometry, InstancedBufferAttribute, InstancedMesh, Material, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { createLodController } from '../src/models/shared/lod/controller';
import { LOD_LEVELS, prepareGeometryLods, triangles } from '../src/models/shared/lod/geometry';
import { canStandAt } from '../src/viewer/avatarController';
import { createTestingGym } from '../src/viewer/testingGym';

function meshes(root: ReturnType<typeof createTestingGym>['root']) {
  const result: Mesh[] = [];
  root.traverse(object => { if (object instanceof Mesh) result.push(object); });
  return result;
}

function checkGeometry(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position');
  assert(position && position.count > 0, 'Every mesh needs positions');
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    if(!(attribute instanceof InstancedBufferAttribute))assert.equal(attribute.count, position.count, name + ' has a different vertex count');
    assert(Array.from(attribute.array).every(Number.isFinite), name + ' contains a non-finite value');
  }
  if (geometry.index) {
    assert.equal(geometry.index.count % 3, 0);
    assert(Array.from(geometry.index.array).every(index => index >= 0 && index < position.count), 'Index escapes its vertex buffer');
  } else assert.equal(position.count % 3, 0);
  geometry.computeBoundingBox();
  assert([...geometry.boundingBox!.min.toArray(), ...geometry.boundingBox!.max.toArray()].every(Number.isFinite));
}

function collisionSnapshot(gym: ReturnType<typeof createTestingGym>) {
  return {
    spawn: gym.spawn.toArray(), bounds: JSON.stringify(gym.bounds), colliders: JSON.stringify(gym.colliders),
    interactions: gym.interactions.map(item => ({
      id: item.id, action: item.action, radius: item.radius, position: item.position.toArray(),
      seat: item.seatPosition?.toArray(), yaw: item.yaw, object: item.object?.uuid,
    })),
  };
}

test('Testing Gym keeps finite metre-scale geometry within the world budget', () => {
  const gym = createTestingGym();
  try {
    const parts = meshes(gym.root);
    assert.deepEqual(gym.root.scale.toArray(), [1, 1, 1]);
    // October 24: five inventoried tree species add two draws; triangle ceiling stays unchanged.
    assert(parts.length <= 38, `${parts.length} draws exceeds the 38-draw park budget`);
    assert(parts.filter(part => part.userData.spatialCell || part.parent?.userData.spatialCell).length > 1, 'Scenery needs spatial batches so distant features can reduce independently');
    const count = parts.reduce((sum, part) => sum + triangles(part.geometry) * (part instanceof InstancedMesh ? part.count : 1), 0);
    const wildlife=triangles(gym.butterflies.batch.mesh.geometry)*gym.butterflies.batch.count;
    assert.equal(wildlife,5472);
    assert(count-wildlife <= 64000, `${count-wildlife} static park triangles exceeds the 64,000-triangle budget`);
    assert(count <= 69472, `${count} triangles exceeds park plus six monarchs`);
    assert(triangles(gym.water.root.geometry) <= 800, 'Coast-clipped bay stays within the existing water budget');
    assert.equal(gym.water.root.geometry.userData.coastClipped,true);
    assert.equal(gym.water.material.forceSinglePass, true, 'Bay needs only one color submission');
    assert.equal(gym.water.refraction, false, 'Open bay omits the harbor seabed capture');
    gym.update(3.25); assert.equal(gym.water.uniforms.time.value, 3.25);
    for (const part of parts) {
      checkGeometry(part.geometry);
      for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
        assert.equal(material.type, (part === gym.water.root || part.name === 'Shore foam · advancing and retreating') ? 'MeshBasicNodeMaterial' : part === gym.butterflies.batch.mesh ? 'MeshToonNodeMaterial' : 'MeshToonMaterial', 'World assets use shared toon materials; water and foam use their shared-clock node shaders');
        assert.equal((material as Material & { map?: unknown }).map ?? null, null, 'The gym must not download photo textures');
      }
    }
    assert.equal(gym.geography.source, '© OpenStreetMap contributors · ODbL');
    assert(gym.bounds.walkable!.length > 100, 'Keep the mapped coastline rather than substituting a box');
  } finally { gym.dispose(); }
});

test('Testing Gym LOD changes only render geometry, retaining interaction and collision ownership', async () => {
  const gym = createTestingGym(), lod = createLodController();
  const camera = new PerspectiveCamera(49, 1.5, .05, 600);
  camera.position.copy(gym.spawn).add(new Vector3(-4.5, 4.1, -6));
  camera.lookAt(gym.spawn.clone().add(new Vector3(0, .9, 0))); camera.updateMatrixWorld(true);
  const parts = meshes(gym.root), originals = new Map(parts.map(part => [part, { geometry: part.geometry, raycast: part.raycast }]));
  const physics = collisionSnapshot(gym);
  const instances = parts.filter((part): part is InstancedMesh => part instanceof InstancedMesh).map(part => ({
    part, count: part.count, matrix: part.instanceMatrix, version: part.instanceMatrix.version, values: Array.from(part.instanceMatrix.array),
  }));
  gym.root.updateMatrixWorld(true);
  const placements = parts.map(part => part.matrixWorld.toArray());
  try {
    await lod.register(gym.root);
    const stats = lod.stats(gym.root);
    assert.equal(stats.meshes, parts.length, 'Every world mesh must be registered');
    assert(stats.far.triangles < stats.mid.triangles && stats.mid.triangles < stats.near.triangles);
    assert.equal(stats.near.draws, stats.far.draws, 'LOD must not add rendering passes');
    assert(stats.bytes > 0);
    for (const level of LOD_LEVELS) {
      lod.setMode(level); lod.update(camera, 900, 0, true);
      gym.root.updateMatrixWorld(true);
      assert.deepEqual(collisionSnapshot(gym), physics, level + ' changed gameplay data');
      assert.deepEqual(parts.map(part => part.matrixWorld.toArray()), placements, level + ' changed world placement');
      for (const instance of instances) {
        assert.equal(instance.part.count, instance.count, level + ' changed a scenery population');
        assert.equal(instance.part.instanceMatrix, instance.matrix, level + ' replaced instance ownership');
        assert.equal(instance.part.instanceMatrix.version, instance.version, level + ' uploaded unchanged instance transforms');
        assert.deepEqual(Array.from(instance.part.instanceMatrix.array), instance.values, level + ' changed instance placement');
      }
      for (const part of parts) {
        checkGeometry(part.geometry);
        assert(triangles(part.geometry) <= triangles(originals.get(part)!.geometry));
        assert.deepEqual(Object.keys(part.geometry.attributes), Object.keys(originals.get(part)!.geometry.attributes));
      }
      assert(canStandAt(gym.spawn.x, gym.spawn.z, gym.bounds, gym.colliders));
      for (const item of gym.interactions) assert(canStandAt(item.position.x, item.position.z, gym.bounds, gym.colliders), level + ': ' + item.id);
    }
    lod.dispose();
    for (const [part, original] of originals) {
      assert.equal(part.geometry, original.geometry, 'Shutdown restores canonical geometry');
      assert.equal(part.raycast, original.raycast, 'Shutdown restores canonical raycasts');
    }
  } finally { lod.dispose(); gym.dispose(); }
});

test('Every Testing Gym station has a connected walking route from spawn', () => {
  const gym = createTestingGym();
  try {
    // A one-metre navigation grid is an independent connectivity check, not a new
    // runtime navigation system. Mid-edge samples also prevent skipping thin walls.
    const { minX, maxX, minZ, maxZ } = gym.bounds;
    const width = Math.ceil(maxX - minX) + 1, height = Math.ceil(maxZ - minZ) + 1;
    const idAt = (x: number, z: number) => Math.round(z - minZ) * width + Math.round(x - minX);
    const pointAt = (id: number) => [minX + id % width, minZ + Math.floor(id / width)] as const;
    const start = idAt(gym.spawn.x, gym.spawn.z), queue = [start], reached = new Set([start]);
    const legal = new Map<number, boolean>();
    assert(canStandAt(...pointAt(start), gym.bounds, gym.colliders));
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head], x = current % width, z = Math.floor(current / width), a = pointAt(current);
      for (const [nextX, nextZ] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
        if (nextX < 0 || nextX >= width || nextZ < 0 || nextZ >= height) continue;
        const next = nextZ * width + nextX;
        if (reached.has(next)) continue;
        const b = pointAt(next);
        if (!legal.has(next)) legal.set(next, canStandAt(...b, gym.bounds, gym.colliders));
        if (!legal.get(next) || !canStandAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, gym.bounds, gym.colliders)) continue;
        reached.add(next); queue.push(next);
      }
    }
    for (const item of gym.interactions) {
      assert(canStandAt(item.position.x, item.position.z, gym.bounds, gym.colliders), item.id + ' approach is blocked');
      assert(reached.has(idAt(item.position.x, item.position.z)), item.id + ' is disconnected from spawn');
    }
    const before = gym.colliders.length;
    gym.setRodEquipped(true); assert.equal(gym.colliders.length, before - 1);
    gym.setRodEquipped(true); assert.equal(gym.colliders.length, before - 1, 'Equipping twice does not remove another collider');
    gym.setRodEquipped(false); gym.setRodEquipped(false); assert.equal(gym.colliders.length, before);
  } finally { gym.dispose(); }
});

test('Testing Gym releases all inactive LOD buffers and materials exactly once', async () => {
  const gym = createTestingGym(), lod = createLodController();
  const geometryDisposals = new Map<BufferGeometry, number>(), materialDisposals = new Map<Material, number>();
  const instanceDisposals = new Map<InstancedMesh, number>();
  for (const part of meshes(gym.root)) {
    if (part instanceof InstancedMesh) {
      instanceDisposals.set(part, 0);
      part.addEventListener('dispose', () => instanceDisposals.set(part, instanceDisposals.get(part)! + 1));
    }
    const variants = await prepareGeometryLods(part.geometry);
    for (const geometry of new Set(Object.values(variants))) {
      if (geometryDisposals.has(geometry)) continue;
      geometryDisposals.set(geometry, 0);
      geometry.addEventListener('dispose', () => geometryDisposals.set(geometry, geometryDisposals.get(geometry)! + 1));
    }
    for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
      if (materialDisposals.has(material)) continue;
      materialDisposals.set(material, 0);
      material.addEventListener('dispose', () => materialDisposals.set(material, materialDisposals.get(material)! + 1));
    }
  }
  await lod.register(gym.root);
  const camera = new PerspectiveCamera(49, 1, .05, 600); camera.position.set(20, 10, 30); camera.updateMatrixWorld(true);
  lod.setMode('far'); lod.update(camera, 800, 0, true);
  gym.dispose(); gym.dispose(); lod.dispose();
  assert.equal(lod.size, 0);
  assert([...geometryDisposals.values()].every(count => count === 1), 'Some original or reduced geometry leaked or disposed twice');
  assert([...materialDisposals.values()].every(count => count === 1), 'Some scene material leaked or disposed twice');
  assert([...instanceDisposals.values()].every(count => count === 1), 'Some instance batch leaked or disposed twice');
});
