import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, MeshToonMaterial } from 'three';
import { createGiantKelp } from '../src/models/habitat/giantKelp';
import { PROP_BUDGETS } from '../src/models/props/dimensions';
import { disposeObject } from '../src/models/props/primitives';

const measure = (root: ReturnType<typeof createGiantKelp>) => { let draws = 0, triangles = 0; root.traverse(o => { if (o instanceof Mesh) { draws++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; } }); return { draws, triangles }; };

test('Kelp is procedural: unseeded calls differ, seeded calls reproduce, and the seed is recorded', () => {
  const a = createGiantKelp(), b = createGiantKelp(), c = createGiantKelp({ seed: a.userData.seed });
  const vertices = (r: typeof a) => Array.from(((r.children[0] as Mesh).geometry.attributes.position.array as Float32Array).slice(0, 300));
  assert.notEqual(a.userData.seed, b.userData.seed);
  assert.notDeepEqual(vertices(a), vertices(b), 'two random plants are different shapes');
  assert.deepEqual(vertices(a), vertices(c), 'same seed rebuilds the same plant');
  [a, b, c].forEach(disposeObject);
});

test('Every seed stays inside the kelp budget, keeps metre scale and reaches the surface', () => {
  const budget = PROP_BUDGETS['giant-kelp'], fronds = new Set<number>();
  let worst = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const plant = createGiantKelp({ seed }), { draws, triangles } = measure(plant), box = new Box3().setFromObject(plant);
    worst = Math.max(worst, triangles); fronds.add(plant.userData.fronds);
    assert.equal(draws, 1); assert.ok(triangles <= budget.triangles, `seed ${seed}: ${triangles} triangles`);
    assert.ok(box.max.y > 5.85 && box.max.y < 6.15, `seed ${seed}: canopy floats at the 6 m surface (top ${box.max.y.toFixed(2)} m)`);
    assert.ok(box.min.y > -.12, `seed ${seed}: holdfast stays on the rock (${box.min.y.toFixed(2)} m)`);
    plant.traverse(o => { if (o instanceof Mesh) assert.ok(o.material instanceof MeshToonMaterial); });
    disposeObject(plant);
  }
  assert.ok(fronds.size >= 2, 'frond count varies between plants');
  console.log(`giant kelp worst case over 60 seeds: ${worst} triangles`);
});
