import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, PerspectiveCamera, SkinnedMesh, Vector3 } from 'three';
import { createTestingGym } from '../src/viewer/testingGym';
import { createGymBayExtension } from '../src/viewer/testingGym/bayExtension';
import { createGymDeer, DEER_INTEREST, DEER_SITES } from '../src/viewer/testingGym/deer';
import { DEER_BEHAVIOR } from '../src/viewer/testingGym/deerBehavior';
import { canStandAt, insidePolygon, type GymPoint } from '../src/viewer/avatarController';
import { createLodController } from '../src/models/shared/lod/controller';
import { LOD_LEVELS } from '../src/models/shared/lod/geometry';
import { DEER } from '../src/models/habitat/deer/definition';

type Population = ReturnType<typeof createGymDeer>;
const polygon = (points: readonly number[][]): GymPoint[] => points.map(p => [p[0], p[1]]);
function hoofClearance(model: Population['groups'][number]['models'][number], floorAt: (x: number, z: number) => number) {
  model.root.updateMatrixWorld(true); model.rig.skeleton.update();
  const mesh = model.mesh, joints = mesh.geometry.attributes.skinIndex, positions = mesh.geometry.attributes.position, point = new Vector3();
  let lowest = Infinity, stanceError = 0, stanceVertices = 0;
  for (let i = 0; i < positions.count; i++) {
    if (![6, 9, 12, 15].includes(joints.getX(i)) || Math.abs(positions.getY(i)) > 1e-6) continue;
    mesh.getVertexPosition(i, point);
    const stance = point.y < .007;
    point.applyMatrix4(mesh.matrixWorld);
    const clearance = point.y - floorAt(point.x, point.z);
    lowest = Math.min(lowest, clearance);
    if (stance) { stanceVertices++; stanceError = Math.max(stanceError, Math.abs(clearance)); }
  }
  return { lowest, stanceError, stanceVertices };
}
function boneSnapshot(population: Population) {
  const poses: number[] = [];
  population.root.traverse(o => {
    if (o instanceof SkinnedMesh) for (const bone of o.skeleton.bones)
      poses.push(...bone.position.toArray(), ...bone.quaternion.toArray(), ...bone.scale.toArray());
  });
  return poses;
}

