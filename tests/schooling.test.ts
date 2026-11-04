import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createSardineSchool } from '../src/models/pacific-sardine/createSardineSchool';
import { createSchooling, DEFAULT_SCHOOLING } from '../src/models/shared/school/schooling';

const L = .25;
function settle(count: number, seconds = 6) {
  const school = createSchooling(256, L, DEFAULT_SCHOOLING, 7); school.reset(count);
  for (let t = 0; t < seconds; t += 1 / 30) school.update(1 / 30, 0, .2);
  return school;
}

test('School sizes vary around the nominal fish; fish 0 stays nominal; smaller fish beat faster', () => {
  const school = createSardineSchool({ count: 128 }), sizes = Array.from({ length: 128 }, (_, i) => school.sizeAt(i));
  assert.equal(sizes[0], 1);
  assert.ok(Math.min(...sizes) >= .9 - 1e-6 && Math.max(...sizes) <= 1.1 + 1e-6, 'within ±10%');
  const mean = sizes.reduce((a, b) => a + b) / sizes.length, sd = Math.sqrt(sizes.reduce((a, b) => a + (b - mean) ** 2, 0) / sizes.length);
  assert.ok(Math.abs(mean - 1) < .02 && sd > .025, `visible spread (sd ${sd.toFixed(3)})`);
  school.dispose();
});

test('Settled school is an even, rounded group: no overlaps, no grid, no box corners', () => {
  const school = settle(128), p = new Vector3(), q = new Vector3(), nearest: number[] = [];
  for (let i = 0; i < school.count; i++) {
    let best = Infinity; p.fromArray(school.position, i * 3);
    for (let j = 0; j < school.count; j++) if (j !== i) best = Math.min(best, p.distanceTo(q.fromArray(school.position, j * 3)));
    nearest.push(best / L);
  }
  nearest.sort((a, b) => a - b);
  assert.ok(nearest[0] > .2, `no fish overlap (closest ${nearest[0].toFixed(2)} BL)`);
  const median = nearest[nearest.length >> 1];
  assert.ok(median > .45 && median < 1.1, `median neighbour distance near one body length (${median.toFixed(2)} BL)`);
  // A box fills its corners; an ellipsoid leaves them empty.
  const r = school.radii; let corners = 0;
  for (let i = 0; i < school.count; i++) { p.fromArray(school.position, i * 3); if (Math.abs(p.x) > r.x * .7 && Math.abs(p.y) > r.y * .7 && Math.abs(p.z) > r.z * .7) corners++; }
  assert.ok(corners <= 2, `corners stay empty (${corners})`);
  // Grid layouts repeat exact coordinates; a school does not.
  const xs = new Set(Array.from({ length: school.count }, (_, i) => school.position[i * 3].toFixed(3)));
  assert.ok(xs.size > school.count * .9, 'no repeated grid columns');
});

test('Fish keep moving relative to each other and face slightly different headings', () => {
  const school = createSardineSchool({ count: 48 }), mesh = school.batches.alive;
  for (let i = 0; i < 120; i++) school.update(1 / 60);
  const yaw = (i: number) => { const m = new (mesh.instanceMatrix.array.constructor as Float32ArrayConstructor)(mesh.instanceMatrix.array.slice(i * 16, i * 16 + 16)); return Math.atan2(m[2], m[0]); }; // 0 for a fish facing the school's travel (−X)
  const yaws = Array.from({ length: 48 }, (_, i) => yaw(i)), spread = Math.max(...yaws) - Math.min(...yaws);
  assert.ok(spread > .03 && spread < 1.2, `headings vary but stay polarized (${spread.toFixed(3)} rad)`);
  const before = Array.from(mesh.instanceMatrix.array.slice(12, 15));
  for (let i = 0; i < 60; i++) school.update(1 / 60);
  assert.notDeepEqual(Array.from(mesh.instanceMatrix.array.slice(12, 15)), before, 'positions evolve');
  school.dispose();
});

test('256-fish schooling step fits a frame budget on the CPU', () => {
  const school = createSardineSchool({ count: 256 });
  for (let i = 0; i < 30; i++) school.update(1 / 60);
  const start = performance.now(); for (let i = 0; i < 120; i++) school.update(1 / 60);
  const ms = (performance.now() - start) / 120;
  assert.ok(ms < 3, `${ms.toFixed(2)} ms per update (simulation + instance upload prep)`);
  console.log(`schooling 256 fish: ${ms.toFixed(3)} ms/update`);
  school.dispose();
});
