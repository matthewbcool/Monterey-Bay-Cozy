import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const url = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5191/';
const out = 'artifacts/lovers-point-statues', stage = process.env.REVIEW_STAGE ?? 'final';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });
await fs.mkdir(out, { recursive: true });
const checks = [], errors = [], measurements = [];
const trackedSources = ['src/models/props/loversPointStatues/boy.ts','src/models/props/loversPointStatues/butterfly.ts','src/models/props/catalogue.ts','src/models/props/dimensions.ts','src/data/lovers-point-artworks.ts','src/viewer/testingGym/statues.ts','src/viewer/testingGym.ts','src/viewer/mapStudy/loversPoint.ts','src/viewer/objects.ts','src/models/shared/lod/geometry.ts'];
const sourceHashes = async () => Object.fromEntries(await Promise.all(trackedSources.map(async path => [path,createHash('sha256').update(await fs.readFile(path)).digest('hex')])));
const before = await sourceHashes();
const check = (condition, name) => { if (!condition) throw Error(name); checks.push(name); console.log('PASS', name); };
const read = (page, fn, arg) => page.evaluate(async ({ fn, arg }) => {
  const viewer = window.__statueViewer ?? (await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src)).viewer;
  return new Function('v', 'arg', `return (${fn})(v,arg)`)(viewer, arg);
}, { fn: fn.toString(), arg });
async function stableContext(options) {
  const context = await browser.newContext(options), preview = new URL(url);
  await context.routeWebSocket(u => u.hostname === preview.hostname && u.port === preview.port && u.searchParams.has('token'), socket => socket.send(JSON.stringify({ type: 'connected' })));
  return context;
}
async function ready(page, suffix = '') {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error' && !e.text().includes('ERR_CERT_AUTHORITY_INVALID')) errors.push(e.text()); });
  await page.goto(`${url}?tab=objects${suffix}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async()=>{
    window.__statueViewer=(await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src)).viewer;
    await window.__statueViewer.started;
  });
}
async function capture(page, id, angle, backend, level = 'near') {
  await page.selectOption('#object-select', id);
  await read(page, async (v, { angle, level }) => {
    const { Box3, Vector3 } = await import('/node_modules/three/build/three.module.js');
    v.state.turntable = false; v.objects.turntable.rotation.y = 0;
    await v.lod.register(v.objects.root); v.setLodMode(level);
    const box = new Box3().setFromObject(v.objects.selected), size = box.getSize(new Vector3()), center = box.getCenter(new Vector3());
    const views = { front: [0,.12,1.85], oblique: [1.2,.28,1.7], side: [1.9,.2,.12], back: [-.8,.25,-1.85] };
    v.controls.enableDamping = false; v.controls.target.copy(center);
    v.camera.position.copy(center).add(new Vector3(...views[angle]).multiplyScalar(size.y)); v.camera.lookAt(center); v.controls.update();
    v.lod.update(v.camera, innerHeight, 0, true);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, { angle, level });
  await page.waitForTimeout(180);
  await page.locator('#stage canvas').screenshot({ path: `${out}/${id}-${stage}-${backend}-${level}-${angle}.png` });
  const result = await read(page, v => ({ id: v.state.objectId, backend: v.renderer.backend.constructor.name, levels: v.lod.stats(v.objects.selected), rendered: { ...v.renderer.info.render }, scale: v.objects.selected.scale.toArray(), parts: v.objects.selected.userData.sourceParts }));
  measurements.push({ stage, angle, level, ...result });
  check(result.scale.every(n => n === 1), `${backend} ${id} ${level} keeps metre scale`);
  check(result.levels.near.draws === 1 && result.levels.far.draws === 1, `${backend} ${id} one draw at every distance`);
  if (stage === 'final') check(result.levels.far.triangles < result.levels.mid.triangles && result.levels.mid.triangles < result.levels.near.triangles, `${backend} ${id} LOD reduces triangles`);
}

async function gymAndMap(page, backend) {
  await page.click('#tab-gym');
  await page.waitForFunction(() => {
    const viewer = window.__statueViewer;
    return !!viewer?.avatarWorkbench?.controller && viewer.avatarWorkbench.gym?.statues.length === 2 && viewer.avatarWorkbench.lod.stats(viewer.avatarWorkbench.gym.root).ready;
  },undefined,{timeout:60000});
  for (const id of ['sailing-boy-statue','butterfly-statue']) {
    // Position setup is an inspection fixture; the E interaction itself uses
    // the real keyboard handler and actual collision-valid approach anchor.
    const accepted = await read(page, (v,id) => {
      const w=v.avatarWorkbench, interaction=w.gym.interactions.find(i=>i.id===id), saved=w.controller.getState();
      w.setActive('gym'); return w.controller.restoreState({...saved,position:interaction.position.toArray(),velocity:[0,0]});
    },id);
    check(accepted, `${backend} ${id} approach accepted by controller`);
    await page.waitForTimeout(120); await page.locator('#gym-viewport canvas').focus(); await page.keyboard.press('KeyE');
    check(await read(page,(v,id)=>v.avatarWorkbench.getSnapshot().interacted.includes(id),id), `${backend} ${id} keyboard inspection works`);
    const result = await read(page,async (v,id)=>{
      const {Box3,Vector3}=await import('/node_modules/three/build/three.module.js');
      const w=v.avatarWorkbench, scene=w.scene, item=w.gym.statues.find(s=>s.record.id===id);
      w.setActive(null); scene.updateMatrixWorld(true);
      const center=new Box3().setFromObject(item.object).getCenter(new Vector3());
      const offset=new Vector3(2.2,1.1,3.6).applyAxisAngle(new Vector3(0,1,0),item.object.rotation.y);
      w.camera.position.copy(center).add(offset);w.camera.lookAt(center);w.camera.updateMatrixWorld(true);
      const levels=[];
      for(const mode of ['near','mid','far']){w.lod.setMode(mode);w.lod.update(w.camera,900,0,true);levels.push({mode,statues:w.gym.statues.map(s=>({id:s.record.id,pose:s.object.matrixWorld.toArray(),collider:s.collider,active:w.lod.inspect(s.object)}))});}
      w.lod.setMode('auto');w.lod.update(w.camera,900,0,true);scene.getObjectByName('Gradient sky dome')?.position.copy(w.camera.position);
      const reset=w.renderer.info.autoReset;w.renderer.info.autoReset=false;w.renderer.info.reset();w.renderer.render(scene,w.camera);
      const rendered={...w.renderer.info.render};w.renderer.info.autoReset=reset;
      return {id,world:w.lod.stats(w.gym.root),statue:w.lod.stats(item.object),levels,rendered,coordinates:item.record.coordinates,anchor:item.object.position.toArray()};
    },id);
    measurements.push({backend,view:'gym',...result});
    const poses = result.levels.map(entry => JSON.stringify(entry.statues.map(s=>({id:s.id,pose:s.pose,collider:s.collider}))));
    check(poses.every(p=>p===poses[0]),`${backend} ${id} LOD leaves placement and collision fixed`);
    await page.locator('#gym-viewport canvas').screenshot({path:`${out}/${id}-gym-${backend}.png`});
    await read(page,v=>v.avatarWorkbench.setActive('gym'));
  }
  await page.click('#tab-map');
  await page.waitForFunction(()=>{const viewer=window.__statueViewer;return viewer.mapStudy?.lod.stats(viewer.mapStudy.park.root).ready;},undefined,{timeout:60000});
  await page.locator('[data-view="park"]').click();
  const map = await read(page,v=>({world:v.mapStudy.lod.stats(v.mapStudy.park.root),statues:v.mapStudy.park.statues.map(s=>({id:s.record.id,pose:s.object.matrixWorld.toArray(),coordinates:s.record.coordinates,scale:s.object.scale.toArray()}))}));
  check(map.statues.length===2 && map.statues.every(s=>s.scale.every(n=>n===1)),`${backend} both statues enter Map Study at metre scale`);
  measurements.push({backend,view:'map',...map});
  await page.screenshot({path:`${out}/park-map-${backend}.png`});
  await page.uncheck('#map-park');check(await read(page,v=>!v.mapStudy.park.root.visible),`${backend} map comparison hides the entire detailed park`);
}
try {
  for (const backend of stage === 'blockout' ? ['webgl'] : ['webgpu','webgl']) {
    const context = await stableContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); await ready(page, backend === 'webgl' ? '&webgl' : '');
    for (const id of process.env.WORLD_ONLY ? [] : ['sailing-boy-statue','butterfly-statue']) {
      for (const angle of ['front','oblique','side','back']) await capture(page, id, angle, backend);
      if (stage === 'final') for (const level of ['mid','far']) await capture(page,id,'oblique',backend,level);
    }
    if(stage==='final'){
      await page.click('#object-compare');
      check(await read(page,async v=>{const {propCollection}=await import('/src/models/props/catalogue.ts');return v.objects.comparison.children.filter(o=>o.userData.assetId).length===propCollection.length;}),`${backend} all registered objects compare without missing positions`);
      await page.screenshot({path:`${out}/comparison-${backend}.png`});
      await page.click('#object-compare');
      await gymAndMap(page,backend);
    }
    await context.close();
  }
  if(stage==='final'){
    const context=await stableContext({viewport:{width:320,height:780},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();
    await ready(page,'&webgl');
    for(const id of ['sailing-boy-statue','butterfly-statue']){
      await page.selectOption('#object-select',id);await page.waitForTimeout(180);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`320px ${id} has no horizontal overflow`);
      await page.screenshot({path:`${out}/${id}-mobile-320.png`});
      await page.selectOption('#lod-select','mid');
      const [download]=await Promise.all([page.waitForEvent('download'),page.click('#export-object')]);
      const bytes=await fs.readFile(await download.path());
      check(bytes.readUInt32LE(0)===0x46546c67&&bytes.readUInt32LE(4)===2,`${id} exports valid GLB container`);
      const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
      check(json.meshes.length===1&&json.images===undefined,`${id} export retains one batch and no image maps`);
    }
    await context.close();
  }
  check(errors.length === 0, `No browser/shader errors: ${errors.join('; ')}`);
} finally {
  const after=await sourceHashes();
  await fs.writeFile(`${out}/${stage}-browser-metrics.json`, JSON.stringify({ stage, checks, errors, measurements, sourceHashes:{before,after},sourceStable:JSON.stringify(before)===JSON.stringify(after) }, null, 2));
  await browser.close();
}
