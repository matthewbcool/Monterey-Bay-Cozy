import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const out = 'artifacts/monarch-butterfly', url = 'http://127.0.0.1:5191/';
const stage = process.env.REVIEW_STAGE ?? 'final';
const checks = [], errors = [], measurements = [];
const paths = ['definition','body','wings','motion','createMonarchButterfly'].map(name=>`src/models/habitat/monarch-butterfly/${name}.ts`);
const hashes = async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
const before = await hashes();
const check=(value,label)=>{if(!value)throw Error(label);checks.push(label);console.log('PASS',label);};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const read=(page,fn,arg)=>page.evaluate(({fn,arg})=>new Function('v','arg',`return (${fn})(v,arg)`)(window.__monarchViewer,arg),{fn:fn.toString(),arg});
async function open(backend, width=1280){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  await context.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.port==='5191'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
  const page=await context.newPage();
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
  page.on('console',e=>{if(e.type()==='error'&&!e.text().includes('ERR_CERT_AUTHORITY_INVALID'))errors.push(e.text());});
  await page.goto(`${url}?tab=objects${backend==='webgl'?'&webgl':''}`);
  await page.evaluate(async()=>{window.__monarchViewer=(await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src)).viewer;await window.__monarchViewer.started;});
  // Stable source specimen without changing the factory's normal random behavior.
  await page.evaluate(()=>{window.__originalRandom=Math.random;let first=true;Math.random=()=>{if(first){first=false;return 42/2**32;}return window.__originalRandom();};});
  await page.selectOption('#object-select','monarch-butterfly');
  await page.evaluate(()=>{Math.random=window.__originalRandom;});
  await read(page,async v=>{await v.lod.register(v.objects.root);v.state.turntable=false;});
  return {page,context};
}
async function pose(page, state, angle='oblique', level='near'){
  await page.selectOption('#object-pose',state);
  await read(page,async(v,{state,angle,level})=>{
    const angleNow=Math.abs(v.objects.selected.children.find(n=>n.isSkinnedMesh).skeleton.bones[1].rotation.z);
    if(state==='perched'&&angleNow<1)throw Error('Folded pose selector did not fold the wings');
    if(state==='basking'&&angleNow>.2)throw Error('Open pose selector did not spread the wings');
    const {Vector3,Box3}=await import('/node_modules/three/build/three.module.js');
    v.state.objectMotion=false;v.objects.turntable.rotation.y=0;
    const center=v.objects.selected.position.clone();
    const offsets={dorsal:[0,.15,.0001],oblique:[.09,.09,.12],ventral:[0,-.15,.0001],side:[.14,.025,.035]};
    v.controls.enableDamping=false;v.controls.target.copy(center);v.controls.minPolarAngle=0;v.controls.maxPolarAngle=Math.PI;v.controls.minDistance=.015;
    v.camera.position.copy(center).add(new Vector3(...offsets[angle]));v.camera.lookAt(center);v.controls.update();
    // The display stand would occlude the underside, so hide only it for this diagnostic view.
    v.objects.root.children.find(n=>n.isMesh).visible=angle!=='ventral';
    v.setLodMode(level);v.lod.update(v.camera,innerHeight,0,true);
    v.objects.selected.updateMatrixWorld(true);
    const mesh=v.objects.selected.children.find(n=>n.isSkinnedMesh);mesh.skeleton.update();
    return new Box3().setFromObject(v.objects.selected,true).getSize(new Vector3()).toArray();
  },{state,angle,level});
  await page.waitForTimeout(140);
}
try{
  for(const backend of stage==='final'?['webgpu','webgl']:['webgl']){
    const {page,context}=await open(backend);
    check(await read(page,v=>!v.state.objectMotion),`${backend} reduced motion starts still`);
    await page.screenshot({path:`${out}/${stage}-${backend}-library.png`});
    check(await read(page,v=>v.objects.selected.userData.seed===42),`${backend} review seed is reproducible`);
    if(stage==='final'){
      const initial=await read(page,v=>({root:v.objects.selected.position.toArray(),bones:v.objects.selected.children.find(n=>n.isSkinnedMesh).skeleton.bones.map(b=>b.quaternion.toArray())}));
      await page.click('#object-motion');await page.waitForTimeout(220);
      const moving=await read(page,v=>({root:v.objects.selected.position.toArray(),bones:v.objects.selected.children.find(n=>n.isSkinnedMesh).skeleton.bones.map(b=>b.quaternion.toArray())}));
      check(JSON.stringify(initial.bones)!==JSON.stringify(moving.bones)&&JSON.stringify(initial.root)===JSON.stringify(moving.root),`${backend} Play motion animates wings without moving the world root`);
      await page.click('#object-motion');
      const paused=await read(page,v=>v.objects.selected.children.find(n=>n.isSkinnedMesh).skeleton.bones.map(b=>b.quaternion.toArray()));
      await page.waitForTimeout(150);
      check(JSON.stringify(paused)===JSON.stringify(await read(page,v=>v.objects.selected.children.find(n=>n.isSkinnedMesh).skeleton.bones.map(b=>b.quaternion.toArray()))),`${backend} pause holds the wing pose`);
    }
    for(const [state,angle] of [['basking','dorsal'],['basking','oblique'],['basking','ventral'],['perched','side']]){
      await pose(page,state,angle);await page.screenshot({path:`${out}/${stage}-${backend}-${state}-${angle}.png`});
    }
    for(const time of [.06,.18,4.2]){
      await pose(page,'flight');
      await read(page,(v,time)=>v.objects.update(time),time);
      await page.waitForTimeout(100);await page.screenshot({path:`${out}/${stage}-${backend}-flight-${time}.png`});
    }
    for(const level of ['near','mid','far']){
      await pose(page,'basking','oblique',level);
      await page.screenshot({path:`${out}/${stage}-${backend}-${level}.png`});
      const result=await read(page,v=>({backend:v.renderer.backend.constructor.name,levels:v.lod.stats(v.objects.selected),active:v.lod.inspect(v.objects.selected),rendered:{...v.renderer.info.render},scale:v.objects.selected.scale.toArray()}));
      measurements.push({backend,level,...result});
      check(result.levels[level].draws===1,`${backend} ${level} keeps one model draw`);
      check(result.scale.every(n=>n===1),`${backend} ${level} keeps metre scale`);
    }
    if(stage==='final'){
      const stats=measurements.at(-1).levels;
      check(stats.near.triangles<=1000&&stats.mid.triangles<stats.near.triangles&&stats.far.triangles<stats.mid.triangles,`${backend} LOD reduces the bounded source model`);
      await page.selectOption('#object-pose','flight');
      await read(page,async v=>{
        v.setLodMode('auto');v.camera.position.copy(v.controls.target);v.camera.position.z+=10;v.camera.lookAt(v.controls.target);v.camera.updateMatrixWorld(true);v.lod.update(v.camera,900,0,true);
      });
      check(await read(page,v=>v.lod.inspect(v.objects.selected)[0].level==='far'),`${backend} distance automatically selects Far`);
      await page.click('#object-compare');
      check(await read(page,async v=>{const {propCollection}=await import('/src/models/props/catalogue.ts');return v.objects.comparison.children.filter(n=>n.userData.assetId).length===propCollection.length;}),`${backend} every object appears in true-scale comparison`);
      await page.click('#object-compare');
      const oldSeed=await read(page,v=>v.objects.selected.userData.seed);
      await page.click('#object-regenerate');
      check(await read(page,(v,oldSeed)=>v.objects.selected.userData.seed!==oldSeed,oldSeed),`${backend} Regenerate creates another seeded specimen`);
    }
    await context.close();
  }
  if(stage==='final'){
    const {page,context}=await open('webgl',320);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'320px layout has no horizontal overflow');
    await page.screenshot({path:`${out}/final-mobile-320.png`});
    await page.selectOption('#lod-select','mid');
    const [download]=await Promise.all([page.waitForEvent('download'),page.click('#export-object')]);
    const bytes=await fs.readFile(await download.path());
    check(bytes.readUInt32LE(0)===0x46546c67,'Optional GLB exports a valid container');
    const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    check(json.meshes.length===1&&json.skins[0].joints.length===5&&!json.images,'GLB retains one mesh, five bones and no image textures');
    await fs.writeFile(`${out}/monarch-butterfly-seed42-mid.glb`,bytes);
    await context.close();
  }
  check(errors.length===0,`No browser or shader errors: ${errors.join('; ')}`);
}finally{
  const after=await hashes();
  await fs.writeFile(`${out}/${stage}-browser-metrics.json`,JSON.stringify({date:new Date().toISOString(),stage,checks,errors,measurements,sourceHashes:{before,after},sourceStable:JSON.stringify(before)===JSON.stringify(after)},null,2));
  await browser.close();
}
