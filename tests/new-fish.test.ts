import { createGiantSeaBassModel } from '../src/models/giant-sea-bass/createGiantSeaBassModel';
import { GIANT_SEA_BASS } from '../src/models/giant-sea-bass/definition';
import type { FishOptions } from '../src/models/shared/fish/design';
import { createGaribaldiModel } from '../src/models/garibaldi/createGaribaldiModel';
import { GARIBALDI } from '../src/models/garibaldi/definition';
import { createLingcodModel } from '../src/models/lingcod/createLingcodModel';
import { LINGCOD } from '../src/models/lingcod/definition';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bone, Box3, BufferAttribute, Mesh, MeshToonMaterial, SkinnedMesh, Vector3 } from 'three';
import { toonRamp } from '../src/models/shared/style';
import { createPacificSardineModel } from '../src/models/pacific-sardine/createPacificSardineModel';
import { createBlueRockfishModel } from '../src/models/blue-rockfish/createBlueRockfishModel';
import { SARDINE } from '../src/models/pacific-sardine/definition';
import { BLUE_ROCKFISH } from '../src/models/blue-rockfish/definition';
import { createSwimmer } from '../src/viewer/swimPath';

import { createCaliforniaSheepheadModel } from '../src/models/california-sheephead/createCaliforniaSheepheadModel';
import { SHEEPHEAD } from '../src/models/california-sheephead/definition';
import { createKelpGreenlingModel } from '../src/models/kelp-greenling/createKelpGreenlingModel';
import { KELP_GREENLING } from '../src/models/kelp-greenling/definition';

const cases = [{ create: (options:FishOptions={})=>createGiantSeaBassModel({...options,seed:42}), design: GIANT_SEA_BASS }, { create: createGaribaldiModel, design: GARIBALDI }, { create: createLingcodModel, design: LINGCOD }, { create: createPacificSardineModel, design: SARDINE }, { create: createBlueRockfishModel, design: BLUE_ROCKFISH }, { create: createCaliforniaSheepheadModel, design: SHEEPHEAD }, { create: createKelpGreenlingModel, design: KELP_GREENLING }];
for (const { create, design } of cases) {
  test(`${design.id}: metre scale, skin weights and both-state budgets`, () => {
    const fish = create(), large = create({ lengthMeters: design.lengthMeters * 2 });
    assert.equal(fish.root.userData.units, 'metres'); assert.ok(fish.root.scale.equals(new Vector3(1, 1, 1)));
    assert.ok(Math.abs(new Box3().setFromObject(fish.root, true).getSize(new Vector3()).x - design.lengthMeters) < 1e-5);
    assert.equal(large.physics.colliders[0].radius, fish.physics.colliders[0].radius * 2);
    assert.equal(large.physics.anchors.mouth[0], fish.physics.anchors.mouth[0] * 2);
    let materialCount = new Set();
    for (const state of ['alive', 'caught'] as const) {
      fish.setLifeState(state); let triangles = 0, calls = 0;
      fish.root.traverseVisible(o => {
        if (!(o instanceof Mesh)) return;
        triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; calls++;
        assert.ok(o.material instanceof MeshToonMaterial); materialCount.add(o.material);
        assert.equal(o.material.gradientMap, toonRamp('matte'), 'fish share the collection ramp');
        for (const attribute of Object.values(o.geometry.attributes) as BufferAttribute[]) for (const value of attribute.array) assert.ok(Number.isFinite(value));
        const w = o.geometry.attributes.skinWeight, indices = o.geometry.attributes.skinIndex;
        for (let i = 0; i < w.count; i++) {
          assert.ok(Math.abs(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i) - 1) < 1e-6);
          assert.ok(indices.getX(i) < 6 && indices.getY(i) < 6 && indices.getZ(i) < 6 && indices.getW(i) < 6);
        }
      });
      assert.ok(triangles <= design.budget.triangles); assert.equal(calls, 2);
      console.log(`${design.id} ${state}: ${triangles} triangles, ${calls} draws`);
    }
    assert.equal(materialCount.size, 1); fish.dispose(); large.dispose();
    assert.throws(() => create({ lengthMeters: 0 })); assert.throws(() => create({ lengthMeters: NaN }));
  });
  test(`${design.id}: animated bounds, static buffers, caught freeze and physics ownership`, () => {
    const fish = create(), skin = fish.parts.get('surface')!.children[0] as SkinnedMesh;
    const versions = (Object.values(skin.geometry.attributes) as BufferAttribute[]).map(a => a.version);
    const p = new Vector3();
    for (const mode of ['slow', 'fast'] as const) {
      fish.setSwimMode(mode, true);
      for (let t = 0; t < 16; t++) {
        fish.update(.075); fish.root.updateMatrixWorld(true); skin.skeleton.update();
        for (let i = 0; i < skin.geometry.attributes.position.count; i += 3) {
          skin.getVertexPosition(i, p);
          assert.ok(skin.boundingSphere!.containsPoint(p), 'Posed vertices stay in conservative culling bounds');
        }
      }
    }
    assert.deepEqual((Object.values(skin.geometry.attributes) as BufferAttribute[]).map(a => a.version), versions);
    assert.ok(Math.abs((fish.root.getObjectByName('tail') as Bone).rotation.y) > .001);
    fish.setLifeState('caught'); const snapshot = fish.getState(); fish.update(.1); assert.deepEqual(fish.getState(), snapshot);
    assert.ok(Math.abs(fish.root.getObjectByName('mid-body')!.rotation.y) === 0);
    assert.ok(Math.abs(fish.root.getObjectByName('tail')!.rotation.y) === 0);
    assert.equal(fish.parts.get('head-details')!.visible, false); assert.equal(fish.parts.get('caught-details')!.visible, true);
    fish.setMotionOwner('physics'); fish.root.position.set(3, 2, 1); fish.root.rotation.y = .4;
    const swimmer = createSwimmer(fish); fish.setLifeState('alive'); fish.update(.1); swimmer.update(.1, 1);
    assert.deepEqual(fish.root.position.toArray(), [3, 2, 1]); assert.equal(fish.root.rotation.y, .4);
    fish.dispose();
  });
  test(`${design.id}: independent animation and one-time resource disposal`, () => {
    const a = create(), b = create(), state = b.getState(), skin = a.parts.get('surface')!.children[0] as SkinnedMesh;
    let geometries = 0, materials = 0, skeletons = 0;
    a.root.traverse(o => { if (o instanceof Mesh) o.geometry.addEventListener('dispose', () => geometries++); });
    (skin.material as MeshToonMaterial).addEventListener('dispose', () => materials++);
    const dispose = skin.skeleton.dispose.bind(skin.skeleton); skin.skeleton.dispose = () => { skeletons++; dispose(); };
    for (let i = 0; i < 8; i++) { a.setLifeState('caught'); a.setLifeState('alive'); a.setSwimMode('fast'); a.update(.05); }
    assert.deepEqual(b.getState(), state);
    a.dispose(); a.dispose(); assert.equal(geometries, 3); assert.equal(materials, 1); assert.equal(skeletons, 1);
    b.update(.1); assert.ok(b.getState().phase > 0); b.dispose();
  });
  test(`${design.id}: fast-transition timing agrees across frame rates`, () => {
    const states = [30, 60, 120].map(fps => { const fish = create(); fish.setSwimMode('fast'); for (let i = 0; i < fps; i++) fish.update(1 / fps); const state = fish.getState(); fish.dispose(); return state; });
    for (const state of states) { assert.ok(Math.abs(state.phase - states[0].phase) < 1e-8); assert.ok(Math.abs(state.blend - states[0].blend) < 1e-8); }
  });
}
