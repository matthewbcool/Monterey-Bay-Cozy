import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, MeshToonMaterial, PerspectiveCamera, Raycaster, Vector3 } from 'three';
import { createDeer, getDeer, setDeerPose, updateDeer } from '../src/models/habitat/deer/createDeer';
import { DEER, DEER_LEGS, DEER_POSES, type DeerVariant } from '../src/models/habitat/deer/definition';
import { createLodController } from '../src/models/shared/lod/controller';
import { geometryBytes, LOD_LEVELS, prepareGeometryLods, triangles } from '../src/models/shared/lod/geometry';
import { disposeObject } from '../src/models/props/primitives';

const variants: DeerVariant[] = ['adult', 'fawn'];
const warm = (a: ReturnType<typeof createDeer>) => { a.root.updateMatrixWorld(true); a.mesh.skeleton.update(); };
const transforms = (a: ReturnType<typeof createDeer>) => a.rig.bones.flatMap(b => [...b.position.toArray(), ...b.quaternion.toArray(), ...b.scale.toArray()]);

test('Both seeded deer variants keep finite normalized 18-bone skins and one matte draw within every LOD budget', async () => {
  for (const variant of variants) for (let seed = 0; seed < 12; seed++) {
    const a = createDeer({ variant, seed }), levels = await prepareGeometryLods(a.mesh.geometry);
    try {
      assert.equal(a.rig.bones.length, 18); assert.equal(a.root.children.length, 1); assert(a.mesh.material instanceof MeshToonMaterial);
      assert.equal(a.mesh.material.map, null); assert.equal(a.mesh.material.transparent, false); assert.equal(a.mesh.material.userData.rim, false);
      assert.deepEqual(a.root.scale.toArray(), [1, 1, 1]); assert.equal(a.root.userData.units, 'metres'); assert.equal(a.root.userData.seed, seed);
      const sizes: number[] = [];
      for (const level of LOD_LEVELS) {
        const g = levels[level], p = g.attributes.position, joints = g.attributes.skinIndex, weights = g.attributes.skinWeight, used = new Set<number>();
        assert(triangles(g) <= DEER.budget[level], level + ' budget'); assert(g.index); assert.equal(g.index.count % 3, 0);
        assert(Array.from(g.index.array).every(i => i >= 0 && i < p.count));
        for (const [name, attribute] of Object.entries(g.attributes)) { assert.equal(attribute.count, p.count, name); assert(Array.from(attribute.array).every(Number.isFinite), name); }
        for (let i = 0; i < p.count; i++) {
          let total = 0;
          for (let k = 0; k < 4; k++) { const j = joints.getComponent(i, k), w = weights.getComponent(i, k); assert(j >= 0 && j < 18 && Number.isInteger(j)); assert(w >= 0 && w <= 1); total += w; if (w) used.add(j); }
          assert(Math.abs(total - 1) < 1e-7);
        }
        assert.equal(used.size, 18, 'Every LOD retains the complete functional rig'); sizes.push(geometryBytes(g));
      }
      assert(sizes[0] > sizes[1] && sizes[1] > sizes[2]);
    } finally { a.dispose(); }
  }
});

