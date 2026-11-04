import assert from 'node:assert/strict';
import test from 'node:test';
import { Mesh, MeshToonMaterial } from 'three';
import { NodeMaterial } from 'three/webgpu';
import { lowerTier, pickTier, shouldStepDown, TIER_SETTINGS } from '../src/viewer/quality';
import { applyNodeStyle } from '../src/viewer/nodeStyle';
import { createTunaModel } from '../src/models/tuna/createTunaModel';
import { createKelpGreenlingModel } from '../src/models/kelp-greenling/createKelpGreenlingModel';

test('Only Base and Standard remain; palette-independent settings have no ink or bloom fields', () => {
  assert.deepEqual(Object.keys(TIER_SETTINGS), ['base', 'standard']);
  assert.equal(TIER_SETTINGS.base.rim, false); assert.equal(TIER_SETTINGS.standard.rim, true);
  for (const settings of Object.values(TIER_SETTINGS)) {
    assert.equal('outlines' in settings, false); assert.equal('bloom' in settings, false);
  }
});
test('Device defaults and old quality URLs fall back safely', () => {
  assert.equal(pickTier({requested:'base'}).tier,'base');
  assert.equal(pickTier({requested:'standard',coarsePointer:true}).tier,'standard');
  assert.equal(pickTier({requested:'high'}).tier,'standard');
  assert.equal(pickTier({coarsePointer:true}).tier,'base');
  assert.equal(pickTier({deviceMemory:4}).tier,'base');
  assert.equal(pickTier({}).tier,'standard');
});
test('The frame probe steps down once, never for vsync-bound frames', () => {
  assert.equal(shouldStepDown('standard',Array(120).fill(16.7)),false);
  assert.equal(shouldStepDown('standard',Array(30).fill(40)),false);
  assert.equal(shouldStepDown('standard',Array(120).fill(28)),true);
  assert.equal(shouldStepDown('base',Array(120).fill(60)),false);
  assert.equal(lowerTier('standard'),'base');
});

test('Node style keeps shared materials shared and adds the rim to the tuna body only', () => {
  const tuna = createTunaModel(), greenling = createKelpGreenlingModel();
  applyNodeStyle(tuna.root); applyNodeStyle(greenling.root);
  tuna.root.traverse(o => { if (o instanceof Mesh) { assert.ok(o.material instanceof NodeMaterial); assert.equal(o.material.userData.rimApplied === true, o.material.userData.rim === true); } });
  const materials = new Set<unknown>(); greenling.root.traverse(o => { if (o instanceof Mesh) { assert.ok(!(o.material instanceof MeshToonMaterial)); materials.add(o.material); } });
  assert.equal(materials.size, 1, 'body and eyes still share one material');
  for (const material of materials as Set<NodeMaterial>) {
    assert.equal(material.vertexColors, false, 'paint is sampled once by colorNode');
    assert.ok(material.colorNode && material.userData.paintedFish);
  }
  let disposed = 0; greenling.root.traverse(o => { if (o instanceof Mesh) (o.material as NodeMaterial).userData.nodeSource.addEventListener('dispose', () => disposed++); });
  greenling.dispose(); assert.ok(disposed >= 1, 'disposing the node twin releases the source toon material');
  tuna.dispose();
});
