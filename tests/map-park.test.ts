import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BufferGeometry, InstancedMesh, Material, Matrix4, Mesh, PerspectiveCamera, Vector3 } from 'three';
import map from '../src/data/lovers-point-gym.json';
import features from '../src/data/lovers-point-features.json';
import regionalMap from '../src/data/monterey-map.json';
import { createLodController } from '../src/models/shared/lod/controller';
import { LOD_LEVELS, prepareGeometryLods, triangles } from '../src/models/shared/lod/geometry';
import { createLoversPointArea, loversPointFootprint, projectLoversPointPoint, replacedBuildingIds, resolveParkBuildingElevation } from '../src/viewer/mapStudy/loversPoint';
import { groundHeight } from '../src/viewer/testingGym/elevation';
import { withinPolygon } from '../src/viewer/mapStudy/clip';

const origin = [-121.902, 36.618] as const;
function parts(root: ReturnType<typeof createLoversPointArea>['root']) {
  const meshes: Mesh[] = [];
  root.traverse(object => { if (object instanceof Mesh) meshes.push(object); });
  return meshes;
}

test('Detailed Lovers Point uses the regional metre projection and an explicit replacement crop', () => {
  const radians = Math.PI / 180, radius = 6371008.8;
  const sourceOrigin = map.origin as [number, number];
  for (const [x, z] of [[0, 0], [-145, -160], [150, 130], [54.133, -95.372]]) {
    // Independent unproject/project path catches translations, latitude scaling
    // and north/south signs without relying on the component's matrix formula.
    const lon = sourceOrigin[0] + x / (radians * radius * Math.cos(sourceOrigin[1] * radians));
    const lat = sourceOrigin[1] - z / (radians * radius);
    const expected = [(lon - origin[0]) * radians * radius * Math.cos(origin[1] * radians), -(lat - origin[1]) * radians * radius];
    const result = projectLoversPointPoint([x, z], origin);
    result.forEach((value, axis) => assert(Math.abs(value - expected[axis]) < 1e-6));
    assert.deepEqual(projectLoversPointPoint([x, z], sourceOrigin), [x, z]);
  }
  const crop = loversPointFootprint(origin);
  assert.equal(crop.length, 4);
  assert(crop.reduce((area, p, i) => { const next = crop[(i + 1) % crop.length]; return area + p[0] * next[1] - next[0] * p[1]; }, 0) > 0);
  assert.equal(replacedBuildingIds.size, 25);
  assert.deepEqual([...replacedBuildingIds], map.buildings.map(building => building.id));
  assert.deepEqual(crop[0], projectLoversPointPoint([features.crop[0], features.crop[1]], origin));
});

test('Regional buildings overlapping the park use terrain foundations without altering their source height', () => {
  const untouched = JSON.stringify(regionalMap.buildings);
  const raised = regionalMap.buildings.filter(building => !replacedBuildingIds.has(building.id))
    .map(building => ({ id: building.id, height: resolveParkBuildingElevation(building.rings as [number, number][][]) }))
    .filter(building => building.height !== null);
  assert.equal(raised.length, 15, 'All unreplaced map buildings touching the terrain need a foundation');
  assert(raised.every(building => building.height! > 10 && building.height! < 18));
  assert(Math.abs(raised.find(building => building.id === 'way/622669601')!.height! - 16.786) < .001, 'Apartment edge crossing must include its highest covered DEM point');
  assert.equal(JSON.stringify(regionalMap.buildings), untouched, 'Elevation is a placement offset, never a new source building height');
});

