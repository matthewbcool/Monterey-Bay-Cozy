import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const url = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5191/';
const out = process.env.ARTIFACT_DIR ?? 'artifacts/map-world';
const fixtureTime = Date.parse('2026-10-23T04:18:00Z');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });
const checks = [], errors = [], measurements = [], externalRequests = [], screenshots = [], sourceSnapshots = [];
let activePage;
function check(condition, label) { if (!condition) throw new Error(label); checks.push(label); console.log('PASS', label); }
async function sources(label) {
  const paths = new Set(['tests/map-world-browser.mjs', 'src/main.ts', 'src/style.css', 'src/viewer/mapStudy.ts', 'src/viewer/liveFeedLayer.ts',
    'src/data/worldConditions.ts', 'src/data/real-time-sources.json', 'src/data/monterey-map.json', 'src/viewer/nodeStyle.ts',
    'src/models/shared/lod/controller.ts', 'src/models/shared/lod/geometry.ts', 'src/models/shared/style.ts', 'src/models/shared/staticAsset.ts']);
  for (const directory of ['src/viewer/mapStudy', 'src/viewer/testingGym'])
    for (const name of await fs.readdir(directory)) if (name.endsWith('.ts')) paths.add(`${directory}/${name}`);
  for (const name of await fs.readdir('src/data')) if (name.startsWith('lovers-point')) paths.add(`src/data/${name}`);
  const files = await Promise.all([...paths].sort().map(async path => { const bytes = await fs.readFile(path); return { path, bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') }; }));
  const value = { label, capturedAt: new Date().toISOString(), sha256: createHash('sha256').update(JSON.stringify(files)).digest('hex'), files };
  sourceSnapshots.push(value); return value;
}
const read = (page, fn, arg) => page.evaluate(async ({ fn, arg }) => {
  const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
  const m = viewer.mapStudy;
  if (!m) throw new Error('Map Study is not ready');
  return new Function('m', 'viewer', 'arg', `return (${fn})(m, viewer, arg)`)(m, viewer, arg);
}, { fn: fn.toString(), arg });
async function context(options = {}) {
  const c = await browser.newContext({ reducedMotion: 'reduce', ...options }), preview = new URL(url);
  await c.routeWebSocket(u => u.hostname === preview.hostname && u.port === preview.port && u.searchParams.has('token'), socket => socket.send(JSON.stringify({ type: 'connected' })));
  return c;
}
async function fixture(page, mode = 'fresh') {
  const state = { mode, requests: [], held: [] };
  await page.clock.setFixedTime(fixtureTime);
  await page.route(/^https:\/\/(api\.tidesandcurrents\.noaa\.gov|api\.weather\.gov)\//, async route => {
    const request = route.request(), requestUrl = request.url(); state.requests.push(requestUrl); externalRequests.push({ mode: state.mode, url: requestUrl, fixture: true });
    if (state.mode === 'held') { state.held.push(route); return; }
    if (state.mode === 'failed' && requestUrl.includes('product=water_level')) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Fixture observation unavailable' }) }); return;
    }
    let data;
    if (requestUrl.includes('product=water_level')) data = { metadata: { id: '9413450' }, data: [{ t: state.mode === 'stale' ? '2026-10-23 03:00' : '2026-10-23 04:12', v: '1.689', s: '.023', q: 'p', f: '2,0,1,0' }] };
    else if (requestUrl.includes('product=predictions')) data = { predictions: [{ t: '2026-10-23 03:38', v: '1.344', type: 'H' }, { t: '2026-10-23 09:44', v: '.297', type: 'L' }, { t: '2026-10-23 16:05', v: '1.565', type: 'H' }, { t: '2026-10-23 22:28', v: '.299', type: 'L' }, { t: '2026-10-24 04:29', v: '1.346', type: 'H' }] };
    else if (requestUrl.includes('/points/')) data = { properties: { forecastHourly: 'https://api.weather.gov/gridpoints/MTR/92,51/forecast/hourly' } };
    else data = { properties: { updateTime: '2026-10-23T03:22:17Z', periods: [{ startTime: '2026-10-22T21:00:00-07:00', endTime: '2026-10-22T22:00:00-07:00', temperature: 16, temperatureUnit: 'C', probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 31 }, windSpeed: '22 km/h', windDirection: 'WNW', shortForecast: 'Chance Light Rain · fixture <script>window.bad=true</script>' }] } };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  return state;
}
function observe(page, label) {
  activePage = page;
  page.on('pageerror', error => errors.push({ label, text: error.message }));
  page.on('console', event => { if (event.type() === 'error' && !event.text().includes('503') && !event.text().includes('ERR_ABORTED')) errors.push({ label, text: event.text() }); });
}
async function ready(page, backend, flags = '&park') {
  await page.goto(`${url}?tab=map${flags}${backend === 'webgl' ? '&webgl' : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(async () => {
    const entry = document.querySelector('script[type="module"][src*="/src/main.ts"]');
    if (!entry) return false;
    const { viewer } = await import(entry.src);
    return viewer.mapStudy?.conditions && viewer.mapStudy.lod.stats(viewer.mapStudy.park.root).ready
      && !!document.querySelector('#panel-map').dataset.mapBackend;
  }, undefined, { timeout: 60000 });
  await page.waitForTimeout(200);
}
async function shot(page, name) {
  await page.screenshot({ path: `${out}/${name}.png` }); screenshots.push(name + '.png');
}
async function capture(page, label, mode = 'auto') {
  await page.selectOption('#map-lod', mode);
  const value = await read(page, (m, _viewer, { label, mode }) => {
    const original = m.renderer.info.autoReset;
    m.renderer.info.autoReset = false; m.renderer.info.reset();
    m.lod.update(m.camera, m.renderer.domElement.clientHeight, 0, true); m.renderer.render(m.scene, m.camera);
    const result = { label, mode, backend: document.querySelector('#panel-map').dataset.mapBackend, park: m.lod.stats(m.park.root), all: m.lod.stats(m.scene),
      render: { drawCalls: m.renderer.info.render.drawCalls, triangles: m.renderer.info.render.triangles, frameCalls: m.renderer.info.render.frameCalls },
      camera: { position: m.camera.position.toArray(), near: m.camera.near, far: m.camera.far },
      root: { position: m.park.root.position.toArray(), scale: m.park.root.scale.toArray() },
      inspection: m.lod.inspect(m.park.root).map(row => ({ name: row.name, level: row.level, pixels: row.pixels })) };
    m.renderer.info.autoReset = original; return result;
  }, { label, mode });
  measurements.push(value); return value;
}
async function openConditions(page) { if (!await page.locator('.world-conditions-tools').evaluate(el => el.open)) await page.locator('.world-conditions-tools > summary').click(); }
async function refresh(page) { await page.locator('#world-conditions-refresh').click(); await page.waitForFunction(() => !document.querySelector('#world-conditions-refresh').disabled, undefined, { timeout: 20000 }); }

try {
  await sources('before');
  for (const backend of ['webgpu', 'webgl']) {
    const c = await context({ viewport: { width: 1440, height: 1000 } }), page = await c.newPage(); observe(page, backend);
    const data = await fixture(page); await sources(backend + ' navigation'); await ready(page, backend);
    // The installed Playwright beta's locator getAttribute returned null while
    // browser DOM reads returned the populated attributes. Read in-page, retaining the assertions.
    const actualBackend=await page.locator('#panel-map').evaluate(el=>el.getAttribute('data-map-backend'));
    check(actualBackend === (backend === 'webgpu' ? 'webgpu' : 'webgl2'), `${backend}: correct renderer backend (actual ${actualBackend})`);
    check(await page.locator('[data-view=park]').evaluate(el=>el.getAttribute('aria-pressed')) === 'true', `${backend}: direct Lovers Point view`);
    check(data.requests.length === 0, `${backend}: loading the map requests no live data`);
    const raisedBuildings = await read(page, async m => {
      const { resolveParkBuildingElevation, replacedBuildingIds } = await import('/src/viewer/mapStudy/loversPoint.ts');
      const count = m.data.buildings.filter(building => !replacedBuildingIds.has(building.id) && resolveParkBuildingElevation(building.rings) !== null).length;
      return { count, groupVisible: m.scene.getObjectByName('Terrain-adjusted regional massing and foundations').visible };
    });
    check(raisedBuildings.count === 15 && raisedBuildings.groupVisible, `${backend}: fifteen adjacent regional footprints rise above the detailed terrain`);
    await page.locator('#map-estimates').uncheck();
    check(await read(page, m => {
      const foundations = []; m.scene.traverse(o => { if (o.name === 'Inferred foundation at detailed terrain edge' && o.userData.basis !== 'height') foundations.push(o); });
      return foundations.length > 0 && foundations.every(o => !o.visible);
    }), `${backend}: estimated-height switch also hides inferred foundations`);
    await page.locator('#map-estimates').check();
    const base = await capture(page, backend + ' park', 'auto');
    check(base.park.near.triangles > base.park.mid.triangles && base.park.mid.triangles > base.park.far.triangles, `${backend}: all park LOD variants reduce triangles`);
    check(JSON.stringify(base.root.scale) === '[1,1,1]', `${backend}: park remains metre scale`);
    const variants = [];
    for (const mode of ['near', 'mid', 'far']) variants.push(await capture(page, backend + ' park', mode));
    check(variants[2].render.triangles < variants[1].render.triangles && variants[1].render.triangles < variants[0].render.triangles, `${backend}: forced detail reduces actual submitted triangles`);
    check(new Set(variants.map(x => JSON.stringify(x.root))).size === 1, `${backend}: LOD preserves park placement and scale`);
    check(new Set(variants.map(x => x.render.drawCalls)).size === 1, `${backend}: detail variants add no rendering passes`);
    check(variants.every(x => x.render.drawCalls > 0), `${backend}: actual submitted draw calls recorded`);
    await page.selectOption('#map-lod', 'auto');
    const text = await page.locator('.map-lod-status').textContent();
    check(['Near / Mid / Far', 'draws', 'MiB'].every(s => text.includes(s)), `${backend}: LOD cost and storage visible`);
    check(text.includes('Park: ' + [base.park.near, base.park.mid, base.park.far].map(row => row.triangles.toLocaleString()).join(' / ')), `${backend}: displayed park counts match the registered buffers`);
    await shot(page, backend + '-park');
    await page.locator('#map-park').uncheck(); check(!await read(page, m => m.park.root.visible), `${backend}: detailed patch can be disabled for the regional map`);
    check(await read(page, m => {
      const raised = m.scene.getObjectByName('Terrain-adjusted regional massing and foundations');
      const original = raised.parent.children.find(o => o.isGroup && o !== raised);
      return !raised.visible && original.visible && original.children.every(o => { o.geometry.computeBoundingBox(); return Math.abs(o.geometry.boundingBox.min.y) < .001; });
    }), `${backend}: disabling the detailed patch restores original ground-level regional masses`);
    await page.locator('#map-park').check(); check(await read(page, m => m.park.root.visible), `${backend}: detailed park returns`);
    await page.locator('[data-view=overview]').click(); const overview = await capture(page, backend + ' overview');
    check(overview.inspection.some(row => row.level !== 'near'), `${backend}: regional overview uses reduced park details`);
    const overviewNear = await capture(page, backend + ' overview', 'near');
    check(overview.render.triangles < overviewNear.render.triangles && overview.render.drawCalls === overviewNear.render.drawCalls
      && JSON.stringify(overview.camera) === JSON.stringify(overviewNear.camera), `${backend}: overview Auto saves actual triangles at the same camera without extra draws`);
    await page.selectOption('#map-lod', 'auto');
    await shot(page, backend + '-overview');
    await page.waitForTimeout(100); const frames = await read(page, m => m.renderedFrames); await page.waitForTimeout(300);
    check(await read(page, m => m.renderedFrames) === frames, `${backend}: idle map remains demand rendered`);
    await openConditions(page);
    check(data.requests.length === 0, `${backend}: opening conditions does not request remote data`);
    check(await page.locator('[data-channel=observedTide] .world-condition-state').textContent() === 'Not loaded', `${backend}: unloaded observation clearly labelled`);
    await refresh(page);
    const snapshot = await read(page, m => m.conditions.snapshot);
    check(snapshot.observedTide.state === 'observed' && snapshot.predictedTides.state === 'predicted' && snapshot.weather.state === 'forecast' && snapshot.daylight.state === 'computed', `${backend}: observation, prediction, forecast and calculation remain distinct`);
    check(data.requests.length === 4, `${backend}: one refresh shares four bounded requests including NWS discovery`);
    check(await page.locator('[data-channel=observedTide] .world-condition-value').textContent().then(t => t.includes('1.69 m') && t.includes('MLLW') && t.includes('preliminary')), `${backend}: tide datum, units and preliminary status visible`);
    check(await page.locator('[data-channel=weather] .world-condition-value').textContent().then(t => t.includes('16.0 °C') && t.includes('6.1') && t.includes('31%')), `${backend}: forecast units normalized and visible`);
    check(!await page.evaluate(() => window.bad) && await page.locator('[data-channel=weather] script').count() === 0, `${backend}: provider text cannot create markup`);
    check(snapshot.observedTide.sourceTime !== snapshot.weather.sourceTime && snapshot.predictedTides.sourceTime === null, `${backend}: per-source timestamps preserved without invented prediction issue time`);
    await page.locator('#world-conditions-refresh').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('#world-conditions-refresh').disabled);
    check(data.requests.length === 4, `${backend}: keyboard refresh works and reuses cached conditions`);
    const withConditions = await capture(page, backend + ' overview with conditions');
    check(withConditions.render.drawCalls === overview.render.drawCalls && withConditions.render.triangles === overview.render.triangles, `${backend}: conditions cards and geographic pins add no geometry draws`);
    await page.waitForTimeout(100); const liveFrames = await read(page, m => m.renderedFrames); await page.waitForTimeout(200);
    check(await read(page, m => m.renderedFrames) === liveFrames && data.requests.length === 4, `${backend}: loaded conditions start neither rendering nor polling loops`);
    await shot(page, backend + '-conditions');
    await page.locator('.world-source-catalogue > summary').click();
    check(await page.locator('#world-source-select option').count() === 10 && await page.locator('.world-conditions-map-pin').count() === 3, `${backend}: ten sources use three co-located geographic pin groups`);
    await page.selectOption('#world-source-select', 'cencoos-aquarium-intake');
    check(await page.locator('#world-source-focus').isDisabled() && (await page.locator('.world-source-position').textContent()).includes('no map pin'), `${backend}: unresolved sources have no invented position`);
    await page.selectOption('#world-source-select', 'ndbc-46042-waves'); await page.locator('#world-source-focus').focus(); await page.keyboard.press('Enter');
    check((await page.locator('.world-source-state').textContent()).includes('Research only'), `${backend}: unconnected offshore buoy is clearly labelled`);
    const offshore = await read(page, m => ({ position: m.camera.position.toArray(), far: m.camera.far }));
    check(offshore.position[0] < -40000 && offshore.position[2] < -15000, `${backend}: offshore buoy retains its real position beyond the street map`);
    await page.locator('#world-source-all').click();
    check(await read(page, m => m.camera.far > 100000), `${backend}: regional source view expands the clipping range`);
    await shot(page, backend + '-source-region');
    await page.locator('.aquarium-entry').click();
    check(await read(page, m => m.interior.enabled) && await page.locator('.world-conditions-label-layer').evaluate(el => el.hidden), `${backend}: interior hides outdoor source pins`);
    await page.locator('.aq-back').click(); await page.locator('[data-view=park]').click();
    check(await read(page, m => !m.interior.enabled && m.park.root.visible), `${backend}: interior returns to the park map`);
    await page.locator('#tab-tank').click();
    check(await page.locator('.world-conditions-label-layer').evaluate(el => el.hidden), `${backend}: leaving map pauses its layer`);
    await page.locator('#tab-map').click(); check(data.requests.length === 4, `${backend}: returning to the map does not fetch again`);
    await c.close();
  }

  const phone = await context({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), mobilePage = await phone.newPage(); observe(mobilePage, 'phone');
  await fixture(mobilePage); await ready(mobilePage, 'webgl');
  for (const width of [390, 320]) {
    await mobilePage.setViewportSize({ width, height: 844 }); await mobilePage.waitForTimeout(100);
    check(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: no page overflow`);
    const button = await mobilePage.locator('[data-view=park]').boundingBox();
    check(button && button.x >= 0 && button.x + button.width <= width, `${width}px: Lovers Point button fits`);
    await mobilePage.locator('[data-view=park]').tap(); await shot(mobilePage, `phone-${width}-park`);
    await openConditions(mobilePage); await mobilePage.locator('#world-conditions-refresh').tap();
    await mobilePage.waitForFunction(() => !document.querySelector('#world-conditions-refresh').disabled);
    check(await mobilePage.locator('#world-conditions-refresh').boundingBox().then(b => b && b.width >= 44 && b.height >= 44), `${width}px: refresh is a touch-sized control`);
    await mobilePage.locator('.world-source-catalogue').evaluate(el => el.open = true);
    await mobilePage.selectOption('#world-source-select', 'noaa-monterey-water-level');
    await mobilePage.locator('#world-source-focus').tap();
    check(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: source cards and selector stay inside viewport`);
    await shot(mobilePage, `phone-${width}-conditions`);
    await mobilePage.locator('.world-conditions-tools').evaluate(el => el.open = false);
  }
  await phone.close();

  for (const mode of ['stale', 'failed', 'held']) {
    const c = await context({ viewport: { width: 1280, height: 900 } }), page = await c.newPage(); observe(page, mode);
    const data = await fixture(page, mode); await ready(page, 'webgl', '&conditions');
    check(data.requests.length === 0, `${mode}: direct conditions link remains opt-in`);
    if (mode === 'held') {
      await page.locator('#world-conditions-refresh').click();
      await page.waitForFunction(() => document.querySelector('#world-conditions-refresh').disabled);
      await page.locator('.aquarium-entry').click(); await page.waitForTimeout(100);
      const snapshot = await read(page, m => m.conditions.snapshot);
      check(![snapshot.observedTide, snapshot.predictedTides, snapshot.weather].some(channel => /cancel|abort/i.test(channel.reason ?? '')), 'Cancellation on entering interior does not become a provider failure');
      await page.locator('.aq-back').click();
      check(await page.locator('#world-conditions-refresh').isEnabled(), 'Returning from a cancelled refresh enables manual retry');
      await page.locator('#world-conditions-refresh').click(); await page.locator('#tab-tank').click(); await page.waitForTimeout(100);
      const afterTab = await read(page, m => m.conditions.snapshot);
      check(![afterTab.observedTide, afterTab.predictedTides, afterTab.weather].some(channel => /cancel|abort/i.test(channel.reason ?? '')), 'Leaving the map cancels pending refresh without a provider error');
      await page.locator('#tab-map').click(); check(await page.locator('#world-conditions-refresh').isEnabled(), 'Map return enables an explicit refresh after cancellation');
      await Promise.all(data.held.map(route => route.abort().catch(() => {})));
    } else {
      await refresh(page); const snapshot = await read(page, m => m.conditions.snapshot);
      check(snapshot.observedTide.state === (mode === 'stale' ? 'stale' : 'unavailable'), `${mode}: observation state reflects its own source`);
      check(snapshot.predictedTides.state === 'predicted' && snapshot.weather.state === 'forecast', `${mode}: one bad observation does not invalidate other channels`);
      check((await page.locator('[data-channel=observedTide] .world-condition-state').textContent()).toLowerCase() === (mode === 'stale' ? 'stale' : 'unavailable'), `${mode}: user sees the channel warning`);
      await shot(page, mode + '-conditions');
    }
    await c.close();
  }
  check(errors.length === 0, 'No browser or shader errors: ' + errors.map(x => x.text).join('; '));
  await sources('after');
  check(sourceSnapshots.every(s => s.sha256 === sourceSnapshots[0].sha256), 'Source snapshots remained stable through all browser checks');
  await fs.rm(`${out}/failure.png`, { force: true });
} catch (error) {
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  if (sourceSnapshots.at(-1)?.label !== 'after') await sources('after');
  const initial = new Map(sourceSnapshots[0]?.files.map(x => [x.path, x.sha256]) ?? []);
  const changedFiles = sourceSnapshots.at(-1).files.filter(x => initial.get(x.path) !== x.sha256).map(x => x.path);
  await fs.writeFile(`${out}/browser-metrics.json`, JSON.stringify({ date: new Date().toISOString(), url, fixtureTime: new Date(fixtureTime).toISOString(), checks, errors, measurements, externalRequests, screenshots,
    sources: { stable: sourceSnapshots.every(s => s.sha256 === sourceSnapshots[0].sha256), changedFiles, snapshots: sourceSnapshots },
    note: 'Deterministic mocked provider responses test behavior, not present-day conditions. Chrome native WebGPU and forced WebGL 2; touch/phone emulation is not physical-device profiling. Only the local Vite HMR WebSocket is blocked. The map is demand rendered. LOD measurements include offscreen registered park buffers; renderer counters include visible map/interior/line/output overhead.' }, null, 2) + '\n');
  await browser.close();
}
console.log(`PASS ${checks.length} Map Study world-data browser checks`);
