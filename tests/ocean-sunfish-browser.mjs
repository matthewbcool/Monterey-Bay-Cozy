import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const url = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5191/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [], errors = [], backends = [];
const assert = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); console.log('PASS', label); };
function watch(page) { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); }
await fs.mkdir('artifacts/ocean-sunfish', { recursive: true });
try {
  for (const backend of ['classic', 'webgpu', 'webgl']) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } }); watch(page);
    await page.goto(url + `tests/fish-review.html?species=ocean-sunfish&${backend}`);
    const info = await page.evaluate(async () => (await window.fishBackendCheck).result); backends.push(info);
    assert(info.backend === (backend === 'classic' ? 'WebGLRenderer' : backend === 'webgpu' ? 'WebGPUBackend' : 'WebGLBackend'), `${backend}: requested backend renders sunfish`);
    for (const mode of ['slow', 'fast', 'caught']) {
      await page.evaluate(async mode => (await window.fishBackendCheck).pose(mode), mode);
      const stats = await page.evaluate(async () => { const r = (await window.fishBackendCheck).renderer; return { calls: r.isWebGPURenderer ? r.info.render.drawCalls : r.info.render.calls, triangles: r.info.render.triangles }; });
      const overhead = backend === 'classic' ? 0 : 1;
      assert(stats.calls === 2 + overhead && stats.triangles === (mode === 'caught' ? 1480 : 1668) + overhead, `${backend}: ${mode} stays at two fish draws`);
      await page.screenshot({ path: `artifacts/ocean-sunfish/${backend}-${mode}-side.png` });
    }
    for (const angle of ['oblique', 'underside', 'far']) {
      await page.evaluate(async angle => (await window.fishBackendCheck).pose(angle === 'far' ? 'caught' : 'fast', angle), angle);
      await page.screenshot({ path: `artifacts/ocean-sunfish/${backend}-${angle}.png` });
    }
    await page.evaluate(async () => (await window.fishBackendCheck).pose('slow'));
    const before = await page.screenshot();
    await page.evaluate(async () => { const r = await window.fishBackendCheck; for (let i = 0; i < 8; i++) r.fish[0].update(.1); await r.render(); });
    assert(!before.equals(await page.screenshot()), `${backend}: fins visibly animate on GPU`);
    await page.evaluate(async () => (await window.fishBackendCheck).dispose()); await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); watch(page);
  await page.goto(url, { waitUntil: 'networkidle' });
  const get = () => page.evaluate(async () => {
    const { viewer: v } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src); const f = v.fish;
    return { id: v.state.creatureId, paused: v.state.paused, fish: f.getState(), position: f.root.position.toArray(), scale: f.root.scale.toArray(), dorsal: f.root.getObjectByName('dorsal')?.rotation.x, anal: f.root.getObjectByName('anal')?.rotation.x };
  });
  await get(); await page.selectOption('#creature-select', 'ocean-sunfish');
  assert((await get()).id === 'ocean-sunfish', 'Sunfish available in collection selector');
  await page.getByRole('button', { name: 'Follow fish', exact: true }).click();
  assert((await get()).scale.every(n => n === 1), 'Follow camera preserves real metre scale');
  assert(await page.locator('#school-count').isHidden(), 'Sardine-only school control stays hidden');
  const start = await get(); await page.waitForTimeout(700); const moving = await get();
  assert(JSON.stringify(start.position) !== JSON.stringify(moving.position) && start.dorsal !== moving.dorsal, 'Sunfish travels with animated fins');
  assert(Math.abs(moving.dorsal + moving.anal) < 1e-8, 'Upper and lower fin hinges are synchronized');
  await page.getByRole('button', { name: 'Fast swim', exact: false }).click(); await page.waitForTimeout(1500);
  assert((await get()).fish.blend > .99 && (await get()).fish.finExtension === 1, 'Fast swim increases strokes without retracting fins');
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click(); const paused = await get(); await page.waitForTimeout(200);
  assert(JSON.stringify(paused) === JSON.stringify(await get()), 'Pause freezes fins and travel');
  await page.screenshot({ path: 'artifacts/ocean-sunfish/tank.png' });
  await page.selectOption('#life-state', 'caught'); await page.getByRole('button', { name: 'Play animation', exact: true }).click();
  const dead = await get(); await page.waitForTimeout(300);
  assert(JSON.stringify(dead) === JSON.stringify(await get()), 'Caught pose remains stationary with X eyes');
  assert(await page.getByRole('button', { name: 'Fast swim', exact: false }).isDisabled(), 'Caught state disables swimming controls');
  await page.selectOption('#creature-select', 'tuna'); await page.selectOption('#creature-select', 'ocean-sunfish');
  assert((await get()).fish.lifeState === 'caught', 'Caught state survives species switching');
  await page.selectOption('#life-state', 'alive'); await page.waitForTimeout(200); assert((await get()).fish.phase !== dead.fish.phase, 'Swimming resumes');
  await page.close();
  for (const width of [320, 390]) {
    const mobile = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }); watch(mobile);
    await mobile.goto(url, { waitUntil: 'networkidle' });
    // Warm the diagnostic import before interacting; Vite may use a query-qualified entry URL.
    await mobile.evaluate(async () => { await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src); });
    await mobile.selectOption('#creature-select', 'ocean-sunfish'); await mobile.getByRole('button', { name: 'Follow fish', exact: true }).tap();
    assert(await mobile.getByRole('button', { name: 'Play animation', exact: true }).isVisible(), `${width}px: reduced motion starts paused`);
    const layout = await mobile.evaluate(async () => {
      const { viewer: v } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      const a = document.querySelector('.creature-control').getBoundingClientRect(), b = document.querySelector('.camera-controls').getBoundingClientRect();
      let framed = true, low = 1, high = -1; const point = v.fish.root.position.clone(); v.fish.root.updateMatrixWorld(true); v.camera.updateMatrixWorld(true);
      v.fish.root.traverseVisible(o => {
        if (!o.isMesh) return; if (o.isSkinnedMesh) o.skeleton.update();
        for (let i = 0; i < o.geometry.attributes.position.count; i++) {
          o.getVertexPosition(i, point).applyMatrix4(o.matrixWorld).project(v.camera);
          if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1) framed = false; low = Math.min(low, point.y); high = Math.max(high, point.y);
        }
      });
      return { framed, heightFraction: (high - low) / 2, layout: document.documentElement.scrollWidth <= innerWidth && (a.left<=b.left&&a.top<=b.top&&b.right<=a.right&&b.bottom<=a.bottom) };
    });
    assert(layout.layout, `${width}px: camera buttons fit inside the creature panel`);
    assert(layout.framed && layout.heightFraction > .30, `${width}px: tall fins fit and remain readable`);
    await mobile.selectOption('#life-state', 'caught'); await mobile.screenshot({ path: `artifacts/ocean-sunfish/mobile-${width}.png` }); await mobile.close();
  }
  assert(errors.length === 0, 'No browser or shader errors');
  await fs.writeFile('artifacts/ocean-sunfish/browser-qa.json', JSON.stringify({ date: new Date().toISOString(), checks, errors, backends }, null, 2) + '\n');
} finally { await browser.close(); }
