import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5191/';
const address = new URL(base), folder = 'artifacts/gray-whale';
const sources = ['src/viewer/testingGym/whalePod.ts', 'src/viewer/testingGym.ts', 'src/viewer/avatarWorkbench.ts', 'tests/gym-whale-pod-browser.mjs'];
async function sourceHash() { const digest = createHash('sha256'); for (const path of sources) digest.update(path).update(await readFile(path)); return digest.digest('hex'); }
const before = await sourceHash();
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });
const evidence = [], absentEvidence = [], errors = [];
try {
  for (const backend of ['webgpu', 'webgl']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('https://api.weather.gov/**', route => route.abort());
    await page.routeWebSocket(u => u.hostname === address.hostname && u.port === address.port && u.searchParams.has('token'), socket => socket.send(JSON.stringify({ type: 'connected' })));
    page.on('pageerror', error => errors.push(`${backend}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error' && /shader|wgsl|glsl|pipeline|validation/i.test(message.text())) errors.push(`${backend}: ${message.text()}`); });
    await page.goto(`${base}?tab=gym&whales=show${backend === 'webgl' ? '&webgl' : ''}`);
    await page.waitForFunction(async () => {
      const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      return !!viewer.avatarWorkbench?.getSnapshot().gymReady;
    }, undefined, { timeout: 45000 });
    await page.locator('#gym-menu > summary').click();
    await page.locator('.gym-weather > summary').click();
    await page.selectOption('#gym-weather-mode', 'clear');
    await page.selectOption('#gym-weather-clock', 'preview');
    await page.locator('#gym-weather-date').fill('2026-10-23T13:00');
    await page.locator('#gym-weather-date').dispatchEvent('change');
    await page.locator('#gym-whale-view').click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${folder}/gym-pod-${backend}-surface.png` });
    await page.evaluate(async () => {
      const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      for (let i = 0; i < 170; i++) viewer.avatarWorkbench.gym.whalePod.update(.1);
    });
    await page.screenshot({ path: `${folder}/gym-pod-${backend}-tail-dive.png` });
    const result = await page.evaluate(async () => {
      const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      const workbench = viewer.avatarWorkbench, pod = workbench.gym.whalePod;
      const { modelStats } = await import('/src/viewer/modelStats.ts');
      const { coastalDistance } = await import('/src/viewer/testingGym/coastalLife.ts');
      const costs = workbench.lod.stats(pod.root), initial = pod.members.map(m => ({ role: m.role, length: m.model.root.userData.lengthMeters, position: m.model.root.position.toArray() }));
      const models = pod.members.map(m => workbench.lod.stats(m.model.root));
      const levels = [];
      for (const level of ['near', 'mid', 'far']) {
        workbench.lod.setMode(level); workbench.lod.update(workbench.camera, 900, .2, true);
        levels.push({ level, actual: modelStats(pod.root).model });
      }
      workbench.lod.setMode('auto'); workbench.lod.update(workbench.camera, 900, .2, true);
      const renderer = workbench.renderer, scene = pod.root.parent, reset = renderer.info.autoReset;
      renderer.info.autoReset = false;
      renderer.info.reset(); renderer.render(scene, workbench.camera);
      const withPod = { ...renderer.info.render };
      pod.root.visible = false;
      renderer.info.reset(); renderer.render(scene, workbench.camera);
      const withoutPod = { ...renderer.info.render };
      pod.root.visible = true; renderer.info.autoReset = reset;
      const submitted = { drawCalls: withPod.drawCalls - withoutPod.drawCalls, triangles: withPod.triangles - withoutPod.triangles };
      let spout = false, breach = false, tailDive = false, breachStarts = 0, wasBreaching = false, minShore = Infinity, maxGroupSpacing = 0;
      for (let i = 0; i < 250; i++) {
        pod.update(.1);
        spout ||= pod.members.some(m => m.spouting && m.spray.visible);
        const nowBreaching = pod.members.some(m => m.breaching && m.splash.visible && m.model.root.position.y > 2);
        if (nowBreaching && !wasBreaching) breachStarts++;
        wasBreaching = nowBreaching;
        breach ||= nowBreaching;
        for (const member of pod.members) {
          const position = member.model.root.position;
          minShore = Math.min(minShore, coastalDistance(position.x, position.z));
          if (member.tailRaised && member.role !== 'calf') {
            member.model.root.updateMatrixWorld(true);
            const tip = member.model.root.localToWorld(position.clone().set(member.length * .48, .014 * member.length, 0));
            tailDive ||= tip.y > 1.6 && position.y < .8;
          }
        }
        maxGroupSpacing = Math.max(maxGroupSpacing, pod.members[0].model.root.position.distanceTo(pod.members[2].model.root.position));
      }
      return { backend: workbench.getSnapshot().backend, active: pod.active, costs, models, levels, submitted, initial, spout, breach, tailDive, breachStarts, minShore, maxGroupSpacing, current: pod.stats() };
    });
    assert.equal(result.backend, backend === 'webgl' ? 'WebGL 2' : 'WebGPU');
    assert(result.current.sighting && result.active && result.spout && result.breach && result.tailDive, `${backend}: surface events`);
    assert(result.minShore > 100 && result.maxGroupSpacing < 18 && result.breachStarts === 1, `${backend}: offshore compact group and rare breach`);
    assert.deepEqual(result.initial.map(m => m.length), [12.5, 5.7, 11.8]);
    assert.deepEqual(['near', 'mid', 'far'].map(level => result.models.reduce((sum, model) => sum + model[level].triangles, 0)), [4560, 2260, 906]);
    assert(result.levels.every(l => l.actual.drawCalls >= 7 && l.actual.drawCalls <= 13 && l.actual.triangles <= 5200));
    assert(result.submitted.drawCalls >= 1 && result.submitted.drawCalls <= 13 && result.submitted.triangles <= 5200, `${backend}: actual pod submission ${JSON.stringify(result.submitted)}`);
    await page.screenshot({ path: `${folder}/gym-pod-${backend}-breach.png` });
    evidence.push(result);
    await page.close();

    const emptyPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await emptyPage.route('https://api.weather.gov/**', route => route.abort());
    await emptyPage.routeWebSocket(u => u.hostname === address.hostname && u.port === address.port && u.searchParams.has('token'), socket => socket.send(JSON.stringify({ type: 'connected' })));
    emptyPage.on('pageerror', error => errors.push(`${backend} absent: ${error.message}`));
    await emptyPage.goto(`${base}?tab=gym&whales=hide${backend === 'webgl' ? '&webgl' : ''}`);
    await emptyPage.waitForFunction(async () => {
      const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      return !!viewer.avatarWorkbench?.getSnapshot().gymReady;
    }, undefined, { timeout: 45000 });
    await emptyPage.locator('#gym-menu > summary').click();
    await emptyPage.locator('.gym-weather > summary').click();
    await emptyPage.selectOption('#gym-weather-mode', 'clear');
    await emptyPage.selectOption('#gym-weather-clock', 'preview');
    await emptyPage.locator('#gym-weather-date').fill('2026-10-23T13:00');
    await emptyPage.locator('#gym-weather-date').dispatchEvent('change');
    await emptyPage.locator('#gym-whale-view').click();
    const absent = await emptyPage.evaluate(async () => {
      const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      const pod = viewer.avatarWorkbench.gym.whalePod;
      const { modelStats } = await import('/src/viewer/modelStats.ts');
      return { stats: pod.stats(), children: pod.root.children.length, cost: modelStats(pod.root).model, message: document.querySelector('#gym-message').textContent };
    });
    assert(!absent.stats.sighting && !absent.stats.active && absent.children === 0 && absent.cost.drawCalls === 0 && absent.cost.triangles === 0, `${backend}: absent pod has no models or render cost`);
    assert.match(absent.message, /No gray whales are visible/);
    await emptyPage.screenshot({ path: `${folder}/gym-pod-${backend}-absent.png` });
    absentEvidence.push(absent);
    await emptyPage.close();
  }
  assert.deepEqual(errors, []);
  assert.equal(await sourceHash(), before, 'Gym source changed during the browser capture');
  await writeFile(`${folder}/gym-pod-browser.json`, JSON.stringify({ sourceHash: before, evidence, absentEvidence, errors }, null, 2) + '\n');
  console.log(JSON.stringify({ backends: evidence.map(e => e.backend), sightingChance: .2, absentDraws: absentEvidence.map(e => e.cost.drawCalls), levels: evidence[0].levels, submitted: evidence.map(e => e.submitted), tailDive: true, breach: true }));
} finally { await browser.close(); }
