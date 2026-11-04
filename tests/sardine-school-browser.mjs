import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const url = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5191/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [], errors = [], measurements = [];
const assert = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); console.log('PASS', label); };
function watch(page) { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); }
await fs.mkdir('artifacts/sardine-school', { recursive: true });
try {
  for (const backend of ['classic', 'webgpu', 'webgl']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); watch(page);
    await page.goto(url + 'tests/school-review.html' + (backend === 'webgpu' ? '' : `?${backend}`));
    const expected = backend === 'classic' ? 'WebGLRenderer' : backend === 'webgpu' ? 'WebGPUBackend' : 'WebGLBackend';
    assert((await page.evaluate(async () => (await window.schoolReview).stats())).backend === expected, `${backend}: requested renderer active`);
    // Return through a one-instance draw to exercise r180's different morph source.
    for (const count of [1, 16, 48, 128, 256, 1, 48]) {
      const result = await page.evaluate(async count => (await window.schoolReview).show(count, 'fast'), count); measurements.push(result);
      assert(result.calls === 1 && result.triangles === 1468 * count, `${backend}: ${count} animated fish use one draw`);
    }
    await page.screenshot({ path: `artifacts/sardine-school/${backend}-fast.png` });
    const before = await page.screenshot();
    await page.evaluate(async () => { const r = await window.schoolReview; for (let i = 0; i < 4; i++) r.school.update(.07); await r.render(); });
    assert(!before.equals(await page.screenshot()), `${backend}: GPU animation changes visible pixels`);
    const dead = await page.evaluate(async () => (await window.schoolReview).show(48, 'slow', 'caught'));
    assert(dead.calls === 1 && dead.triangles === 1280 * 48, `${backend}: X-eye school also uses one draw`);
    await page.screenshot({ path: `artifacts/sardine-school/${backend}-caught.png` });
    // Promoting one caught fish is the expensive/interactive boundary, not a clone per member.
    const caught = await page.evaluate(async () => {
      const r = await window.schoolReview; await r.show(48); const fish = r.school.takeFish(2); r.scene.add(fish.root); await r.render();
      const result = { remaining: r.school.count, state: fish.getState(), calls: r.stats().calls }; fish.dispose(); return result;
    });
    assert(caught.remaining === 47 && caught.state.lifeState === 'caught' && caught.calls === 3, `${backend}: one caught fish leaves batch and adds only its two draws`);
    const empty = await page.evaluate(async () => (await window.schoolReview).show(0)); assert(empty.calls === 0, `${backend}: empty school draws nothing`);
    // Warm CPU update measurement only. GPU time and target-device FPS are separate budgets.
    const timing = await page.evaluate(async () => {
      const r = await window.schoolReview; await r.show(256);
      for (let i = 0; i < 100; i++) r.school.update(1 / 60);
      const start = performance.now(); for (let i = 0; i < 1000; i++) r.school.update(1 / 60);
      return { ...r.stats(), cpuUpdateMs: (performance.now() - start) / 1000 };
    }); measurements.push(timing);
    await page.evaluate(async () => (await window.schoolReview).dispose()); await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); watch(page);
  await page.goto(url, { waitUntil: 'networkidle' });
  const get = () => page.evaluate(async () => { const { viewer: v } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src); return { count: v.fish.count, state: v.fish.getState(), position: v.fish.root.position.toArray(), paused: v.state.paused, distance: v.camera.position.distanceTo(v.controls.target) }; });
  await get();
  await page.selectOption('#creature-select', 'pacific-sardine'); await page.getByRole('button', { name: 'Follow fish', exact: true }).click();
  assert((await get()).count === 48, 'Viewer defaults to a 48-fish sardine school');
  await page.screenshot({ path: 'artifacts/sardine-school/tank-school.png' });
  const start = await get(); await page.waitForTimeout(500); const later = await get();
  assert(JSON.stringify(start.position) !== JSON.stringify(later.position) && start.state.phase !== later.state.phase, 'School travels and swims');
  await page.getByRole('button', { name: 'Fast swim', exact: false }).click(); await page.waitForTimeout(1450);
  assert((await get()).state.blend > .99, 'Fast mode blends the school animation');
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  const paused = await get(); await page.waitForTimeout(180);
  const afterPause = await get();
  // Orbit/follow camera damping may settle while animation is paused.
  assert(afterPause.paused && JSON.stringify(paused.state) === JSON.stringify(afterPause.state) && JSON.stringify(paused.position) === JSON.stringify(afterPause.position), 'Pause freezes school and path');
  await page.selectOption('#school-count', '256'); assert((await get()).count === 256 && (await get()).distance > paused.distance, 'Count updates in place and follow camera fits the larger school');
  await page.selectOption('#life-state', 'caught'); assert((await get()).state.lifeState === 'caught', 'State control previews X eyes');
  await page.selectOption('#school-count', '0'); assert((await get()).count === undefined && (await get()).state.lifeState === 'caught', 'Single-fish inspection preserves caught state');
  await page.selectOption('#life-state', 'alive'); await page.selectOption('#school-count', '48');
  await page.selectOption('#creature-select', 'blue-rockfish'); assert(await page.locator('#school-count').isHidden(), 'School control only appears for sardines');
  await page.selectOption('#creature-select', 'pacific-sardine'); assert((await get()).count === 48 && (await get()).paused, 'Species switching preserves school size and pause');
  await page.getByRole('tab', { name: 'Area & buildings', exact: true }).click();
  assert(await page.locator('.interface').isHidden(), 'School controls hide with the tank tab');
  await page.getByRole('tab', { name: 'Tank', exact: true }).click(); await page.close();
  for (const width of [320, 390, 600]) {
    const mobile = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }); watch(mobile);
    await mobile.goto(url, { waitUntil: 'networkidle' }); await mobile.selectOption('#creature-select', 'pacific-sardine');
    await mobile.getByRole('button', { name: 'Follow fish', exact: true }).tap();
    assert(await mobile.evaluate(() => {
      const a = document.querySelector('.creature-control').getBoundingClientRect(), b = document.querySelector('.camera-controls').getBoundingClientRect();
      return document.documentElement.scrollWidth <= innerWidth && (a.left<=b.left&&a.top<=b.top&&b.right<=a.right&&b.bottom<=a.bottom);
    }), `${width}px: school controls and camera buttons fit in the panel`);
    assert(await mobile.getByRole('button', { name: 'Play animation', exact: true }).isVisible(), `${width}px: reduced motion stays paused`);
    await mobile.screenshot({ path: `artifacts/sardine-school/mobile-${width}.png` }); await mobile.close();
  }
  assert(errors.length === 0, 'No browser or shader errors');
  await fs.writeFile('artifacts/sardine-school/browser-qa.json', JSON.stringify({ date: new Date().toISOString(), checks, errors, measurements }, null, 2) + '\n');
} finally { await browser.close(); }