test('deer families use real Gym/Bay grounds and retain safe motion, bounded rendering and lifecycle ownership', async t => {
  // Expensive district/bay construction is shared by all focused subtests.
  const gym = createTestingGym({ whaleSightingRoll: .99 }), bay = createGymBayExtension(gym);
  const world = { floorAt: bay.floorAt, waterAt: bay.waterAt, colliders: gym.colliders };
  const deer = createGymDeer(world), lod = createLodController();
  const assertSafe = (population: Population) => {
    for (const group of population.groups) {
      const [hx, hz] = group.site.home;
      for (const [i, member] of group.herd.members.entries()) {
        const model = group.models[i];
        assert(group.canStandAt(member.x, member.z, member.radius), member.id + ' valid habitat clearance');
        assert(canStandAt(member.x, member.z, group.bounds, gym.colliders, member.radius), member.id + ' actual world collision');
        assert(Math.hypot(member.x - hx, member.z - hz) + member.radius <= group.site.roamRadiusM + 1e-7);
        assert.equal(bay.waterAt(member.x, member.z), undefined);
        assert(Math.abs(member.y - bay.floorAt(member.x, member.z)) < 1e-8, member.id + ' physical ground');
        assert(Math.abs(model.root.position.y - bay.floorAt(model.root.position.x, model.root.position.z)) < 1e-8, member.id + ' root never sinks below terrain');
        assert(model.root.position.toArray().every(Number.isFinite));
        assert.equal(model.root.position.x, member.x); assert.equal(model.root.position.z, member.z);
        assert.equal(model.root.rotation.y, member.yaw);
        assert.deepEqual(model.root.scale.toArray(), [1, 1, 1]);
        const grass = group.site.grassSource;
        if ('outerPoints' in grass && grass.outerPoints) {
          const outline = polygon(grass.outerPoints);
          assert(insidePolygon(member.x, member.z, outline), member.id + ' mapped fairway');
          for (const inner of grass.excludedInnerPoints ?? [])
            assert(!insidePolygon(member.x, member.z, polygon(inner)), 'does not enter a mapped putting green');
        }
      }
      const [adult, fawn] = group.herd.members;
      assert(Math.hypot(adult.x - fawn.x, adult.z - fawn.z) <= DEER_BEHAVIOR.maxSeparationMeters + 1e-8);
      assert(Math.hypot(adult.x - fawn.x, adult.z - fawn.z) >= adult.radius + fawn.radius - 1e-8, 'family members never intersect each other');
    }
  };
  try {
    await t.test('six authored placements belong to mapped park/course grass and independent world collision', () => {
      assert.deepEqual(DEER_SITES.map(s => s.sourceId), ['way/871779748', 'way/36437304', 'way/27830670']);
      assert.equal(deer.groups.length, 3); assert.equal(deer.stats().count, 6);
      assert.equal(deer.stats().active, 0, 'new distant groups sleep until interest is assigned');
      assert(deer.groups.every(g => !g.cell.visible));
      for (const group of deer.groups) {
        assert.equal(group.site.sightingsVerified, false, 'placement never claims an observed live sighting');
        assert.deepEqual(group.herd.members.map(m => m.age), ['adult', 'fawn']);
        assert(insidePolygon(...group.site.home as [number, number], polygon(group.site.boundaryPoints)));
      }
      assertSafe(deer);
    });

    await t.test('ambient wandering and player avoidance stay on safe ground without separating a family', () => {
      let lowestSole = Infinity, greatestStanceError = 0;
      for (const group of deer.groups) {
        deer.setPlayer(0, 0, 0, false); deer.setViewer(...group.site.home as [number, number]);
        for (let frame = 0; frame < 360; frame++) {
          deer.update(1 / 30);
          if (frame % 12 === 0) {
            assertSafe(deer);
            for (const model of group.models) {
              const contact = hoofClearance(model, bay.floorAt);
              lowestSole = Math.min(lowestSole, contact.lowest); greatestStanceError = Math.max(greatestStanceError, contact.stanceError);
              assert(contact.lowest >= -.03, model.root.name + ' animated sole stays above the ground within3cm');
              assert(contact.stanceError <= .03, model.root.name + ' stance soles follow the actual site slope within3cm');
            }
          }
        }
        const adult = group.herd.members[0], [hx, hz] = group.site.home;
        let dx = hx - adult.x, dz = hz - adult.z, length = Math.hypot(dx, dz);
        if (length < .05) { dx = 0; dz = 1; length = 1; }
        const px = adult.x - dx / length * 3, pz = adult.z - dz / length * 3;
        const before = Math.hypot(adult.x - px, adult.z - pz);
        const alerts = group.herd.alerts;
        deer.setPlayer(px, bay.floorAt(px, pz), pz);
        for (let frame = 0; frame < 180; frame++) {
          deer.update(1 / 30);
          if (frame % 6 === 0) {
            assertSafe(deer);
            for (const model of group.models) {
              const contact = hoofClearance(model, bay.floorAt);
              lowestSole = Math.min(lowestSole, contact.lowest); greatestStanceError = Math.max(greatestStanceError, contact.stanceError);
              assert(contact.lowest >= -.03, model.root.name + ' galloping feet never penetrate the slope');
              assert(contact.stanceError <= .03, model.root.name + ' support feet stay close to the slope');
            }
          }
        }
        assert.equal(group.herd.alerts, alerts + 1, group.site.id + ' responds to approach');
        assert(Math.hypot(adult.x - px, adult.z - pz) > before + .25, group.site.id + ' moves away within its available patch');
      }
      console.log('Deer real-site hoof clearance', { lowestSole, greatestStanceError });
    });

    await t.test('visual terrain alignment supports planted hooves without changing root headings or physical anchors', () => {
      const floorAt = (x: number, z: number) => x * -.18 + z * .24;
      const sloped = createGymDeer({ floorAt, waterAt: () => undefined, colliders: [] });
      let unalignedError = 0;
      try {
        for (const group of sloped.groups) for (const [index, model] of group.models.entries()) {
          const member = group.herd.members[index];
          assert.equal(model.root.rotation.x, 0); assert.equal(model.root.rotation.z, 0);
          assert.equal(model.root.rotation.y, member.yaw);
          assert.equal(model.root.position.y, floorAt(member.x, member.z));
          for (const pose of ['idle', 'eat', 'walk', 'gallop'] as const) for (const time of [.3, 1.1, 2.7]) {
            model.poseAt(time, { pose });
            const aligned = hoofClearance(model, floorAt);
            assert(aligned.lowest >= -.03, pose + ' soles clear the ground plane');
            assert(aligned.stanceError <= .03, pose + ' planted soles lie on the ground plane');
          }
          model.poseAt(0, { pose: 'idle' });
          const rotation = model.mesh.quaternion.clone();
          model.mesh.quaternion.identity(); unalignedError = Math.max(unalignedError, hoofClearance(model, floorAt).stanceError);
          model.mesh.quaternion.copy(rotation);
        }
        assert(unalignedError > .08, 'negative control reproduces visible floating/penetrating feet without visual tilt');
      } finally { sloped.dispose(); }
    });

    await t.test('distance hysteresis sleeps models without bone updates or simulation catch-up', () => {
      const group = deer.groups[0], [x, z] = group.site.home;
      deer.setViewer(x, z); assert(group.herd.active);
      deer.setViewer(x + (DEER_INTEREST.enterMeters + DEER_INTEREST.exitMeters) / 2, z);
      assert(group.herd.active, 'already-active family stays awake in the hysteresis band');
      deer.setViewer(x + DEER_INTEREST.exitMeters + 1, z); assert(!group.herd.active);
      deer.setViewer(x + DEER_INTEREST.enterMeters + 1, z); assert(!group.herd.active);
      deer.setViewer(x + DEER_INTEREST.enterMeters - 1, z); assert(group.herd.active);
      deer.setViewer(100000, 100000);
      assert.equal(deer.stats().active, 0); assert(deer.groups.every(g => !g.cell.visible));
      const before = deer.stats(), bones = boneSnapshot(deer);
      let animationCalls = 0;
      const restore: (() => void)[] = [];
      for (const cell of deer.groups) for (const model of cell.models) {
        const original = model.update;
        model.update = (...args: Parameters<typeof original>) => { animationCalls++; return original(...args); };
        restore.push(() => { model.update = original; });
      }
      try { for (let frame = 0; frame < 120; frame++) deer.update(1); }
      finally { for (const reset of restore) reset(); }
      assert.equal(animationCalls, 0);
      assert.deepEqual(deer.stats(), before); assert.deepEqual(boneSnapshot(deer), bones);
      deer.setViewer(x, z);
      const positions = group.herd.members.map(m => [m.x, m.z]), elapsed = group.herd.elapsed;
      deer.update(1000);
      assert(Math.abs(group.herd.elapsed - elapsed - .1) < 1e-8);
      group.herd.members.forEach((m, i) => assert(Math.hypot(m.x - positions[i][0], m.z - positions[i][1]) <= .4 + 1e-8));
      assertSafe(deer);
    });

    await t.test('reduced motion freezes ambient rigs while real avoidance keeps its gait clock synchronized', () => {
      const quiet = createGymDeer(world), group = quiet.groups[0];
      try {
        quiet.setViewer(...group.site.home as [number, number]);
        const bones = boneSnapshot(quiet), before = quiet.stats();
        for (let i = 0; i < 100; i++) quiet.update(1 / 50, false);
        assert.deepEqual(quiet.stats(), before); assert.deepEqual(boneSnapshot(quiet), bones);
        const adult = group.herd.members[0], z = adult.z;
        quiet.setPlayer(adult.x, adult.y, adult.z - 3);
        let articulated = false;
        // 50Hz rendering alternates simulation step counts. The rig clock must
        // receive the actual elapsed simulation time, not each render delta.
        for (let i = 0; i < 200; i++) {
          quiet.update(1 / 50, false);
          group.models.forEach((model, index) => {
            assert(Math.abs(model.time - group.herd.members[index].timeSeconds) < 1e-8);
            articulated ||= model.pose === 'gallop' && model.time > .5;
          });
        }
        assert(adult.z > z + .25, 'avoidance still moves away under reduced motion');
        assert(articulated, 'the escaping model runs rather than sliding in a frozen grazing pose');
        assert.notDeepEqual(boneSnapshot(quiet), bones);
        assertSafe(quiet);
      } finally { quiet.dispose(); }
    });

    await t.test('all six reusable models retain bounded LOD geometry and stable physical positions', async () => {
      for (const group of deer.groups) group.cell.visible = true;
      await lod.register(deer.root);
      const positions = deer.groups.flatMap(g => g.models.map(m => m.root.position.toArray()));
      const stats = lod.stats(deer.root), camera = new PerspectiveCamera();
      for (const level of LOD_LEVELS) {
        lod.setMode(level); lod.update(camera, 900, 0, true);
        assert.equal(stats[level].draws, 6);
        assert(stats[level].triangles <= DEER.budget[level] * 6);
        assert.deepEqual(deer.groups.flatMap(g => g.models.map(m => m.root.position.toArray())), positions);
        assertSafe(deer);
        for (const group of deer.groups) for (const model of group.models) {
          const contact = hoofClearance(model, bay.floorAt);
          assert(contact.lowest >= -.03 && contact.stanceError <= .03, level + ' retains planted soles on the site slope');
        }
      }
      assert(stats.mid.triangles < stats.near.triangles); assert(stats.far.triangles < stats.mid.triangles);
      console.log('Gym deer LOD', JSON.stringify(stats));
    });

    await t.test('population disposal releases its LOD family exactly once and prevents further model work', () => {
      const geometries = new Set<Mesh['geometry']>(), materials = new Set<object>();
      let disposedGeometry = 0, disposedMaterial = 0;
      const camera = new PerspectiveCamera();
      for (const level of LOD_LEVELS) {
        lod.setMode(level); lod.update(camera, 900, 0, true);
        deer.root.traverse(o => {
          if (!(o instanceof Mesh)) return;
          if (!geometries.has(o.geometry)) { geometries.add(o.geometry); o.geometry.addEventListener('dispose', () => disposedGeometry++); }
          for (const material of Array.isArray(o.material) ? o.material : [o.material]) if (!materials.has(material)) {
            materials.add(material); material.addEventListener('dispose', () => disposedMaterial++);
          }
        });
      }
      const updates = deer.stats().updates;
      lod.dispose(); deer.dispose(); deer.dispose(); deer.update(.1); deer.setViewer(...DEER_SITES[0].home as [number, number]);
      assert.equal(deer.stats().updates, updates);
      assert.equal(deer.root.children.length, 0); assert(deer.groups.every(g => !g.herd.active));
      assert.equal(disposedGeometry, geometries.size); assert.equal(disposedMaterial, materials.size);
    });
  } finally { lod.dispose(); deer.dispose(); bay.dispose(); gym.dispose(); }
});