test('Terrain foundations resolve crossing footprints and reject ocean-only footprints and courtyard holes', () => {
  const radians = Math.PI / 180, radius = 6371008.8;
  const geographic = ([x, z]: readonly [number, number]): [number, number] => [
    map.origin[0] + x / (radians * radius * Math.cos(map.origin[1] * radians)), map.origin[1] - z / (radians * radius),
  ];
  const rectangle = (west: number, north: number, east: number, south: number) => [[west, north], [east, north], [east, south], [west, south]].map(p => geographic(p as [number, number]));
  assert.equal(resolveParkBuildingElevation([rectangle(136, 96, 144, 104)]), null, 'Ocean inside the display crop is not land');
  assert.equal(resolveParkBuildingElevation([rectangle(400, 400, 420, 420)]), null);
  assert.equal(resolveParkBuildingElevation([rectangle(-200, -200, 200, 200), rectangle(-190, -190, 190, 190)]), null, 'A courtyard enclosing all land does not touch terrain');
  const land = [...map.coast, [-145, -135], [-145, 130], [72, 130]] as [number, number][];
  const crossing = [[-200, -40], [200, -40], [200, -39], [-200, -39]] as [number, number][];
  assert(crossing.every(point => !withinPolygon(point, land)), 'The crossing fixture has no corners inside land');
  const offset = resolveParkBuildingElevation([crossing.map(geographic)]);
  assert(offset !== null && offset >= groundHeight(-140, -39.5), 'Boundary crossings must work even with all vertices outside the terrain');
  const edge = resolveParkBuildingElevation([rectangle(-147, -30, -143, -20)]);
  assert(edge !== null && edge >= groundHeight(-144, -25), 'A narrow land sliver needs its actual terrain height');
});

test('Detailed park reuses matte scenery within budget and excludes gym equipment and ocean', () => {
  const area = createLoversPointArea(origin), local = createLoversPointArea(map.origin as [number, number]);
  try {
    assert.deepEqual(area.root.scale.toArray(), [1, 1, 1]);
    assert.equal(area.root.name, 'Lovers Point · detailed map area');
    assert.equal(area.geography.verticalDatum, 'North American Vertical Datum of 1988 (NAVD 88)');
    const meshes = parts(area.root), localMeshes = parts(local.root);
    assert(meshes.length <= 22, 'Map park including the sculptures stays within twenty-two static draws including five tree species');
    assert(meshes.reduce((sum, object) => sum + triangles(object.geometry) * (object instanceof InstancedMesh ? object.count : 1), 0) <= 50000);
    const sources: string[] = [];
    area.root.traverse(object => sources.push(object.name, ...(object.userData.sourceParts ?? [])));
    assert(sources.some(name => name.includes('Beach House')));
    assert(sources.some(name => name.includes('Volleyball')));
    assert(sources.some(name => name.includes('pool')));
    assert(!sources.some(name => /rowboat|tackle|fishing rod|bat star|exercise|ground marker|practice notice|gym bay/i.test(name)));
    assert(area.bounds.getSize(new Vector3()).x < 310, 'A giant ocean must not enter map framing');
    assert(area.bounds.getSize(new Vector3()).z < 310);
    assert(area.bounds.max.y > 17, 'The shared DEM and elevated buildings must remain present');
    assert(area.bounds.containsPoint(area.center));

    meshes.forEach((object, i) => {
      const geometry = object.geometry, p = geometry.attributes.position;
      for (const attribute of Object.values(geometry.attributes)) {
        assert.equal(attribute.count, p.count);
        assert(Array.from(attribute.array).every(Number.isFinite));
      }
      if (geometry.index) assert(Array.from(geometry.index.array).every(index => index >= 0 && index < p.count));
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        assert.equal(material.type, 'MeshToonMaterial');
        assert.equal((material as Material & { map?: unknown }).map ?? null, null);
      }
      assert.notEqual(geometry, localMeshes[i].geometry, 'Separate map/gym owners cannot share disposable source buffers');
      assert.notEqual(object.material, localMeshes[i].material);
      const a = new Vector3(), b = new Vector3();
      if (object instanceof InstancedMesh) {
        assert(localMeshes[i] instanceof InstancedMesh);
        const other = localMeshes[i] as InstancedMesh, currentMatrix = new Matrix4(), localMatrix = new Matrix4();
        assert.equal(object.count, other.count);
        for (let slot = 0; slot < object.count; slot++) {
          object.getMatrixAt(slot, currentMatrix); other.getMatrixAt(slot, localMatrix);
          // Test a non-origin prototype point so transformed silhouette scale,
          // rotated instances and translated placement are all checked.
          a.set(1.2, 2.3, -.7).applyMatrix4(currentMatrix).applyMatrix4(object.matrixWorld);
          b.set(1.2, 2.3, -.7).applyMatrix4(localMatrix).applyMatrix4(other.matrixWorld);
          const projected = projectLoversPointPoint([b.x, b.z], origin);
          assert(Math.abs(a.x - projected[0]) < 2e-5 && Math.abs(a.z - projected[1]) < 2e-5);
          assert.equal(a.y, b.y);
        }
      } else {
        const source = localMeshes[i].geometry.attributes.position;
        for (let vertex = 0; vertex < p.count; vertex += Math.max(1, Math.floor(p.count / 30))) {
          a.fromBufferAttribute(p, vertex).applyMatrix4(object.matrixWorld);
          b.fromBufferAttribute(source, vertex).applyMatrix4(localMeshes[i].matrixWorld);
          const projected = projectLoversPointPoint([b.x, b.z], origin);
          assert(Math.abs(a.x - projected[0]) < 2e-5 && Math.abs(a.z - projected[1]) < 2e-5);
          assert.equal(a.y, b.y);
        }
      }
    });
  } finally { area.dispose(); local.dispose(); }
});

