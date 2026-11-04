import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const out = process.env.ARTIFACT_DIR ?? 'artifacts/western-gull', url = process.env.REVIEW_URL ?? 'http://127.0.0.1:5191/';
const uiEnabled = process.env.GULL_SKIP_UI !== '1';
await fs.mkdir(out, { recursive: true });
const paths = (await fs.readdir('src/models/habitat/western-gull')).filter(p => p.endsWith('.ts')).map(p => `src/models/habitat/western-gull/${p}`);
if (uiEnabled) paths.push('src/main.ts', 'src/models/props/catalogue.ts', 'src/models/props/dimensions.ts', 'src/viewer/objects.ts');
const hashes = async () => Object.fromEntries(await Promise.all(paths.map(async p => [p, createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
const before = await hashes(), checks = [], errors = [], records = [];
const check = (ok, message) => { if (!ok) throw new Error(message); checks.push(message); console.log('PASS', message); };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });
const run = (page, fn, arg) => page.evaluate(({ fn, arg }) => new Function('r', 'arg', `return (${fn})(r,arg)`)(window.gullReview, arg), { fn: fn.toString(), arg });
async function context(width = 1000) {
  const ctx = await browser.newContext({ viewport: { width, height: 760 }, reducedMotion: 'reduce' });
  const address = new URL(url);
  await ctx.routeWebSocket(u => u.hostname === address.hostname && u.port === address.port, socket => socket.send(JSON.stringify({ type: 'connected' })));
  return ctx;
}
function watch(page, backend) {
  page.on('pageerror', e => errors.push(`${backend}: ${e.message}`));
  page.on('console', e => { if (e.type() === 'error' && !e.text().includes('ERR_CERT_AUTHORITY_INVALID')) errors.push(`${backend}: ${e.text()}`); });
}
async function waitReady(page, expression, label) {
  for (let i = 0; i < 250; i++) { if (await page.evaluate(expression)) return; await page.waitForTimeout(120); }
  throw new Error(`Timed out waiting for ${label}: ${errors.slice(-4).join(' | ')}`);
}
async function imageDifference(page, a, b) {
  return page.evaluate(async ([a, b]) => {
    const decode = data => new Promise(resolve => { const image = new Image(); image.onload = () => resolve(image); image.src = `data:image/png;base64,${data}`; });
    const images = await Promise.all([decode(a), decode(b)]), canvas = document.createElement('canvas');
    canvas.width = images[0].width; canvas.height = images[0].height; const context = canvas.getContext('2d', { willReadFrequently: true });
    const pixels = images.map(image => { context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0); return context.getImageData(0, 0, canvas.width, canvas.height).data; });
    let foreground = 0, changed = 0;
    for (let i = 0; i < pixels[0].length; i += 4) {
      if (!pixels.some(p => Math.max(...[0, 1, 2].map(c => Math.abs(p[i + c] - p[c]))) > 3)) continue;
      foreground++; if (Math.max(...[0, 1, 2].map(c => Math.abs(pixels[0][i + c] - pixels[1][i + c]))) > 6) changed++;
    }
    return { foregroundPixels: foreground, changedPixels: changed, changedFraction: changed / Math.max(1, foreground) };
  }, [a.toString('base64'), b.toString('base64')]);
}
try {
  for (const backend of ['webgpu', 'webgl']) {
    const ctx = await context(), page = await ctx.newPage(); watch(page, backend);
    await page.goto(`${url}tests/gull-review.html${backend === 'webgl' ? '?webgl' : ''}`);
    await waitReady(page, () => !!window.gullReview, 'gull fixture');
    check((await run(page, r => r.snapshot().backend)).toLowerCase().includes(backend), `${backend}: actual renderer backend is correct`);
    for (const sex of ['male', 'female']) {
      await run(page, async (r, sex) => { await r.single(sex); }, sex);
      for (const pose of ['flight', 'standing', 'walking', 'pooping']) {
        for (const level of ['near', 'mid', 'far']) {
          const row = await run(page, async (r, { pose, level }) => { r.pose(pose); r.update(pose === 'pooping' ? .58 : .16); r.lod.setMode(level); r.frame(); return r.render(); }, { pose, level });
          records.push({ backend, sex, pose, level, ...row });
          check(row.stats[level].draws === 1 && row.rendered.drawCalls === 1 && row.rendered.triangles === row.stats[level].triangles, `${backend}: ${sex} ${pose} ${level} one draw/exact triangles`);
          check(row.scale.every(v => v === 1), `${backend}: ${sex} ${pose} ${level} metre scale`);
          await page.screenshot({ path: `${out}/${backend}-${sex}-${pose}-${level}.png` });
        }
      }
      await run(page, async r => { r.pose('standing'); r.lod.setMode('near'); r.frame(true); await r.render(); });
      await page.screenshot({ path: `${out}/${backend}-${sex}-standing-profile.png` });
      const standing = await page.screenshot();
      await run(page, async r => { r.update(.2); await r.render(); });
      check(standing.equals(await page.screenshot()), `${backend}: ${sex} standing remains still`);
      await run(page, async r => { r.pose('walking'); r.frame(); r.update(.1); await r.render(); });
      const walking = await page.screenshot();
      await run(page, async r => { r.update(.18); await r.render(); });
      check(!walking.equals(await page.screenshot()), `${backend}: ${sex} walking visibly moves`);
      await run(page, async r => { r.pose('pooping'); r.update(.58); await r.render(); });
      check(await run(page, r => r.snapshot().state.poopActive), `${backend}: ${sex} poop action releases its bounded effect`);
      await run(page, async r => { r.update(2); await r.render(); });
      check(await run(page, r => !r.snapshot().state.poopActive && r.snapshot().state.pose === 'standing'), `${backend}: ${sex} poop action cleans up and returns to standing`);
      await run(page, async r => { r.pose('flight'); r.update(.1); r.lod.setMode('near'); await r.render(); });
      const initial = await page.screenshot(), root = await run(page, r => r.root.position.toArray());
      await run(page, async r => { r.update(.11); await r.render(); });
      check(!initial.equals(await page.screenshot()), `${backend}: ${sex} single wings visibly flap`);
      check(JSON.stringify(root) === JSON.stringify(await run(page, r => r.root.position.toArray())), `${backend}: ${sex} animation leaves placement unchanged`);
      const paused = await page.screenshot(); await run(page, async r => { await r.render(); });
      check(paused.equals(await page.screenshot()), `${backend}: ${sex} paused pose remains stable`);
      for (const angle of ['side', 'top', 'underside']) {
        await run(page, async (r, angle) => {
          r.pose('flight'); r.update(4.2); r.lod.setMode('near');
          const positions = { side: [-2.1, .45, .01], top: [0, 2.8, .001], underside: [0, -2.1, .001] };
          r.camera.position.set(...positions[angle]); r.camera.lookAt(0, .34, 0); await r.render();
        }, angle);
        await page.screenshot({ path: `${out}/${backend}-${sex}-flight-${angle}.png` });
      }
    }
    for (const time of [.1, .23, 4.2, 6.8]) {
      await run(page, async (r, time) => {
        await r.single('male', 'flight'); r.lod.setMode('near'); r.update(time);
        r.camera.position.set(-1.3, .95, -1.6); r.camera.lookAt(0, .34, 0); await r.render();
      }, time);
      const reference = await page.screenshot();
      await run(page, async (r, time) => {
        await r.group('male', 1); r.flock.setTransformAt(0, new r.Matrix4()); r.flock.commitTransforms();
        r.flock.setFlightAt(0, { phaseRadians: 0, rateScale: 1, glideOffsetSeconds: 0 }); r.update(time);
        r.camera.position.set(-1.3, .95, -1.6); r.camera.lookAt(0, .34, 0); await r.render();
      }, time);
      const difference = await imageDifference(page, reference, await page.screenshot());
      records.push({ backend, kind: 'single-flock-parity', time, ...difference });
      check(difference.foregroundPixels > 1000 && difference.changedFraction < .04, `${backend}: flight rig and GPU hinges agree at ${time}s (${(difference.changedFraction * 100).toFixed(2)}% raster difference)`);
    }
    await run(page, async r => { await r.group('male', 32); });
    for (const count of [0, 1, 32, 256, 1024]) for (const level of ['near', 'mid', 'far']) {
      const row = await run(page, async (r, { count, level }) => { r.flock.setCount(count); r.lod.setMode(level); r.frame(); return r.render(); }, { count, level });
      records.push({ backend, count, level, ...row });
      check(row.rendered.drawCalls === (count ? 1 : 0) && row.rendered.triangles === row.stats[level].triangles, `${backend}: flock ${count} ${level} measured submissions match declared cost`);
      if (count === 32 || count === 1024) await page.screenshot({ path: `${out}/${backend}-flock-${count}-${level}.png` });
    }
    await run(page, async r => {
      r.flock.setCount(1); r.flock.setTransformAt(0, new r.Matrix4()); r.flock.commitTransforms();
      r.flock.setFlightAt(0, { phaseRadians: 0, rateScale: 1, glideOffsetSeconds: 0 });
      r.lod.setMode('near'); r.frame(); await r.render();
    });
    const flight = await page.screenshot();
    const immutable = await run(page, r => ({ matrix: r.flock.mesh.instanceMatrix.version, parameters: r.flock.mesh.geometry.getAttribute('gullInstance').version }));
    await run(page, async r => { r.flock.update(.12); await r.render(); });
    check(!flight.equals(await page.screenshot()), `${backend}: instanced shoulder/wrist wings visibly flap`);
    const after = await run(page, r => ({ matrix: r.flock.mesh.instanceMatrix.version, parameters: r.flock.mesh.geometry.getAttribute('gullInstance').version }));
    check(JSON.stringify(immutable) === JSON.stringify(after), `${backend}: flock GPU animation uploads no transform or parameter buffers`);
    for (const [distance, expected] of [[2, 'near'], [30, 'mid'], [1000, 'far'], [2, 'near']]) {
      const active = await run(page, async (r, distance) => { r.lod.setMode('auto'); r.camera.position.set(0, .34, distance); r.camera.lookAt(0, .34, 0); await r.render(); return r.lod.inspect(r.root)[0].level; }, distance);
      check(active === expected, `${backend}: automatic distance ${distance} m selects ${expected}`);
    }
    await page.close();
    if (uiEnabled) {
      const ui = await ctx.newPage(); watch(ui, backend);
      await ui.goto(`${url}?tab=objects${backend === 'webgl' ? '&webgl' : ''}`);
      await ui.evaluate(async () => { window.gullViewer = (await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src)).viewer; await window.gullViewer.started; });
      for (const sex of ['male', 'female']) {
        await ui.selectOption('#object-select', `western-gull-${sex}`);
        await ui.evaluate(async () => { await window.gullViewer.lod.ready(); });
        check(await ui.locator('#object-pose option').count() === 4, `${backend}: ${sex} library exposes all four actions`);
        check(await ui.evaluate(() => !window.gullViewer.state.objectMotion), `${backend}: ${sex} reduced motion stays paused`);
        await ui.selectOption('#object-pose', 'pooping');
        check(await ui.locator('#object-motion').isVisible(), `${backend}: ${sex} poop action has an explicit play control`);
        await ui.click('#object-motion'); await ui.waitForTimeout(1900);
        check((await ui.locator('#object-motion').textContent()).includes('Replay'), `${backend}: ${sex} completed poop action can replay`);
        await ui.click('#object-motion');
        await ui.screenshot({ path: `${out}/${backend}-${sex}-library.png` });
        for (const count of [32, 256, 1024, 1]) {
          await ui.selectOption('#object-group', String(count));
          await ui.evaluate(async () => { await window.gullViewer.lod.ready(); });
          check(await ui.locator('#object-pose option').count() === (count > 1 ? 1 : 4), `${backend}: ${sex} group ${count} exposes supported actions only`);
          check(await ui.evaluate(count => window.gullViewer.state.objectInstances === count, count), `${backend}: ${sex} group ${count} selected`);
        }
      }
      await ui.setViewportSize({ width: 320, height: 844 }); await ui.screenshot({ path: `${out}/${backend}-mobile-320.png` });
      check(await ui.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${backend}: 320px library has no horizontal overflow`);
      await ui.close();
    }
    await ctx.close();
  }
  check(errors.length === 0, `No browser or shader errors: ${errors.slice(0, 5).join(' | ')}`);
  const after = await hashes(); check(JSON.stringify(before) === JSON.stringify(after), 'Source files stayed stable during final capture');
  await fs.writeFile(`${out}/browser-metrics.json`, JSON.stringify({ date: new Date().toISOString(), uiEnabled, checks, errors, records, sourceHashes: { before, after } }, null, 2) + '\n');
} finally {
  await fs.writeFile(`${out}/browser-progress.json`, JSON.stringify({ checks, errors, records }, null, 2) + '\n');
  await browser.close();
}
console.log(`PASS ${checks.length} gull browser checks`);