test('Fawn identity has larger relative ears/legs, shorter muzzle and integrated cream spots; seeds are reproducible', async () => {
  const adult = createDeer({ seed: 11 }), fawn = createDeer({ variant: 'fawn', seed: 11 }), same = createDeer({ variant: 'fawn', seed: 11 }), other = createDeer({ variant: 'fawn', seed: 12 });
  try {
    assert.equal(adult.root.userData.sex, 'female'); assert.equal(adult.root.userData.assetId, 'black-tailed-deer'); assert.equal(fawn.root.userData.assetId, 'black-tailed-fawn');
    assert.equal(getDeer(fawn.root), fawn); assert.equal(fawn.physics.anchors.feet[1], 0);
    const bodyRatio = fawn.dimensions.bodyRadius.z / adult.dimensions.bodyRadius.z;
    assert(fawn.rig.pivots[4].y / adult.rig.pivots[4].y > bodyRatio, 'Fawn legs are proportionately long');
    assert((fawn.dimensions.heightMeters - fawn.rig.pivots[2].y) / fawn.dimensions.bodyRadius.z > (adult.dimensions.heightMeters - adult.rig.pivots[2].y) / adult.dimensions.bodyRadius.z);
    for (const key of Object.keys(fawn.mesh.geometry.attributes)) assert.deepEqual(fawn.mesh.geometry.attributes[key].array, same.mesh.geometry.attributes[key].array);
    assert.notDeepEqual(fawn.mesh.geometry.attributes.color.array, other.mesh.geometry.attributes.color.array);
    const cream = new Color('#ddd2b4'), levels = await prepareGeometryLods(fawn.mesh.geometry);
    for (const level of ['near', 'mid'] as const) {
      const c = levels[level].attributes.color, joints = levels[level].attributes.skinIndex;
      let spots = 0; for (let i = 0; i < c.count; i++) if (joints.getX(i) === 0 && Math.abs(c.getX(i) - cream.r) < 1e-6 && Math.abs(c.getY(i) - cream.g) < 1e-6) spots++;
      assert(spots >= 12, level + ' retains cream body pigment');
    }
  } finally { for (const a of [adult, fawn, same, other]) a.dispose(); }
  assert.throws(() => createDeer({ seed: -1 }), /uint32/); assert.throws(() => createDeer({ variant: 'buck' as DeerVariant }), /variant/);
});

test('Grounded hooves, low feeding reach and conservative motion bounds survive every pose and LOD without changing buffers or placement', async () => {
  for (const variant of variants) {
    const a = createDeer({ variant, seed: 8 }), levels = await prepareGeometryLods(a.mesh.geometry), rootPosition = a.root.position.clone(), rootQuaternion = a.root.quaternion.clone(), physics = JSON.stringify(a.physics), v = new Vector3();
    try {
      for (const level of LOD_LEVELS) {
        a.mesh.geometry = levels[level]; const p = a.mesh.geometry.attributes.position, joints = a.mesh.geometry.attributes.skinIndex; assert(p instanceof BufferAttribute); const before = p.array.slice(), version = p.version;
        for (const pose of DEER_POSES) {
          let lifted = 0, planted = 0, mouthLow = Infinity;
          for (let frame = 0; frame < 48; frame++) {
            a.poseAt(frame / 24, { pose }); warm(a);
            const feet = [Infinity, Infinity, Infinity, Infinity];
            for (let i = 0; i < p.count; i++) {
              v.fromBufferAttribute(p, i); a.mesh.applyBoneTransform(i, v); assert(a.mesh.boundingBox!.containsPoint(v), variant + '/' + level + '/' + pose + ' motion bounds');
              assert(v.y > -.001, 'No anatomy penetrates the floor');
              const joint = joints.getX(i), leg = DEER_LEGS.findIndex(j => joint === j + 2); if (leg >= 0) feet[leg] = Math.min(feet[leg], v.y);
              if (joint === 2) mouthLow = Math.min(mouthLow, v.y);
            }
            for (const foot of feet) { if (foot < .002) planted++; if (foot > .025) lifted++; }
          }
          assert(planted > 40, 'Support contacts remain on the ground');
          if (pose === 'walk' || pose === 'gallop') assert(lifted > 10, 'Legs articulate instead of hovering as a rigid body');
          if (pose === 'eat') assert(mouthLow >= 0 && mouthLow < .085, 'Muzzle reaches the grass');
        }
        assert.deepEqual(p.array, before); assert.equal(p.version, version);
      }
      assert(a.root.position.equals(rootPosition)); assert(a.root.quaternion.equals(rootQuaternion)); assert.equal(JSON.stringify(a.physics), physics);
    } finally { a.dispose(); }
  }
});

/** Isolate an actual skinned part for ray intersection, independently of its
 * procedural primitive parameters. This catches a floating tail/hip regression. */
