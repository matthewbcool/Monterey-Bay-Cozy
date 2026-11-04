// Focused face-line regression. PREVIEW_URL defaults to the canonical shared preview.
// Writes only artifacts/avatar-creator/face-lines (FACE_LINES_ARTIFACT_DIR may override).
// Uses isolated storage, real creator controls, and mouse zoom/orbit for visual checks.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const url = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5191/';
const out = process.env.FACE_LINES_ARTIFACT_DIR ?? 'artifacts/avatar-creator/face-lines';
const tracked = ['src/main.ts', 'src/viewer/avatarWorkbench.ts', 'src/viewer/avatarWorkbench.css', 'src/data/avatarSaves.ts', 'src/models/avatar/design.ts', 'src/models/avatar/geometry.ts', 'src/models/avatar/index.ts', 'src/viewer/nodeStyle.ts', 'src/models/shared/lod/controller.ts', 'src/models/shared/lod/geometry.ts'];
const digest = async () => Promise.all(tracked.map(async file => ({ file, mtime: (await fs.stat(file)).mtime.toISOString(), sha256: createHash('sha256').update(await fs.readFile(file)).digest('hex') })));
const sourceBefore = await digest();
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });
const checks = [], errors = [], imageRequests = [], measurements = [], captures = [], viteEvents = [];
const stablePages = new WeakMap();
let activePage, failure = null;
const legacyDesign = { name: 'Cove', skinTone: '#e8b58a', hairColor: '#53392c', eyeColor: '#337b82', hairStyle: 'sweep', eyeStyle: 'round', mouthStyle: 'smile', topStyle: 'tee', topColor: '#2c8d91', bottomStyle: 'shorts', bottomColor: '#3d596c', shoeColor: '#f3dfb9' };
const legacyCollection = { version: 1, selectedId: 'legacy-before-face-lines', avatars: [{ id: 'legacy-before-face-lines', design: legacyDesign, savedAt: '2026-10-22T00:00:00.000Z' }] };
function check(ok, label) { if (!ok) throw Error(label); checks.push(label); console.log('PASS', label); }
function observe(page, label) {
  activePage = page;
  page.on('websocket', socket => socket.on('framereceived', ({payload}) => { try { const value = JSON.parse(String(payload)); if (['full-reload', 'update', 'error'].includes(value.type)) viteEvents.push({label, at:new Date().toISOString(), message:value}); } catch {} }));
  page.on('pageerror', error => errors.push(label + ': ' + error.message));
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('ERR_CERT_AUTHORITY_INVALID')) errors.push(label + ': ' + message.text()); });
  page.on('request', request => { if (request.resourceType() === 'image' && /^https?:/.test(request.url())) imageRequests.push(request.url()); });
}
const read = async (page, fn, arg) => {
 const result = await page.evaluate(async ({ fn, arg }) => {
  const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
  const w = viewer.avatarWorkbench;
  if (!w) throw Error('Avatar workbench is not initialized');
  await w.ready;
  return { value: await new Function('w', 'arg', `return (${fn})(w,arg)`)(w, arg), origin: performance.timeOrigin, scene: w.scene.uuid };
 }, { fn: fn.toString(), arg });
 const expected = stablePages.get(page);
 if (expected && (expected.origin !== result.origin || expected.scene !== result.scene)) throw Error('Page/workbench restarted during face-line verification; the current draft was reset.');
 return result.value;
};
const snapshot = page => read(page, w => w.getSnapshot());
async function ready(page) {
  await page.locator('[data-design="faceLines"][data-value="none"]').waitFor({ state: 'attached', timeout: 45000 });
  await page.waitForFunction(async () => {
    const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
    return !!viewer.avatarWorkbench?.getSnapshot().backend;
  }, null, { timeout: 45000 });
  await page.waitForTimeout(200);
  stablePages.set(page, await page.evaluate(async () => { const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return {origin:performance.timeOrigin,scene:viewer.avatarWorkbench.scene.uuid}; }));
}
async function choose(page, field, value, category = 'face') {
  await page.locator('#av-category-' + category).click();
  await page.locator(`[data-design="${field}"][data-value="${value}"]`).click();
  await page.waitForFunction(async ({ field, value }) => {
    const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
    const w = viewer.avatarWorkbench;
    return w?.getSnapshot().design[field] === value && w.lod.stats(w.avatar.mesh).ready;
  }, { field, value });
  await page.waitForTimeout(120);
}
async function detail(page, level) {
  if (!await page.locator('.av-performance').evaluate(element => element.open)) await page.locator('.av-performance summary').click();
  await page.selectOption('#avatar-lod', level);
  await page.waitForTimeout(150);
  await page.locator('.av-performance summary').click();
}
async function orbit(page, dx) {
  const b = await page.locator('#avatar-viewport canvas').boundingBox(), x = b.x + b.width * .55, y = b.y + b.height * .64;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(100);
}
async function closeView(page) {
  const b = await page.locator('#avatar-viewport canvas').boundingBox();
  await page.mouse.move(b.x + b.width * .65, b.y + b.height * .5); await page.mouse.wheel(0, -1400); await page.waitForTimeout(200);
}
async function measure(page) {
  return read(page, w => {
    const a = w.avatar, g = a.mesh.geometry, weights = g.getAttribute('skinWeight'), indices = g.getAttribute('skinIndex');
    let valid = weights.count === g.getAttribute('position').count && indices.count === weights.count;
    for (let i = 0; i < weights.count; i++) {
      valid &&= Math.abs(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i) - 1) < 1e-5;
      for (const get of ['getX', 'getY', 'getZ', 'getW']) valid &&= Number.isFinite(weights[get](i)) && indices[get](i) >= 0 && indices[get](i) < a.bones.length;
    }
    let fingerprint = 2166136261;
    for (const attribute of ['position', 'color']) for (const value of g.getAttribute(attribute).array) fingerprint = Math.imul(fingerprint ^ Math.round(value * 1e6), 16777619) >>> 0;
    const materials = Array.isArray(a.mesh.material) ? a.mesh.material : [a.mesh.material];
    const maps = materials.flatMap(material => Object.entries(material).filter(([key, value]) => key !== 'gradientMap' && value?.isTexture).map(([key]) => key));
    return { snapshot: w.getSnapshot(), geometryFingerprint: fingerprint, skinValid: valid, scale: a.root.scale.toArray(), bones: a.bones.length, boneMatrixBytes: a.skeleton.boneMatrices.byteLength, imageMaps: maps, imageTextures: a.stats.imageTextures, materials: materials.length, lineParts: a.root.userData.sourceParts.filter(name => name.startsWith('face-line-')), camera: w.camera.position.toArray() };
  });
}
async function faceCapture(page, backend, tone, line, angle) {
  const clip = await read(page, w => {
    const a = w.avatar, rect = w.renderer.domElement.getBoundingClientRect(), projected = [];
    for (const x of [-.34, .34]) for (const y of [-.16, .51]) for (const z of [-.23, .29]) {
      const p = a.root.position.clone().set(x, y, z); a.anchors.head.localToWorld(p); p.project(w.camera);
      projected.push([rect.x + (p.x + 1) * rect.width / 2, rect.y + (1 - p.y) * rect.height / 2]);
    }
    const x = Math.max(rect.x, Math.floor(Math.min(...projected.map(p => p[0])) - 8)), y = Math.max(rect.y, Math.floor(Math.min(...projected.map(p => p[1])) - 8));
    return { x, y, width: Math.min(rect.right, Math.ceil(Math.max(...projected.map(p => p[0])) + 8)) - x, height: Math.min(rect.bottom, Math.ceil(Math.max(...projected.map(p => p[1])) + 8)) - y };
  });
  const name = `${backend}-${tone}-${line}-${angle}.png`;
  await page.screenshot({ path: `${out}/${name}`, clip });
  captures.push({ backend, tone, line, angle, file: name, clip });
  return clip;
}
async function comparison(backend) {
  const rows = [];
  for (const tone of ['light', 'deep']) for (const angle of ['front', 'oblique']) {
    const cells = await Promise.all(['none', 'soft', 'defined'].map(async line => {
      const bytes = await fs.readFile(`${out}/${backend}-${tone}-${line}-${angle}.png`);
      return `<figure><figcaption>${line[0].toUpperCase() + line.slice(1)}</figcaption><img src="data:image/png;base64,${bytes.toString('base64')}" alt="${tone} skin, ${line} face lines, ${angle} view"></figure>`;
    }));
    rows.push(`<h2>${tone === 'light' ? 'Light' : 'Deep'} skin · ${angle}</h2><section>${cells.join('')}</section>`);
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });
  await page.setContent(`<html><head><style>body{margin:0;padding:24px;background:#f7f5e9;color:#234c48;font:15px system-ui}h1{font-size:25px;margin:0 0 15px}h2{font-size:15px;margin:22px 0 6px}section{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}figure{margin:0;background:#e3ecd8;border-radius:10px;overflow:hidden}figcaption{padding:7px 12px;font-weight:600}img{display:block;width:100%;height:330px;object-fit:contain}</style></head><body><h1>Optional face lines · ${backend === 'webgpu' ? 'WebGPU' : 'WebGL 2'}</h1>${rows.join('')}</body></html>`);
  await page.screenshot({ path: `${out}/comparison-${backend}.png`, fullPage: true }); await page.close();
}
try {
  for (const backend of ['webgpu', 'webgl']) {
    const context = await browser.newContext({ viewport: { width: 2040, height: 1100 }, reducedMotion: 'reduce' });
    await context.addInitScript(collection => { if (!localStorage.getItem('monterey-bay-cozy.avatars.v1')) localStorage.setItem('monterey-bay-cozy.avatars.v1', JSON.stringify(collection)); }, legacyCollection);
    const page = await context.newPage(); observe(page, backend);
    await page.goto(`${url}?tab=avatars${backend === 'webgl' ? '&webgl' : ''}`, { waitUntil: 'networkidle' }); await ready(page);
    check((await snapshot(page)).backend === (backend === 'webgpu' ? 'WebGPU' : 'WebGL 2'), backend + ' actual renderer backend');
    check((await snapshot(page)).design.faceLines === 'none' && (await snapshot(page)).currentId === legacyCollection.selectedId, backend + ' old version-1 save without faceLines loads None');
    await page.locator('#av-category-face').click();
    check((await page.locator('[data-design="faceLines"]').allTextContents()).join('|') === 'None|Soft|Defined', backend + ' Face tab offers None, Soft, Defined');
    check(await page.locator('[data-design="faceLines"][data-value="none"]').getAttribute('aria-pressed') === 'true', backend + ' legacy character visibly selects None');
    await choose(page, 'hairStyle', 'bun', 'hair'); await detail(page, 'near'); await closeView(page);
    const optionRows = [], lodRows = [];
    const measured = { backend, optionRows, lodRows }; measurements.push(measured);
    for (const [tone, color] of [['light', '#f5d5b7'], ['deep', '#432a24']]) {
      await choose(page, 'skinTone', color, 'you');
      for (const angle of ['front', 'oblique']) {
        if (angle === 'oblique') await orbit(page, 100);
        const fingerprints = [];
        for (const line of ['none', 'soft', 'defined']) {
          await choose(page, 'faceLines', line);
          check(await page.locator(`[data-design="faceLines"][data-value="${line}"]`).getAttribute('aria-pressed') === 'true' && await page.locator('[data-design="faceLines"][aria-pressed="true"]').count() === 1, `${backend} ${tone} ${angle} ${line} updates the selected control`);
          const row = await measure(page); fingerprints.push(row.geometryFingerprint); optionRows.push({ tone, angle, line, ...row });
          check(row.snapshot.model.drawCalls === 1 && row.materials === 1 && row.imageTextures === 0 && row.imageMaps.length === 0, `${backend} ${tone} ${angle} ${line} keeps one core draw/material and zero image maps`);
          const clip = await faceCapture(page, backend, tone, line, angle);
          check(clip.width >= 250 && clip.height >= 250, `${backend} ${tone} ${angle} ${line} has a readable close-up capture`);
        }
        check(new Set(fingerprints).size === 3, `${backend} ${tone} ${angle} each face-line option changes rendered geometry`);
      }
      await orbit(page, -100);
    }
    // Compare actual submissions at matched camera positions. Renderer-owned
    // passes mean total GPU submissions need not equal the visible mesh count.
    const stableDraws = ['light', 'deep'].every(tone => ['front', 'oblique'].every(angle => new Set(optionRows.filter(row => row.tone === tone && row.angle === angle).map(row => row.snapshot.renderer.drawCalls)).size === 1));
    check(stableDraws && optionRows.every(row => row.snapshot.renderer.drawCalls > 0), backend + ' face-line options add no actual GPU submissions in matching views');
    for (const line of ['none', 'soft', 'defined']) {
      await choose(page, 'faceLines', line);
      for (const level of ['near', 'mid', 'far']) {
        await detail(page, level); const row = await measure(page); lodRows.push({ line, level, ...row });
        check(row.skinValid && row.bones === 17 && row.scale.every(value => value === 1), `${backend} ${line} ${level} retains valid skinning and metre scale`);
        check(row.snapshot.model.drawCalls === 1 && row.snapshot.model.triangles <= 5000 && row.imageMaps.length === 0, `${backend} ${line} ${level} stays within draw/triangle/texture budgets`);
        if (line === 'defined') await faceCapture(page, backend, 'deep', line, level);
      }
    }
    const near = lodRows.filter(row => row.level === 'near').map(row => row.snapshot.model.triangles);
    check(near[1] - near[0] === 20 && near[2] - near[0] === 58, backend + ' Soft adds 20 triangles and Defined adds 58');
    await detail(page, 'near');
    for (const eye of ['round', 'almond', 'sleepy']) {
      await choose(page, 'eyeStyle', eye); check((await snapshot(page)).design.faceLines === 'defined', backend + ' ' + eye + ' eyes retain Defined face lines');
      await faceCapture(page, backend, 'deep', 'defined', 'eyes-' + eye);
    }
    await choose(page, 'eyeStyle', 'round'); await page.locator('#avatar-name').fill('Harbor'); await page.locator('#avatar-save').click();
    const saved = await snapshot(page); check(!saved.dirty && saved.design.faceLines === 'defined', backend + ' Defined saves on an existing character');
    await page.reload({ waitUntil: 'networkidle' }); await ready(page);
    check((await snapshot(page)).design.faceLines === 'defined' && (await snapshot(page)).currentId === saved.currentId, backend + ' saved Defined survives reload');
    await choose(page, 'topStyle', 'hoodie', 'outfit');
    check((await snapshot(page)).design.faceLines === 'defined' && (await snapshot(page)).design.topStyle === 'hoodie', backend + ' changing outfits preserves face lines');
    await page.locator('.av-library summary').click(); const downloadEvent = page.waitForEvent('download'); await page.locator('#avatar-export').click();
    const exported = JSON.parse(await fs.readFile(await (await downloadEvent).path(), 'utf8'));
    check(exported.version === 1 && exported.design.faceLines === 'defined', backend + ' exported version-1 recipe includes Defined');
    await choose(page, 'faceLines', 'none');
    await page.locator('#avatar-import').setInputFiles({ name: 'defined.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) }); await page.waitForTimeout(180);
    check((await snapshot(page)).design.faceLines === 'defined' && (await snapshot(page)).design.topStyle === 'hoodie', backend + ' imported recipe restores Defined and outfit');
    const oldFile = { ...exported, design: { ...exported.design } }; delete oldFile.design.faceLines;
    await page.locator('#avatar-import').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(oldFile)) }); await page.waitForTimeout(180);
    check((await snapshot(page)).design.faceLines === 'none', backend + ' legacy version-1 import without faceLines defaults to None');
    measured.final = await snapshot(page);
    await context.close(); await comparison(backend);
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }), phone = await context.newPage(); observe(phone, 'phone');
  await phone.goto(url + '?tab=avatars&webgl', { waitUntil: 'networkidle' }); await ready(phone); await phone.locator('#av-category-face').tap();
  for (const line of ['none', 'soft', 'defined']) {
    const button = phone.locator(`[data-design="faceLines"][data-value="${line}"]`); await button.scrollIntoViewIfNeeded(); await button.tap(); await phone.waitForTimeout(100);
    const bounds = await button.boundingBox();
    check((await snapshot(phone)).design.faceLines === line && await button.getAttribute('aria-pressed') === 'true', `390px touch ${line} control changes the preview`);
    check(bounds.width >= 44 && bounds.height >= 44 && bounds.x >= 0 && bounds.x + bounds.width <= 390, `390px ${line} control is a usable touch target`);
  }
  check(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '390px Face controls have no horizontal overflow');
  await phone.screenshot({ path: `${out}/face-controls-phone.png` }); await context.close();
  check(errors.length === 0, 'No browser or shader errors: ' + errors.join('; '));
  check(imageRequests.filter(value => !value.includes('favicon')).length === 0, 'Face lines add no image texture downloads');
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  const sourceAfter = await digest(), changedSources = sourceAfter.filter((row, i) => row.sha256 !== sourceBefore[i].sha256).map(row => row.file);
  if (changedSources.length && !failure) { failure = 'Source changed during browser verification: ' + changedSources.join(', '); process.exitCode = 1; console.error(failure); }
  await fs.writeFile(`${out}/browser-qa.json`, JSON.stringify({ date: new Date().toISOString(), passed: failure === null, failure, url, sourceBefore, sourceAfter, changedSources, checks, errors, imageRequests, measurements, captures, viteEvents, environment: 'Chrome on this Mac: native WebGPU and forced WebGL 2. 390px touch is emulated, not physical mobile hardware.' }, null, 2) + '\n');
  await browser.close();
}
