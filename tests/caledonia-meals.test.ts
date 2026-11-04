import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, MeshToonMaterial, PerspectiveCamera, Raycaster, Texture, Vector3, type Intersection, type Object3D } from 'three';
import { CALEDONIA_BUDGET, CALEDONIA_BUILDING_IDS, caledoniaFootprint, caledoniaHeight, createCaledoniaArea, inCaledonia } from '../src/viewer/mapStudy/caledonia';
import { MEALS_SITE, createCaledoniaAnnex, inMealsAnnex } from '../src/viewer/mapStudy/caledoniaAnnex';
import { MEALS_BUILDING_ID, MEALS_BUDGET, createCaledoniaMeals } from '../src/viewer/mapStudy/caledoniaMeals';
import { projectWaterfront } from '../src/viewer/mapStudy/waterfront';
import { canStandAt, insidePolygon, type GymPoint } from '../src/viewer/avatarController';
import { groundHeight } from '../src/viewer/testingGym/elevation';
import { createTestingGym } from '../src/viewer/testingGym';
import { createGymBayExtension } from '../src/viewer/testingGym/bayExtension';
import { createLodController } from '../src/models/shared/lod/controller';
import { LOD_LEVELS } from '../src/models/shared/lod/geometry';
import { disposeObject } from '../src/models/props/primitives';
import { toonRamp } from '../src/models/shared/style';