function part(a: ReturnType<typeof createDeer>, joint: number) {
  const g = a.mesh.geometry, p = g.attributes.position, skin = g.attributes.skinIndex, values: number[] = [], v = new Vector3();
  for (let i = 0; i < g.index!.count; i += 3) {
    const ids = [g.index!.getX(i), g.index!.getX(i + 1), g.index!.getX(i + 2)]; if (!ids.every(i => skin.getX(i) === joint)) continue;
    for (const id of ids) { v.fromBufferAttribute(p, id); a.mesh.applyBoneTransform(id, v); values.push(...v.toArray()); }
  }
  const out = new BufferGeometry(); out.setAttribute('position', new Float32BufferAttribute(values, 3)); out.computeVertexNormals(); const mesh = new Mesh(out, new MeshBasicMaterial({ side: DoubleSide })); mesh.updateMatrixWorld(true); return mesh;
}
test('Tail base stays inside the actual torso and all shoulder/haunch surfaces overlap it during locomotion', () => {
  const direction = new Vector3(), ray = new Raycaster();
  for (const variant of variants) {
    const a = createDeer({ variant, seed: 3 });
    try {
      for (const pose of DEER_POSES) for (const time of [0, .21, .5]) {
        a.poseAt(time, { pose }); warm(a); const body = part(a, 0), bob = a.rig.bones[0].position.y;
        const tail = a.rig.pivots[3].clone(); tail.y += bob; ray.set(tail, new Vector3(1, 0, 0));
        assert(ray.intersectObject(body).some(hit => hit.distance > .01 && hit.distance < .3), 'Tail anchor intersects rump cross-section');
        for (const joint of DEER_LEGS) {
          const hip = part(a, joint), origin = new Vector3(0, a.dimensions.bodyY + bob, 0), center = a.rig.pivots[joint].clone(); center.y -= variant === 'fawn' ? .04 : .06; center.y += bob;
          direction.copy(center).sub(origin).normalize(); ray.set(origin, direction);
          const bodyHit = ray.intersectObject(body)[0], hipHit = ray.intersectObject(hip)[0]; assert(bodyHit && hipHit); assert(hipHit.distance <= bodyHit.distance + .02, 'Haunch joins body instead of floating'); hip.geometry.dispose(); (hip.material as MeshBasicMaterial).dispose();
        }
        body.geometry.dispose(); (body.material as MeshBasicMaterial).dispose();
      }
    } finally { a.dispose(); }
  }
});

test('Blends are continuous, reduced motion freezes, absolute poses are repeatable and disposal releases the entire LOD family once', async () => {
  const a = createDeer({ seed: 4 }), lod = createLodController(), camera = new PerspectiveCamera(45, 1, .01, 100);
  await lod.register(a.root); const original = a.mesh.geometry, levels = await prepareGeometryLods(original), releases = [0, 0, 0]; let skeletonReleases = 0, materialReleases = 0;
  LOD_LEVELS.forEach((key, i) => levels[key].addEventListener('dispose', () => releases[i]++)); const releaseSkeleton = a.rig.skeleton.dispose.bind(a.rig.skeleton); a.rig.skeleton.dispose = () => { skeletonReleases++; releaseSkeleton(); }; (a.mesh.material as MeshToonMaterial).addEventListener('dispose', () => materialReleases++);
  const before = transforms(a); setDeerPose(a.root, 'eat', .7); assert.deepEqual(transforms(a), before);
  updateDeer(a.root, .0001); assert(Math.max(...transforms(a).map((v, i) => Math.abs(v - before[i]))) < .001, 'Transition starts without a pose jump');
  const frozen = transforms(a), clock = a.time; updateDeer(a.root, 1, { reducedMotion: true, pose: 'gallop' }); assert.deepEqual(transforms(a), frozen); assert.equal(a.time, clock);
  a.poseAt(2.1, { pose: 'walk', speed: .8 }); const target = transforms(a); a.poseAt(8, { pose: 'gallop' }); a.poseAt(2.1, { pose: 'walk', speed: .8 }); assert.deepEqual(transforms(a), target);
  const phase = a.stridePhase; a.update(.02, { pose: 'gallop', speed: 2.2 }); assert(a.stridePhase > phase, 'Changing gait never resets phase');
  lod.setMode('far'); lod.update(camera, 900, 0, true); assert.equal(a.mesh.geometry, levels.far); assert.equal(lod.stats(a.root).far.draws, 1);
  disposeObject(a.root); a.dispose(); assert.equal(getDeer(a.root), undefined); assert.deepEqual(releases, [1, 1, 1]); assert.equal(skeletonReleases, 1); assert.equal(materialReleases, 1); assert.equal(lod.size, 0); lod.dispose();
});
