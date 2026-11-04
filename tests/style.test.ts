import assert from 'node:assert/strict';
import test from 'node:test';
import { DataUtils, Mesh, MeshStandardMaterial, MeshToonMaterial } from 'three';
import { STYLE, createToonMaterial, exportableClone, toonRamp } from '../src/models/shared/style';
import { propCollection } from '../src/models/props/catalogue';

test('Toon ramps are shared, generated once and step from shadow to light at the terminator', () => {
  assert.equal(toonRamp('matte'), toonRamp('matte'));
  const values = Array.from(toonRamp('matte').image.data as Uint16Array, DataUtils.fromHalfFloat);
  const at = (dotNL: number) => values[Math.min(values.length - 1, Math.floor((dotNL + 1) / 2 * values.length))];
  assert.ok(at(-.5) <= STYLE.ramp.shadow + .01 && at(STYLE.ramp.terminator - .15) <= STYLE.ramp.shadow + .01, 'core shadow is one flat band, tinted by the sky fill');
  assert.ok(at(.3) > .95, 'lit side is one flat band');
  const metal = Array.from(toonRamp('metal').image.data as Uint16Array, DataUtils.fromHalfFloat);
  assert.ok(Math.max(...metal) > 1.2, 'metal carries a painted glint band');
});

test('Toon materials share ramps; GLB export swaps to standard materials without touching the live model', () => {
  const a = createToonMaterial(), b = createToonMaterial({ vertexColors: true });
  assert.equal(a.gradientMap, b.gradientMap);
  const prop = propCollection[0].create(), { clone, dispose } = exportableClone(prop);
  clone.traverse(o => { if (o instanceof Mesh) assert.ok(o.material instanceof MeshStandardMaterial); });
  prop.traverse(o => { if (o instanceof Mesh) assert.ok(o.material instanceof MeshToonMaterial); });
  dispose(); a.dispose(); b.dispose();
});
