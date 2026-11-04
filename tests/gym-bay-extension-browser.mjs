import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5191/';
const address = new URL(base), folder = 'artifacts/gym-bay';
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });
const results = [];
try {
  for (const backend of ['webgpu', 'webgl', 'phone-webgl']) {
    const phone = backend === 'phone-webgl';
    const page = await browser.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: phone, isMobile: phone });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /shader|pipeline|validation/i.test(message.text())) errors.push(message.text()); });
    await page.route('https://api.weather.gov/**', route => route.abort());
    // Hold the loaded development revision while other project chats edit the shared checkout.
    await page.routeWebSocket(url => url.hostname === address.hostname && url.port === address.port, socket => socket.send(JSON.stringify({ type: 'connected' })));
    await page.goto(`${base}?tab=gym${backend.includes('webgl') ? '&webgl' : ''}`);
    let ready = false;
    for (const deadline = Date.now() + 60000; Date.now() < deadline && !ready;) {
      ready = await page.evaluate(async () => {
        const script = document.querySelector('script[type="module"][src*="/src/main.ts"]');
        if (!script) return false;
        const { viewer } = await import(script.src);
        return !!viewer.avatarWorkbench?.getSnapshot().gymReady && !!viewer.avatarWorkbench?.getSnapshot().bay;
      });
      if (!ready) await page.waitForTimeout(120);
    }
    assert(ready, `${backend} Gym bay did not initialize`);
    await page.locator('#gym-menu > summary').click();
    await page.locator('#gym-bay-overview').click();
    await page.waitForTimeout(700);
    const state = await page.evaluate(async () => {
      const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      const w = viewer.avatarWorkbench, bay = w.scene.getObjectByName('Testing Gym · Monterey Bay regional map');
      const model = w.getSnapshot();
      return {
        backend: model.backend, bay: model.bay, camera: { position: w.camera.position.toArray(), far: w.camera.far },
        waterVisible: w.gym.water.root.visible,
        localVisible: w.scene.getObjectByName('Gym detailed local area').visible,
        regionalVisible: w.scene.getObjectByName('Gym regional map visibility').visible,
        meshes: bay.children.filter(child => child.isMesh).length,
        lod: w.lod.stats(bay),
        render: model.renderer,
        fog: { near: w.scene.fog.near, far: w.scene.fog.far },
      };
    });
    assert.equal(state.backend, backend === 'webgpu' ? 'WebGPU' : 'WebGL 2');
    assert.equal(state.bay.overview, true);
    assert.equal(state.waterVisible, false);
    assert.equal(state.localVisible, false);
    assert.equal(state.regionalVisible, true);
    assert(state.meshes > 8);
    assert(state.lod.far.triangles < state.lod.near.triangles);
    assert(state.render.drawCalls > 0 && state.render.triangles > 0);
    assert(state.fog.far > 100000);
    assert(state.render.drawCalls < 45, 'Bay overview must avoid submitting the hidden park');
    assert((await page.locator('.gym-bay-place-labels .bay-place-label:visible').count()) >= (phone ? 2 : 5), 'Visible bay place labels guide the overview');
    await page.screenshot({ path: `${folder}/${backend}-overview.png` });
    await page.locator('#gym-menu > summary').click();
    assert((await page.locator('#gym-bay-place option').count()) >= 12);
    await page.selectOption('#gym-bay-place', 'santa-cruz');
    await page.waitForTimeout(250);
    const focus = await page.evaluate(async () => {
      const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      const w = viewer.avatarWorkbench;
      return { focus: w.getSnapshot().bay.focus, far: w.camera.far, regional: w.scene.getObjectByName('Gym regional map visibility').visible };
    });
    assert.equal(focus.focus, 'santa-cruz');
    assert.equal(focus.far, 50000);
    assert.equal(focus.regional, true);
    await page.screenshot({ path: `${folder}/${backend}-santa-cruz.png` });
    await page.locator('#gym-menu > summary').click();
    await page.locator('#gym-bay-overview').click();
    await page.waitForTimeout(100);
    const restored = await page.evaluate(async () => {
      const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      const w = viewer.avatarWorkbench;
      return { bay: w.getSnapshot().bay, water: w.gym.water.root.visible, near: w.camera.near,
        local: w.scene.getObjectByName('Gym detailed local area').visible,
        regional: w.scene.getObjectByName('Gym regional map visibility').visible };
    });
    assert.equal(restored.bay.overview, false);
    assert.equal(restored.water, true);
    assert.equal(restored.local, true);
    assert.equal(restored.regional, false);
    assert.equal(restored.near, .25);
    assert.deepEqual(errors, []);
    results.push({ backend, overview: state, focus, restored });
    await page.close();
  }
} finally { await browser.close(); }
await writeFile(`${folder}/browser.json`, JSON.stringify(results, null, 2) + '\n');
console.log('Gym bay overview passed on WebGPU, WebGL 2 and a touch phone viewport');