test('Map park LOD preserves placements and instance slots and releases each owned resource once', async () => {
  const area = createLoversPointArea(origin), lod = createLodController();
  const camera = new PerspectiveCamera(45, 1, .1, 20000);
  camera.position.copy(area.center).add(new Vector3(300, 400, 500)); camera.lookAt(area.center); camera.updateMatrixWorld(true);
  const meshes = parts(area.root), matrices = meshes.map(object => object.matrixWorld.toArray());
  const instances = meshes.filter((object): object is InstancedMesh => object instanceof InstancedMesh)
    .map(object => ({ object, count: object.count, matrix: object.instanceMatrix, version: object.instanceMatrix.version, values: Array.from(object.instanceMatrix.array) }));
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>(), disposals = new Map<object, number>();
  const watch = (resource: BufferGeometry | Material | InstancedMesh) => {
    if (disposals.has(resource)) return;
    disposals.set(resource, 0);
    const listener = () => { disposals.set(resource, disposals.get(resource)! + 1); };
    if (resource instanceof InstancedMesh) resource.addEventListener('dispose', listener);
    else if (resource instanceof Material) resource.addEventListener('dispose', listener);
    else resource.addEventListener('dispose', listener);
  };
  try {
    await lod.register(area.root);
    const stats = lod.stats(area.root);
    assert.equal(stats.meshes, meshes.length);
    assert(stats.far.triangles < stats.mid.triangles && stats.mid.triangles < stats.near.triangles);
    assert.equal(stats.near.draws, stats.far.draws);
    for (const object of meshes) {
      const variants = await prepareGeometryLods(object.geometry);
      for (const level of LOD_LEVELS) geometries.add(variants[level]);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      if (object instanceof InstancedMesh) watch(object);
    }
    geometries.forEach(watch); materials.forEach(watch);
    for (const level of LOD_LEVELS) {
      lod.setMode(level); lod.update(camera, 900, 0, true); area.root.updateMatrixWorld(true);
      assert.deepEqual(meshes.map(object => object.matrixWorld.toArray()), matrices);
      for (const state of instances) {
        assert.equal(state.object.count, state.count); assert.equal(state.object.instanceMatrix, state.matrix);
        assert.equal(state.object.instanceMatrix.version, state.version);
        assert.deepEqual(Array.from(state.object.instanceMatrix.array), state.values);
      }
    }
    lod.dispose(); area.dispose(); area.dispose();
    for (const count of disposals.values()) assert.equal(count, 1);
  } finally { lod.dispose(); area.dispose(); }
});
