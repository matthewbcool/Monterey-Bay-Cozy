import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const url = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5191/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [], errors = [], backends = [];
const assert = (ok, label) => { if (!ok) throw Error(label); checks.push(label); console.log('PASS', label); };
const species = [{ id: 'california-sheephead', alive: 1692, caught: 1504 }, { id: 'kelp-greenling', alive: 1796, caught: 1608 }, { id: 'garibaldi', alive: 1456, caught: 1268 }, { id: 'lingcod', alive: 1652, caught: 1464 }];
function watch(page) { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); }
for (const { id } of species) await fs.mkdir(`artifacts/${id}`, { recursive: true });
try {
  for (const { id, alive, caught } of species) for (const backend of ['classic', 'webgpu', 'webgl']) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } }); watch(page);
    await page.goto(url + `tests/fish-review.html?species=${id}&${backend}`);
    const info = await page.evaluate(async () => (await window.fishBackendCheck).result); backends.push(info);
    assert(info.backend === (backend === 'classic' ? 'WebGLRenderer' : backend === 'webgpu' ? 'WebGPUBackend' : 'WebGLBackend'), `${id}: ${backend} active`);
    for (const state of ['slow', 'fast', 'caught']) {
      await page.evaluate(async state => (await window.fishBackendCheck).pose(state), state);
      const stats = await page.evaluate(async () => { const r = (await window.fishBackendCheck).renderer; return { calls: r.isWebGPURenderer ? r.info.render.drawCalls : r.info.render.calls, triangles: r.info.render.triangles }; });
      const overhead = backend === 'classic' ? 0 : 1;
      assert(stats.calls === 2 + overhead && stats.triangles === (state === 'caught' ? caught : alive) + overhead, `${id}: ${backend} ${state} keeps two model draws`);
      await page.screenshot({ path: `artifacts/${id}/${backend}-${state}.png` });
    }
    for (const angle of ['oblique', 'underside', 'far']) {
      await page.evaluate(async angle => (await window.fishBackendCheck).pose(angle === 'far' ? 'caught' : 'fast', angle), angle);
      await page.screenshot({ path: `artifacts/${id}/${backend}-${angle}.png` });
    }
    await page.evaluate(async () => (await window.fishBackendCheck).pose('slow'));
    const before = await page.screenshot();
    await page.evaluate(async () => { const v = await window.fishBackendCheck; for (let i = 0; i < 9; i++) v.fish[0].update(.1); await v.render(); });
    assert(!before.equals(await page.screenshot()), `${id}: ${backend} visibly animates`);
    await page.evaluate(async () => (await window.fishBackendCheck).dispose()); await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }); watch(page);
  await page.goto(url, { waitUntil: 'networkidle' });
  const get = () => page.evaluate(async () => {
    const { viewer: v } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
    return { id: v.state.creatureId, tab: v.state.tab, view: v.state.view, paused: v.state.paused, mode: v.state.mode, cycleTime: v.state.cycleTime, schoolCount: v.state.schoolCount, fish: v.fish.getState(), position: v.fish.root.position.toArray(), distance: v.camera.position.distanceTo(v.controls.target) };
  });
  await get();
  const ids = await page.locator('#creature-select option').evaluateAll(options => options.map(o => o.value));
  assert(ids.length === 15 && species.every(s => ids.includes(s.id)), 'Fifteen creatures appear at the shared preview URL');
  await page.getByRole('button', { name: 'Follow fish', exact: true }).click();
  await page.getByRole('button', { name: 'Fast swim', exact: false }).click();
  await page.locator('canvas').focus();
  await page.keyboard.press('ArrowLeft');
  assert((await get()).id === 'gray-whale', 'Left wraps first fish to last from the canvas');
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft');
  const sheep = await get();
  assert(sheep.id === 'california-sheephead' && sheep.view === 'follow' && sheep.paused && sheep.fish.mode === 'fast', 'Left selects sheephead and preserves follow, pause and fast mode');
  await page.keyboard.press('ArrowRight');
  assert((await get()).id === 'kelp-greenling' && (await get()).distance < sheep.distance, 'Right switches once and reframes the smaller fish');
  await page.keyboard.press('ArrowRight'); assert((await get()).id === 'chinook-salmon', 'Right continues to the salmon');
  await page.keyboard.press('ArrowRight'); assert((await get()).id === 'garibaldi', 'Right selects garibaldi');
  await page.keyboard.press('ArrowRight'); assert((await get()).id === 'lingcod', 'Right selects lingcod');
  await page.keyboard.press('ArrowRight'); assert((await get()).id === 'moon-jelly', 'Right selects moon jelly');
  await page.keyboard.press('ArrowRight'); assert((await get()).id === 'green-sea-turtle', 'Right selects turtle');
  await page.keyboard.press('ArrowRight'); assert((await get()).id === 'great-white-shark', 'Right selects shark');
  await page.keyboard.press('ArrowRight'); assert((await get()).id === 'giant-sea-bass', 'Right selects giant sea bass');
  await page.keyboard.press('ArrowRight'); assert((await get()).id === 'giant-pacific-octopus', 'Right selects octopus');
  await page.keyboard.press('ArrowRight'); assert((await get()).id === 'gray-whale', 'Right selects gray whale');
  await page.keyboard.press('ArrowRight'); assert((await get()).id === 'tuna', 'Right wraps last creature to first');
  for (let i = 1; i <= ids.length; i++) {
    await page.keyboard.press('ArrowRight');
    assert((await get()).id === ids[i % ids.length] && await page.locator('#creature-select').inputValue() === ids[i % ids.length], `Full keyboard lap: ${ids[i % ids.length]}`);
  }
  await page.evaluate(async () => { const { viewer: v } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src); window.previousFish = v.fish; });
  await page.keyboard.press('ArrowRight');
  assert((await get()).id === 'pacific-sardine', 'Arrow navigation includes the sardine school');
  assert(await page.evaluate(() => { const disposed = window.previousFish.getState().disposed; delete window.previousFish; return disposed; }), 'Switching releases the replaced fish');
  await page.selectOption('#school-count', '128');
  await page.getByRole('button', { name: 'Follow fish', exact: true }).click(); await page.keyboard.press('ArrowRight');
  assert((await get()).id === 'blue-rockfish', 'Arrows also work after pressing a tank button');
  await page.keyboard.press('ArrowLeft');
  assert((await get()).id === 'pacific-sardine' && (await get()).schoolCount === 128, 'School size survives keyboard switching');
  await page.selectOption('#creature-select', 'california-sheephead'); await page.selectOption('#life-state', 'caught');
  await page.locator('canvas').focus(); await page.keyboard.press('ArrowRight');
  assert((await get()).id === 'kelp-greenling' && (await get()).fish.lifeState === 'caught', 'Caught X-eye state survives keyboard switching');
  await page.keyboard.press('Shift+ArrowLeft');
  assert((await get()).id === 'kelp-greenling', 'Modified arrow shortcuts are left alone');
  await page.evaluate(() => document.querySelector('canvas').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', repeat: true, bubbles: true, cancelable: true })));
  assert((await get()).id === 'kelp-greenling', 'Held keys do not repeatedly allocate fish');
  const native = await page.evaluate(() => {
    const select = document.querySelector('#creature-select');
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }); select.dispatchEvent(event); return !event.defaultPrevented;
  });
  assert(native && (await get()).id === 'kelp-greenling', 'Dropdown arrow events retain native behavior without a second switch');
  await page.evaluate(() => { const input = document.createElement('div'); input.id = 'editable-check'; input.contentEditable = 'true'; document.body.append(input); input.focus(); });
  await page.keyboard.press('ArrowLeft');
  assert((await get()).id === 'kelp-greenling', 'Editing text does not switch fish');
  await page.evaluate(() => document.querySelector('#editable-check').remove());
  await page.locator('#tab-tank').focus(); await page.keyboard.press('ArrowRight');
  assert((await get()).tab === 'area' && (await get()).id === 'kelp-greenling', 'Tab-list arrows change tabs without changing fish');
  await page.locator('canvas').focus(); const area = await get(); await page.keyboard.press('ArrowRight');
  assert((await get()).id === area.id, 'Arrow orbit outside the tank does not change fish');
  await page.getByRole('tab', { name: 'Tank', exact: true }).click();
  await page.selectOption('#life-state', 'alive'); await page.getByRole('button', { name: 'Cycle', exact: false }).click();
  await page.locator('canvas').focus(); await page.keyboard.press('ArrowLeft');
  assert((await get()).mode === 'cycle' && (await get()).paused, 'Cycle and pause settings survive navigation');
  for (const { id } of species) {
    await page.selectOption('#creature-select', id); await page.getByRole('button', { name: 'Follow fish', exact: true }).click();
    await page.screenshot({ path: `artifacts/${id}/tank.png` });
  }
  await page.getByRole('button', { name: 'Whole tank', exact: true }).click(); await page.keyboard.press('ArrowLeft');
  assert((await get()).view === 'tank', 'Whole-tank view stays selected when cycling fish');
  await page.close();
  for (const width of [320, 390, 600]) {
    const mobile = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true }); watch(mobile);
    await mobile.goto(url, { waitUntil: 'networkidle' });
    for (const { id } of species) {
      await mobile.selectOption('#creature-select', id); await mobile.getByRole('button', { name: 'Follow fish', exact: true }).tap();
      assert(await mobile.evaluate(() => {
        const a = document.querySelector('.creature-control').getBoundingClientRect(), b = document.querySelector('.camera-controls').getBoundingClientRect();
        return document.documentElement.scrollWidth <= innerWidth && (a.left<=b.left&&a.top<=b.top&&b.right<=a.right&&b.bottom<=a.bottom);
      }), `${id}: ${width}px controls fit without overlap`);
      assert(await mobile.getByRole('button', { name: 'Play animation', exact: true }).isVisible(), `${id}: ${width}px respects reduced motion`);
      await mobile.screenshot({ path: `artifacts/${id}/mobile-${width}.png` });
    }
    await mobile.close();
  }
  assert(errors.length === 0, 'No browser or shader errors');
  await fs.writeFile('artifacts/fish-collection/local-fish-qa.json', JSON.stringify({ date: new Date().toISOString(), url, checks, errors, backends }, null, 2) + '\n');
} finally { await browser.close(); }
