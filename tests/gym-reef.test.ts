import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import { NodeMaterial } from 'three/webgpu';
import { createTestingGym, DIVE_BOAT } from '../src/viewer/testingGym';
import { createGymReef, GYM_REEF } from '../src/viewer/testingGym/reef';
import { applyNodeStyle } from '../src/viewer/nodeStyle';
import { createAnemone, createAnemoneBed } from '../src/models/habitat/anemone/createAnemone';
import { ANEMONE_BUDGET } from '../src/models/habitat/anemone/definition';

test('anemones: one draw within budget, metre scale, seeded and instanced beds dispose once', () => {
  for (const species of ['giant-green', 'aggregating'] as const) {
    const a = createAnemone({ species, seed: 3 }), b = createAnemone({ species, seed: 3 });
    const meshA = a.children[0] as Mesh, meshB = b.children[0] as Mesh;
    assert.equal(a.children.length, 1); assert(meshA.geometry.index!.count / 3 <= ANEMONE_BUDGET.triangles);
    assert.deepEqual([...meshA.geometry.getAttribute('position').array], [...meshB.geometry.getAttribute('position').array], 'same seed, same animal');
    meshA.geometry.computeBoundingBox(); const size = meshA.geometry.boundingBox!.getSize(new Vector3());
    assert(size.y > .03 && size.y < .2 && size.x < .25, `${species} stays anemone-sized: ${size.toArray()}`);
    assert.equal(meshA.geometry.boundingBox!.min.y >= -1e-6, true, 'base sits on the contact surface');
  }
  const bed = createAnemoneBed('aggregating', [{ position: new Vector3(1, 2, 3), normal: new Vector3(0, 1, 0) }, { position: new Vector3(0, 0, 0), normal: new Vector3(1, 1, 0) }]);
  assert.equal(bed.root.count, 2); bed.dispose(); bed.dispose();
});

test('the reef is a separately budgeted, interest-managed library community', () => {
  const gym = createTestingGym(), reef = gym.reef;
  let released = 0;
  try {
    assert.notEqual(reef.root.parent, gym.root, 'reef stays outside the park world budget');
    const { draws, triangles } = reef.stats();
    assert(draws <= GYM_REEF.budget.drawCalls, `${draws} reef draws`); assert(triangles <= GYM_REEF.budget.triangles, `${triangles} reef triangles`);
    const ids = new Set<string>(); reef.root.traverse(o => { const id = o.userData.assetId ?? o.userData.speciesId; if (id) ids.add(id); });
    for (const id of ['giant-green-anemone', 'aggregating-anemone', 'blue-rockfish']) assert(ids.has(id), `${id} placed`);
    // Everything sits between seabed and surface.
    for (const s of reef.swimmers) { const y = s.model.root.position.y; assert(y > -4.2 && y < 1, `swimmer at ${y}`); }
    const before = reef.swimmers.map(s => s.model.root.position.clone());
    reef.update(.5); assert(reef.swimmers.some((s, i) => s.model.root.position.distanceTo(before[i]) > .01), 'fish swim their loops');
    const frozen = reef.swimmers.map(s => s.model.root.position.clone()); reef.update(.5, false);
    assert(reef.swimmers.every((s, i) => s.model.root.position.equals(frozen[i])), 'reduced motion freezes the loops');
    reef.setViewer(0, -35); assert(!reef.active && !reef.root.visible, 'far from the spawn lawn the reef sleeps');
    const asleep = reef.swimmers.map(s => s.model.root.position.clone()); reef.update(.5);
    assert(reef.swimmers.every((s, i) => s.model.root.position.equals(asleep[i])), 'inactive reef does no work');
    reef.setViewer(DIVE_BOAT.reef[0], DIVE_BOAT.reef[1]); assert(reef.active && reef.root.visible);
    // Divers glide over boulders: the controller floor includes rock tops.
    const rock = reef.rocks[0]; assert(gym.swimGroundHeight(rock.x, rock.z) > rock.y, 'boulders lift the swim floor');
    applyNodeStyle(reef.root);
    reef.swayKelp(); reef.swayKelp();
    const batches = reef.root.children.filter(o => o.name === 'gym-reef-rocks' || o.name.startsWith('gym-reef-kelp-')) as Mesh[];
    assert.equal(batches.length, 4, 'rock and three kelp materials are styled');
    for (const batch of batches) {
      assert(batch.material instanceof NodeMaterial);
      if (batch.name.startsWith('gym-reef-kelp-')) assert(batch.material.positionNode, 'kelp sway is installed');
      batch.material.addEventListener('dispose', () => { released++; });
    }
  } finally { gym.dispose(); gym.dispose(); }
  assert.equal(released, 4, 'all converted reef materials release once');
});

test('the dive boat drives, stays off the coast, carries its hull colliders and returns to its mooring', () => {
  const gym = createTestingGym(), boat = gym.diveBoat, vessel = boat.vessel;
  try {
    assert(vessel.nearDock() && vessel.canFloatAt(DIVE_BOAT.x, DIVE_BOAT.z, DIVE_BOAT.yaw));
    const start = boat.root.position.clone();
    for (let i = 0; i < 180; i++) { vessel.update(1 / 60, { throttle: 1, steer: 0, fast: true }); gym.update(i / 60); }
    assert(boat.root.position.distanceTo(start) > 8, 'motorboat travels'); assert(!vessel.nearDock());
    const hull = gym.colliders.filter(c => c.kind === 'circle' && Math.hypot(c.x - boat.root.position.x, c.z - boat.root.position.z) < 2.2);
    assert(hull.length >= 2, 'swimmer collision follows the moving hull');
    // Full reverse toward the shore stops before land.
    for (let i = 0; i < 1200; i++) vessel.update(1 / 60, { throttle: -1, steer: 0, fast: false });
    assert(vessel.canFloatAt(boat.root.position.x, boat.root.position.z, boat.root.rotation.y));
    const ladder = boat.ladderPoint(new Vector3());
    assert(Math.hypot(ladder.x - boat.root.position.x, ladder.z - boat.root.position.z) < 2, 'ladder rides with the boat');
    vessel.reset(); assert(vessel.nearDock() && Math.abs(boat.root.position.x - DIVE_BOAT.x) < 1e-9);
  } finally { gym.dispose(); }
});


test('denser seeded kelp stays grounded, batched and inside the reef ceiling across sample seeds',()=>{
  for(const seed of [6256,1,42,12345]){
    const reef=createGymReef({center:new Vector3(92.71,0,41.95),floorAt:()=>-4,surfaceY:1,seed});
    try{
      const batches=reef.root.children.filter(o=>o.name.startsWith('gym-reef-kelp-')) as InstancedMesh[];
      assert.equal(batches.length,3);assert.equal(batches.reduce((n,b)=>n+b.count,0),24);
      assert(reef.stats().triangles<=GYM_REEF.budget.triangles,`seed ${seed} fits reef budget`);
      const matrix=new Matrix4(),versions=batches.map(b=>b.instanceMatrix.version);
      for(const batch of batches)for(let i=0;i<batch.count;i++){
        batch.getMatrixAt(i,matrix);assert.equal(matrix.elements[13],-4,'holdfast sits on seabed');
        assert(Math.abs(matrix.determinant()-1)<1e-6,'metre geometry remains unscaled');
      }
      reef.update(.1);assert.deepEqual(batches.map(b=>b.instanceMatrix.version),versions,'surge does not upload instance matrices');
    }finally{reef.dispose();}
  }
});