const origin = MEALS_SITE.origin as [number, number];
const camera = new PerspectiveCamera(45, 1, .1, 200000);
const close = (actual: number, expected: number, tolerance = 2e-5, label = '') =>
  assert(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected} (tolerance ${tolerance})`);

/** Deliberately bypass the controller's canonical picking proxy: these tests
 * measure the geometry the renderer is actually drawing at each distance. */
function renderedGroundHits(root: Object3D, x: number, z: number) {
  root.updateWorldMatrix(true, true);
  const ray = new Raycaster(new Vector3(x, 2000, z), new Vector3(0, -1, 0));
  const hits: Intersection[] = [];
  root.traverseVisible(o => { if (o instanceof Mesh) Mesh.prototype.raycast.call(o, ray, hits); });
  return hits.sort((a, b) => a.distance - b.distance);
}

test('Meals uses the complete mapped 700 Jewell footprint and a north annex, not a displaced park building', () => {
  assert.equal(MEALS_BUILDING_ID, 'way/559348745');
  assert.equal(MEALS_SITE.buildingId, MEALS_BUILDING_ID);
  assert(CALEDONIA_BUILDING_IDS.has(MEALS_BUILDING_ID), 'shared map excludes a duplicate coarse building');
  const mapped = MEALS_SITE.buildings.find(b => b.id === MEALS_BUILDING_ID)!;
  assert.equal(mapped.tags['addr:housenumber'], '700');
  assert.equal(mapped.tags['addr:street'], 'Jewell Avenue');
  assert.equal(mapped.rings[0].length, 29, 'complete source plan is retained, including its stepped wings');
  const xs = mapped.rings[0].map(p => p[0]), zs = mapped.rings[0].map(p => p[1]);
  close(Math.max(...xs) - Math.min(...xs), 50.7239);
  close(Math.max(...zs) - Math.min(...zs), 42.5322);
  assert(mapped.rings[0].every(p => inMealsAnnex(p[0], p[1])));
  assert.equal(MEALS_SITE.projection.units, 'metres');
  assert.equal(MEALS_SITE.terrain.values.length, MEALS_SITE.terrain.grid.columns * MEALS_SITE.terrain.grid.rows);
  assert(MEALS_SITE.terrain.values.every(Number.isFinite));
  assert.match(MEALS_SITE.buildingUrl, /way\/559348745\/full\.json$/);
  assert(Object.values(MEALS_SITE.sourceHashes).every(hash => /^[a-f0-9]{64}$/.test(hash)));

  const footprint = caledoniaFootprint(origin);
  for (const [point, expected] of [
    [[-200, 50], true], [[-230, 20], true], [[-300, 150], true],
    [[-300, 50], false], [[-241, 50], false], [[-200, 14], false], [[-440, 150], false],
  ] as [GymPoint, boolean][]) {
    assert.equal(inCaledonia(...point), expected, 'physical ownership at ' + point);
    assert.equal(insidePolygon(...point, footprint), expected, 'coarse-map exclusion at ' + point);
  }
});

test('annex active LOD terrain matches the physical floor and joins the existing district without steps', async () => {
  const annex = createCaledoniaAnnex(caledoniaHeight), lod = createLodController();
  try {
    await lod.register(annex);
    for (const level of LOD_LEVELS) {
      lod.setMode(level); lod.update(camera, 900, 0, true);
      assert(lod.inspect(annex).every(e => e.level === level));
      for (let x = -239.173; x < -145; x += 5.131) for (let z = 15.319; z < 90; z += 4.713) {
        const hits = renderedGroundHits(annex, x, z);
        assert.equal(hits.length, 1, `${level} has exactly one ground surface at ${x},${z}`);
        close(hits[0].point.y, caledoniaHeight(x, z), .02, `${level} rendered/physical ground`);
      }
    }
    // Check between vertices as well as on them: resampling an incompatible
    // grid can appear correct at endpoints while leaving a visible seam.
    for (let x = -239.913; x < -145; x += .491)
      close(caledoniaHeight(x, 90 - 1e-6), caledoniaHeight(x, 90), .015, 'southern terrain seam at ' + x);
    for (let z = 15.113; z < 90; z += .413)
      close(caledoniaHeight(-145 - 1e-6, z), groundHeight(-145, z), .015, 'eastern terrain seam at ' + z);
  } finally { lod.dispose(); disposeObject(annex); }
});

test('Meals keeps one matte image-free draw, its mapped collision and identity while LOD removes facade detail', async () => {
  const meals = createCaledoniaMeals({ floorAt: caledoniaHeight }), lod = createLodController();
  const mesh = meals.root.children[0] as Mesh;
  const before = JSON.stringify({ colliders: meals.colliders, flight: meals.flightObstacles });
  const transform = meals.root.matrix.toArray(), identity = [meals.root.uuid, mesh.uuid];
  const geometries = new Set<Mesh['geometry']>();
  let geometryDisposals = 0, materialDisposals = 0;
  try {
    await lod.register(meals.root);
    assert.equal(meals.sourceId, MEALS_BUILDING_ID);
    assert.deepEqual(meals.footprint, MEALS_SITE.buildings[0].rings[0]);
    assert.deepEqual(meals.root.scale.toArray(), [1, 1, 1]);
    assert.equal(meals.root.userData.units, 'metres');
    assert.equal(meals.root.userData.sourceId, MEALS_BUILDING_ID);
    assert.equal(meals.root.children.length, 1);
    assert(mesh.material instanceof MeshToonMaterial);
    assert.equal(mesh.material.gradientMap, toonRamp('matte'));
    assert.equal(mesh.material.userData.rim, false);
    assert.equal(mesh.material.transparent, false);
    assert.equal(mesh.material.opacity, 1);
    assert.equal(mesh.geometry.hasAttribute('uv'), false);
    for (const [key, value] of Object.entries(mesh.material))
      if (value instanceof Texture) assert.equal(key, 'gradientMap', 'no photographic or downloaded texture');
    mesh.material.addEventListener('dispose', () => materialDisposals++);

    const boundary = { minX: -240, maxX: -145, minZ: 15, maxZ: 90 };
    assert(!canStandAt(-198, 65, boundary, meals.colliders), 'building interior remains solid');
    assert(canStandAt(meals.entry.x, meals.entry.z, boundary, meals.colliders, .5), 'clear approach to the entry');
    const building = meals.colliders[0];
    assert.equal(building.kind, 'box');
    if (building.kind === 'box') assert.deepEqual(building.footprint, meals.footprint);
    close(meals.flightObstacles[0].top, meals.baseY + meals.height);
    close(meals.height, 6.35);

    const stats = lod.stats(meals.root);
    for (const level of LOD_LEVELS) {
      lod.setMode(level); lod.update(camera, 900, 0, true);
      assert.equal(stats[level].draws, MEALS_BUDGET.draws);
      assert(stats[level].triangles <= MEALS_BUDGET[level], `${level} facade budget`);
      assert.equal(JSON.stringify({ colliders: meals.colliders, flight: meals.flightObstacles }), before);
      assert.deepEqual([meals.root.uuid, mesh.uuid], identity);
      assert.deepEqual(meals.root.matrix.toArray(), transform);
      const bounds = new Box3().setFromObject(meals.root, true);
      close(bounds.max.y, meals.baseY + meals.height, 2e-5, 'tower identity at ' + level);
      assert(bounds.max.x - bounds.min.x > 50 && bounds.max.x - bounds.min.x < 52, 'metre-scale footprint');
      assert(bounds.max.z - bounds.min.z > 42 && bounds.max.z - bounds.min.z < 44, 'metre-scale footprint');
      assert(mesh.geometry.attributes.position.array.every(Number.isFinite));
      if (!geometries.has(mesh.geometry)) {
        geometries.add(mesh.geometry);
        mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
      }
    }
    assert.equal(geometries.size, 3, 'authored detail variants, not one unchanged distant mesh');
    assert(stats.mid.triangles < stats.near.triangles * .6);
    assert(stats.far.triangles < stats.near.triangles * .4);
    console.log('Meals facade LOD', JSON.stringify(stats));
  } finally {
    lod.dispose(); meals.dispose(); meals.dispose();
  }
  assert.equal(geometryDisposals, 3, 'all owned LOD buffers released exactly once');
  assert.equal(materialDisposals, 1);
});

test('map-origin reprojection applies equally to every lazy building LOD without rescaling physical descriptors', async () => {
  // A deliberately different latitude exposes a lost scale in lazy authored
  // variants; the app usually uses origins much nearer to one another.
  const otherOrigin = [-121.9, 50] as const;
  const canonical = createCaledoniaMeals({ floorAt: caledoniaHeight });
  const area = createCaledoniaArea(otherOrigin), projected = area.meals;
  const parent = area.root, lod = createLodController();
  try {
    await lod.register(canonical.root); await lod.register(projected.root); await lod.register(area.annex);
    assert.deepEqual(parent.scale.toArray(), [1, 1, 1]);
    assert.deepEqual(projected.colliders, canonical.colliders, 'physics stays in the shared Gym frame');
    assert.deepEqual(projected.flightObstacles, canonical.flightObstacles);
    const a = canonical.root.children[0] as Mesh, b = projected.root.children[0] as Mesh;
    for (const level of LOD_LEVELS) {
      lod.setMode(level); lod.update(camera, 900, 0, true);
      canonical.root.updateMatrixWorld(true); parent.updateMatrixWorld(true);
      const ap = a.geometry.attributes.position, bp = b.geometry.attributes.position;
      assert.equal(ap.count, bp.count);
      const va = new Vector3(), vb = new Vector3();
      for (let i = 0; i < ap.count; i++) {
        va.fromBufferAttribute(ap, i).applyMatrix4(a.matrixWorld);
        vb.fromBufferAttribute(bp, i).applyMatrix4(b.matrixWorld);
        const point = projectWaterfront([va.x, va.z], otherOrigin);
        close(vb.x, point[0], 3e-5, level + ' projected east');
        close(vb.z, point[1], 3e-5, level + ' projected south');
        close(vb.y, va.y, 3e-5, level + ' vertical metres');
      }
      // Probe ground away from the building, using transformed world coordinates.
      const [x, z] = projectWaterfront([-232.13, 23.71], otherOrigin);
      const hits = renderedGroundHits(area.annex, x, z);
      assert.equal(hits.length, 1);
      close(hits[0].point.y, caledoniaHeight(-232.13, 23.71), .02);
    }
  } finally { lod.dispose(); canonical.dispose(); area.dispose(); }
});

test('the full Caledonia destination stays within budget and the annex owns walking, flight and the coarse-map hole', async () => {
  const gym = createTestingGym({ whaleSightingRoll: .99 }), lod = createLodController();
  const bay = createGymBayExtension(gym);
  try {
    await lod.register(gym.caledonia.root);
    const stats = lod.stats(gym.caledonia.root);
    for (const level of LOD_LEVELS) {
      assert(stats[level].triangles <= CALEDONIA_BUDGET.triangles, `${level} total ${stats[level].triangles}`);
      assert(stats[level].draws <= CALEDONIA_BUDGET.draws, `${level} total draws`);
    }
    assert.equal(CALEDONIA_BUDGET.triangles, 45000, 'extension fits the existing ceiling');
    assert.equal(CALEDONIA_BUDGET.draws, 8);
    for (const point of [[-232.13, 23.71], [-230.41, 69.13], [-151.17, 31.73], [-161.71, 86.31]] as GymPoint[]) {
      assert(canStandAt(...point, gym.bounds, gym.colliders, .5), 'annex ground is walkable at ' + point);
      assert.equal(gym.swimming.surfaceHeight(...point), undefined);
      assert.equal(gym.flightWater(...point), undefined);
      assert.equal(bay.waterAt(...point), undefined);
      assert(bay.canLandAt(...point));
      for (const floor of [gym.groundHeight, gym.terrainHeight, gym.swimGroundHeight, gym.flightFloor, bay.floorAt])
        close(floor(...point), caledoniaHeight(...point), 1e-8, 'shared land/flight ground');
    }
    assert(!canStandAt(-300, 50, gym.bounds, []), 'the concave crop does not invent land in its northwestern notch');
    const coarseGround: Mesh[] = [];
    bay.root.traverse(o => { if (o instanceof Mesh && o.name.startsWith('Bay terrain')) coarseGround.push(o); });
    assert(coarseGround.length > 0);
    bay.root.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(-200.17, 2000, 50.31), new Vector3(0, -1, 0));
    assert.equal(ray.intersectObjects(coarseGround).length, 0, 'coarse terrain is absent beneath the new detailed annex');
    ray.ray.origin.set(-300.17, 2000, 50.31);
    assert.equal(ray.intersectObjects(coarseGround).length, 1, 'the concave notch retains its regional terrain');
    console.log('Caledonia with Meals LOD', JSON.stringify(stats));
  } finally { lod.dispose(); bay.dispose(); gym.dispose(); }
});

test('all four porch supports meet the sloping forecourt at every LOD', async () => {
  const model=createCaledoniaMeals({floorAt:caledoniaHeight}),lod=createLodController();
  try {
    await lod.register(model.root);
    for(const level of LOD_LEVELS){
      lod.setMode(level);lod.update(camera,900,0,true);model.root.updateMatrixWorld(true);
      for(const offset of [-3.93,-1.31,1.31,3.93]){
        const x=model.center[0]+model.front[1]*offset+model.front[0]*2.53,z=model.center[1]-model.front[0]*offset+model.front[1]*2.53;
        const floor=caledoniaHeight(x,z),ray=new Raycaster(new Vector3(x,floor-.5,z),new Vector3(0,1,0)),hits:Intersection[]=[];
        model.root.traverse(o=>{if(o instanceof Mesh)Mesh.prototype.raycast.call(o,ray,hits);});
        hits.sort((a,b)=>a.distance-b.distance);assert(hits.length>0,level+' support exists');
        assert(hits[0].point.y<=floor+.005&&hits[0].point.y>=floor-.15,level+' support touches ground instead of floating above the downslope entrance');
      }
    }
  }finally{lod.dispose();model.dispose();}
});
