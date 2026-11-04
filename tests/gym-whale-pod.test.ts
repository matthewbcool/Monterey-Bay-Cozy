import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Mesh, PerspectiveCamera, Vector3 } from 'three';
import { createGymWhalePod, createGymWhaleSighting, GYM_WHALE_POD } from '../src/viewer/testingGym/whalePod';
import { coastalDistance, coastalIsWater } from '../src/viewer/testingGym/coastalLife';
import { modelStats } from '../src/viewer/modelStats';
import { createLodController } from '../src/models/shared/lod/controller';
import { applyNodeStyle } from '../src/viewer/nodeStyle';

test('one-in-five sighting roll is stable and skips every whale resource when absent', () => {
  assert.equal(GYM_WHALE_POD.sightingChance, .2);
  for (const roll of [.2, .5, .999]) {
    const absent = createGymWhaleSighting(1, roll);
    try {
      assert.equal(absent.stats().sighting, false);
      assert.equal(absent.members.length, 0);
      assert.equal(absent.root.children.length, 0);
      assert.deepEqual(modelStats(absent.root).model, { drawCalls: 0, triangles: 0 });
      absent.setViewer(220, 20, true); absent.update(100);
      assert(!absent.active && !absent.root.visible && absent.stats().elapsed === 0);
    } finally { absent.dispose(); absent.dispose(); }
  }
  for (const roll of [0, .199999]) {
    const present = createGymWhaleSighting(1, roll);
    try {
      assert.equal(present.stats().sighting, true);
      assert.equal(present.members.length, 3);
      assert(modelStats(present.root).model.drawCalls >= 7);
    } finally { present.dispose(); }
  }
  assert.throws(() => createGymWhaleSighting(1, 1), RangeError);
});

test('gray-whale mother, calf and adult surface offshore with bounded effects', () => {
  const pod = createGymWhalePod(1);
  try {
    assert.deepEqual(pod.members.map(m => m.role), ['mother', 'calf', 'adult']);
    assert.deepEqual(pod.members.map(m => m.model.root.userData.lengthMeters), [12.5, 5.7, 11.8]);
    assert(pod.members.every(m => m.model.root.scale.equals(new Vector3(1, 1, 1))));
    pod.members.forEach(m => { m.spray.visible = true; m.splash.visible = true; });
    const worst = modelStats(pod.root).model;
    assert.equal(worst.drawCalls, GYM_WHALE_POD.budget.drawCalls);
    assert(worst.triangles <= GYM_WHALE_POD.budget.triangles, `all effects: ${worst.triangles}`);
    let sawSpray = false, sawBreach = false, sawDive = false, wasBreaching = false, breachStarts = 0;
    for (let i = 0; i < 1800; i++) {
      pod.update(.1);
      if (i % 30 === 0) {
        for (const member of pod.members) {
          const p = member.model.root.position;
          assert(coastalIsWater(p.x, p.z), `${member.role} stays in water`);
          assert(coastalDistance(p.x, p.z) > 100, `${member.role} stays well offshore`);
          assert(p.y > -1 && p.y < 6, `${member.role} travels near the surface`);
        }
        const [mother, calf, adult] = pod.members;
        assert(mother.model.root.position.distanceTo(calf.model.root.position) < 9, 'calf keeps close to mother');
        const adultSpacing = mother.model.root.position.distanceTo(adult.model.root.position);
        assert(adultSpacing > 12 && adultSpacing < 18, `second adult stays close without overlapping: ${adultSpacing}`);
        const cost = modelStats(pod.root).model;
        assert(cost.drawCalls <= GYM_WHALE_POD.budget.drawCalls, `pod draws ${cost.drawCalls}`);
        assert(cost.triangles <= GYM_WHALE_POD.budget.triangles, `pod triangles ${cost.triangles}`);
      }
      sawSpray ||= pod.members.some(m => m.spouting && m.spray.visible);
      const breaching = pod.members.some(m => m.breaching && m.splash.visible && m.model.root.position.y > 2);
      if (breaching && !wasBreaching) breachStarts++;
      wasBreaching = breaching;
      sawBreach ||= breaching;
      for (const member of pod.members) if (member.diving && member.tailRaised && member.role !== 'calf') {
        member.model.root.updateMatrixWorld(true);
        const tip = member.model.root.localToWorld(new Vector3(member.length * .48, .014 * member.length, 0));
        sawDive ||= tip.y > 1.6 && member.model.root.position.y < .8;
      }
    }
    assert(sawSpray, 'blowhole spray appears'); assert(sawBreach, 'an adult occasionally breaches');
    assert(sawDive, 'a tail rises above the surface as its whale dives');
    assert(breachStarts <= 2, `breaches stay rare over three minutes: ${breachStarts}`);
    const before = pod.members.map(m => m.model.root.position.clone()); pod.update(.1, false);
    assert(pod.members.every((m, i) => m.model.root.position.equals(before[i])), 'reduced motion freezes the pod');
    pod.setViewer(900, 700); assert(!pod.active && !pod.root.visible);
    pod.update(.1); assert(pod.stats().elapsed > 180, 'visibility does not change the simulation clock');
    pod.setViewer(25, -35); assert(pod.active && pod.root.visible, 'pod visible from the park');
    const physicsWhale = pod.members[2];
    physicsWhale.model.setMotionOwner('physics'); physicsWhale.model.root.position.set(140, .4, 40);
    pod.update(.1);
    assert.deepEqual(physicsWhale.model.root.position.toArray(), [140, .4, 40], 'physics-owned root is not overwritten by the route');
    assert(!physicsWhale.spouting && !physicsWhale.breaching && !physicsWhale.diving && !physicsWhale.tailRaised && !physicsWhale.spray.visible && !physicsWhale.splash.visible);
  } finally { pod.dispose(); pod.dispose(); }
});

test('gray-whale pod participates in shared Near/Mid/Far LOD without moving its roots', async () => {
  const pod = createGymWhalePod(1), lod = createLodController();
  let effectReleases = 0;
  try {
    applyNodeStyle(pod.root);
    const effects = [pod.root.getObjectByName('Whale surface wakes · one batch') as Mesh, pod.members[0].spray, pod.members[0].splash];
    effects.forEach(effect => { for (const material of Array.isArray(effect.material) ? effect.material : [effect.material]) material.addEventListener('dispose', () => { effectReleases++; }); });
    await lod.register(pod.root);
    const costs = lod.stats(pod.root);
    assert(costs.near.triangles > costs.mid.triangles && costs.mid.triangles > costs.far.triangles);
    assert(costs.near.triangles <= GYM_WHALE_POD.budget.triangles);
    const positions = pod.members.map(m => m.model.root.position.clone());
    const camera = new PerspectiveCamera(49, 1, .25, 3500); camera.position.set(91, 25, -73);
    for (const level of ['near', 'mid', 'far'] as const) {
      lod.setMode(level); lod.update(camera, 900, .2, true);
      assert(pod.members.every((m, i) => m.model.root.position.equals(positions[i])));
      assert(pod.members.every(m => m.model.root.getObjectByName('gray-whale:body-flippers-and-flukes') instanceof Mesh));
    }
  } finally { lod.dispose(); pod.dispose(); }
  assert.equal(effectReleases, 3, 'all three converted effect materials release once');
});
