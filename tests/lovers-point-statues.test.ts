import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Group, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { LOVERS_POINT_ARTWORKS } from '../src/data/lovers-point-artworks';
import { propCollection } from '../src/models/props/catalogue';
import { disposeObject } from '../src/models/props/primitives';
import { createLodController } from '../src/models/shared/lod/controller';
import { LOD_LEVELS, triangles } from '../src/models/shared/lod/geometry';
import { addParkStatues, artworkLocalPosition } from '../src/viewer/testingGym/statues';
import { groundHeight } from '../src/viewer/testingGym/elevation';
import { canStandAt, type GymCollider } from '../src/viewer/avatarController';
import { createTestingGym } from '../src/viewer/testingGym';

test('Artwork GPS records project to distinct park lawn positions with provenance and uncertain accuracy', () => {
  const expected = [[44.620, -61.157], [32.721, -74.130]];
  LOVERS_POINT_ARTWORKS.forEach((record, i) => {
    const local = artworkLocalPosition(record.coordinates);
    assert(Math.abs(local.x - expected[i][0]) < .001 && Math.abs(local.z - expected[i][1]) < .001);
    assert(record.coordinateSource.startsWith('https://www.waymarking.com/'));
    assert.match(record.accuracy, /Unknown/); assert.match(record.headingBasis, /unmeasured/);
    assert(propCollection.some(entry => entry.id === record.id && entry.category === 'Landmarks'));
  });
});

test('Statues retain single matte batches, silhouette bounds and fixed collision across all LODs', async () => {
  const root = new Group(), colliders: GymCollider[] = [], placements = addParkStatues(root, colliders);
  const lod = createLodController(), camera = new PerspectiveCamera(45, 1.4, .01, 1000);
  try {
    await lod.register(root);
    for (const { record, object, position, collider } of placements) {
      lod.setMode('near'); lod.update(camera, 900, 0, true);
      const box = new Box3().setFromObject(object), size = box.getSize(new Vector3());
      assert(size.y > 1.6 && size.y < 2.3, record.id + ' remains a human-scale monument');
      assert(Math.abs(box.min.y - (groundHeight(position.x, position.z) - .025)) < .001);
      assert.deepEqual(object.scale.toArray(), [1,1,1]);
      assert(object.userData.sourceParts.length >= 6, 'Semantic source parts remain inspectable');
      const parts: Mesh[] = []; object.traverse(node => { if (node instanceof Mesh) parts.push(node); });
      assert.equal(parts.length, 1); const mesh = parts[0], original = mesh.geometry;
      assert(!Array.isArray(mesh.material)); assert.equal(mesh.material.userData.toon, 'matte');
      assert.equal(mesh.material.transparent, false, 'Sculptures need no transparency passes');
      const stats = lod.stats(object); assert.equal(stats.near.draws, 1); assert.equal(stats.far.draws, 1);
      assert(stats.mid.triangles < stats.near.triangles && stats.far.triangles < stats.mid.triangles, 'Sculpture LOD must actually reduce geometry');
      const transform = object.matrix.toArray(), collision = JSON.stringify(collider);
      for (const level of LOD_LEVELS) {
        lod.setMode(level); lod.update(camera, 900, 0, true); object.updateMatrix();
        assert.deepEqual(object.matrix.toArray(), transform); assert.equal(JSON.stringify(collider), collision);
        const geometry = mesh.geometry, positionAttribute = geometry.attributes.position;
        assert.equal(triangles(geometry), stats[level].triangles);
        for (const attribute of Object.values(geometry.attributes)) assert(Array.from(attribute.array).every(Number.isFinite));
        if (geometry.index) assert(Array.from(geometry.index.array).every(index => index < positionAttribute.count));
        const bounds = new Box3().setFromObject(object);
        assert(Math.abs(bounds.min.y - box.min.y) < .02 && Math.abs(bounds.max.y - box.max.y) < .06, 'LOD retains pedestal contact and wing/crown silhouette');
      }
      // Distance selection must save work without changing either root or collider.
      lod.setMode('auto'); camera.position.copy(position).add(new Vector3(0,1,200)); camera.lookAt(position); camera.updateMatrixWorld(true);
      lod.update(camera, 900, 1, true); assert.equal(lod.inspect(object)[0].level, 'far');
      assert.deepEqual(object.position.toArray(), position.toArray()); assert.equal(JSON.stringify(collider), collision);
      assert(original !== mesh.geometry);
    }
  } finally { lod.dispose(); disposeObject(root); }
});

test('Gym statues have terrain-grounded collision and reachable inspect interactions', () => {
  const gym = createTestingGym();
  try {
    assert.equal(gym.statues.length, 2);
    for (const { record, object, position } of gym.statues) {
      const interaction = gym.interactions.find(item => item.id === record.id)!;
      assert(interaction && interaction.object === object && interaction.action === 'inspect');
      assert(!canStandAt(position.x, position.z, gym.bounds, gym.colliders), 'Cannot walk through a monument');
      let approaches = 0;
      for (let i = 0; i < 16; i++) {
        const x = position.x + Math.sin(i * Math.PI / 8) * 2, z = position.z + Math.cos(i * Math.PI / 8) * 2;
        if (canStandAt(x, z, gym.bounds, gym.colliders)) approaches++;
      }
      assert(approaches >= 8, 'The artwork must be approachable from the lawn');
    }
  } finally { gym.dispose(); }
});
