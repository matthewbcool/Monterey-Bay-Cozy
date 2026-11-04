import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const url = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5191/', out = 'artifacts/bat-star/';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true }), checks = [], errors = [], renders = [];
const assert = (ok, label) => { if (!ok) throw Error(label); checks.push(label); console.log('PASS', label); };
function watch(page) { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); }
try {
  for (const backend of ['classic', 'webgpu', 'webgl']) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } }); watch(page);
    await page.goto(url + `tests/bat-star-review.html?${backend}`);
    const result = await page.evaluate(async () => (await window.batStarCheck).result);
    assert(result.backend === (backend === 'classic' ? 'WebGLRenderer' : backend === 'webgpu' ? 'WebGPUBackend' : 'WebGLBackend'), `${backend}: requested backend renders bat star`);
    for (const view of ['top', 'oblique', 'underside', 'wall']) {
      await page.evaluate(async view => (await window.batStarCheck).pose(view), view);
      const render = await page.evaluate(async () => { const r = (await window.batStarCheck).renderer; return { calls: r.isWebGPURenderer ? r.info.render.drawCalls : r.info.render.calls, triangles: r.info.render.triangles }; });
      renders.push({ backend, view, ...render }); const extra = backend === 'classic' ? 0 : 1;
      assert(render.calls === 1 + extra && render.triangles === 814 + extra, `${backend}: ${view} is 814 triangles / one model draw`);
      await page.screenshot({ path: `${out}${backend}-${view}.png` });
    }
    await page.evaluate(async () => (await window.batStarCheck).pose('top'));
    const start = await page.evaluate(async () => (await window.batStarCheck).star.position.toArray());
    await page.evaluate(async () => (await window.batStarCheck).creep(60));
    const after = await page.evaluate(async () => (await window.batStarCheck).star.position.toArray());
    assert(Math.hypot(...after.map((n, i) => n - start[i])) <= .000121, `${backend}: one-minute creep stays below 0.13 mm`);
    await page.evaluate(async () => (await window.batStarCheck).dispose()); await page.close();
  }
  for (const force of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }); watch(page);
    await page.goto(url + `?quality=base${force ? '&webgl' : ''}`, { waitUntil: 'networkidle' });
    const get = () => page.evaluate(async () => {
      const { viewer: v } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src); await v.started;
      return { tab: v.state.tab, paused: v.state.paused, tankStars: v.tank.root.getObjectByName(v.harbor.seaStars.root.name) ? 3 : 0, harborStars: v.harbor.seaStars.batch.count, harbor: v.harbor.seaStars.positions.map(p => p.position.toArray()) };
    });
    const baseline = await get(); assert(baseline.tankStars === 0 && baseline.harborStars === 3, `${force ? 'WebGL2' : 'WebGPU'}: attached colonies remain in harbor only`);
    const colony = await page.evaluate(async () => { const { viewer: v } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src); return { triangles: v.harbor.seaStars.batch.geometry.index.count / 3, shadows: v.harbor.seaStars.batch.castShadow }; });
    assert(colony.triangles === 306 && !colony.shadows, 'Attached colonies use the lower-detail mesh and avoid a separate shadow pass');
    await page.waitForTimeout(300); assert(JSON.stringify((await get()).harbor) === JSON.stringify(baseline.harbor), 'Reduced motion freezes the surface crawlers');
    await page.getByRole('tab', { name: 'Objects', exact: true }).click(); await page.selectOption('#object-select', 'bat-star');
    assert((await page.locator('#object-stats').innerText()).includes('1 draws') && (await page.locator('#object-stats').innerText()).includes('814 triangles'), 'Inspector records measured bat-star budget');
    assert(await page.getByRole('button', { name: 'Regenerate', exact: true }).isVisible(), 'Seeded sea-star variations can be regenerated');
    assert(await page.locator('.playback').isHidden(), 'Sea star has no swimming controls');
    await page.screenshot({ path: `${out}${force ? 'webgl2' : 'webgpu'}-objects.png` });
    await page.getByRole('tab', { name: 'Area & buildings', exact: true }).click(); await page.getByRole('button', { name: 'Underwater', exact: true }).click();
    await page.screenshot({ path: `${out}${force ? 'webgl2' : 'webgpu'}-habitat.png` });
    await page.close();
  }
  const mobile = await browser.newPage({ viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }); watch(mobile);
  await mobile.goto(url + '?tab=objects&quality=base', { waitUntil: 'networkidle' }); await mobile.selectOption('#object-select', 'bat-star');
  assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '320px sea-star inspection fits the screen');
  await mobile.screenshot({ path: `${out}mobile-320.png` }); await mobile.close();
  assert(errors.length === 0, 'No browser or shader errors');
  await fs.writeFile(`${out}browser-qa.json`, JSON.stringify({ date: new Date().toISOString(), url, checks, errors, renders }, null, 2) + '\n');
} finally { await browser.close(); }
