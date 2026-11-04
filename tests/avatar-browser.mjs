// Shared-preview QA: PREVIEW_URL defaults to http://127.0.0.1:5191/.
// AVATAR_ARTIFACT_DIR chooses an evidence directory (default artifacts/avatar-creator).
// Use a distinct directory per concurrent run so reports/screenshots cannot overwrite.
// AVATAR_PERSISTENCE_ONLY=1 runs cross-tab and controlled delayed-load/import checks only.
// Default mode also covers both GPU backends, movement, stations, LOD and mobile touch.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
// The gym keeps its tools in one menu; open it before using a menu control. Touch pages tap.
async function openMenu(page,tap=false){if(!await page.locator('#gym-menu').evaluate(e=>e.open)){const s=page.locator('#gym-menu > summary');await(tap?s.tap():s.click());}}
async function menuClick(page,selector,tap=false){await openMenu(page,tap);const l=page.locator(selector);await(tap?l.tap():l.click());}
// Gym emotes live in a wheel opened by the Emotes button (Q / Y); choosing one closes it.
async function emoteClick(page,emote,tap=false){const wheel=page.locator('#gym-emote-menu');if(!await wheel.isVisible()){const t=page.locator('#gym-emote-toggle');await(tap?t.tap():t.click());}const b=page.locator(`#gym-emote-menu [data-emote="${emote}"]`);await(tap?b.tap():b.click());}
const sourceFiles=['src/main.ts','src/viewer/avatarWorkbench.ts','src/viewer/avatarWorkbench.css','src/viewer/avatarController.ts','src/viewer/testingGym.ts','src/data/lovers-point-gym.json','src/data/lovers-point-features.json','src/data/lovers-point-elevation.json','src/data/avatarSaves.ts','src/models/avatar/index.ts','src/models/avatar/geometry.ts','src/models/avatar/design.ts','src/viewer/nodeStyle.ts'];
try{for(const file of await fs.readdir('src/viewer/testingGym',{recursive:true}))if(file.endsWith('.ts'))sourceFiles.push('src/viewer/testingGym/'+file);}catch{}
async function sources(){return Promise.all(sourceFiles.map(async file=>{const stat=await fs.stat(file),content=await fs.readFile(file);return{file,mtime:stat.mtime.toISOString(),sha256:createHash('sha256').update(content).digest('hex')};}));}
const sourceBefore=await sources();

const url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';
const out=process.env.AVATAR_ARTIFACT_DIR??'artifacts/avatar-creator';await fs.mkdir(out,{recursive:true});
const persistenceOnly=process.env.AVATAR_PERSISTENCE_ONLY==='1';
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL??'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const checks=[],errors=[],measurements=[],requests=[];
let activePage,failure=null;
function check(ok,label){if(!ok)throw Error(label);checks.push(label);console.log('PASS',label);}
const read=(page,fn,arg)=>page.evaluate(async({fn,arg})=>{const entry=document.querySelector('script[type="module"][src*="/src/main.ts"]').src;const{viewer:v}=await import(entry);const w=v.avatarWorkbench;if(!w)throw Error('Avatar workbench is not initialized');await w.ready;return new Function('v','w','arg',`return (${fn})(v,w,arg)`)(v,w,arg);},{fn:fn.toString(),arg});
const snapshot=page=>read(page,(_v,w)=>w.getSnapshot());
async function ready(page){await page.locator('#avatar-save').waitFor({timeout:45000});await page.waitForFunction(async()=>{const{viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return !!viewer.avatarWorkbench?.getSnapshot().backend;},{timeout:45000});await page.waitForTimeout(250);}
function observe(page,label){activePage=page;page.on('pageerror',e=>errors.push(label+': '+e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_CERT_AUTHORITY_INVALID'))errors.push(label+': '+m.text());});page.on('request',r=>{if(r.resourceType()==='image'&&/^https?:/.test(r.url()))requests.push(r.url());});}
async function goGym(page){await page.locator('#avatar-to-gym').click();await page.waitForFunction(async()=>{const{viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return viewer.avatarWorkbench?.getSnapshot().gymReady;},{timeout:45000});await page.waitForTimeout(250);await page.locator('#gym-viewport canvas').focus();}
async function hold(page,keys,ms){for(const key of keys)await page.keyboard.down(key);await page.waitForTimeout(ms);for(const key of keys)await page.keyboard.up(key);}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
// Passive geometry/camera reads choose a route; actual keyboard input performs every step.
async function driveTo(page,target,{duration=6500,tolerance=.22}={}){
 await page.locator('#gym-viewport canvas').focus();let down=[];const started=Date.now(),samples=[];
 try{while(Date.now()-started<duration){
  const state=await read(page,(_v,w)=>{const p=w.avatar.root.position,e=w.camera.matrixWorld.elements;return {position:p.toArray(),forward:[-e[8],-e[10]]};});samples.push(state.position);
  const dx=target[0]-state.position[0],dz=target[1]-state.position[2];if(Math.hypot(dx,dz)<tolerance)break;
  const [fx,fz]=state.forward,length=Math.hypot(fx,fz),horizontal=(dx*-fz+dz*fx)/length,vertical=(dx*fx+dz*fz)/length;
  const max=Math.max(Math.abs(horizontal),Math.abs(vertical)),wanted=[];
  if(Math.abs(horizontal)>max*.4)wanted.push(horizontal>0?'d':'a');if(Math.abs(vertical)>max*.4)wanted.push(vertical>0?'w':'s');
  for(const key of down)if(!wanted.includes(key))await page.keyboard.up(key);for(const key of wanted)if(!down.includes(key))await page.keyboard.down(key);down=wanted;await page.waitForTimeout(95);
 }}finally{for(const key of down)await page.keyboard.up(key);}
 await page.waitForTimeout(170);return samples;
}
async function touchHold(page,selector,ms){
 const session=await page.context().newCDPSession(page),b=await page.locator(selector).boundingBox();
 if(!b)throw Error('Touch control has no visible bounds');const touchPoints=[{x:b.x+b.width/2,y:b.y+b.height/2}];
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints});await page.waitForTimeout(ms);await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();
}
try{
 for(const backend of persistenceOnly?[]:['webgpu','webgl']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'}),page=await context.newPage();observe(page,backend);
  await page.goto(`${url}?tab=avatars${backend==='webgl'?'&webgl':''}`,{waitUntil:'networkidle'});await ready(page);
  check((await snapshot(page)).backend===(backend==='webgpu'?'WebGPU':'WebGL 2'),backend+' actual rendering backend');
  check(await page.locator('#tab-avatars').getAttribute('aria-selected')==='true',backend+' creator is a directly addressable tab');
  for(const field of ['skinTone','hairColor','eyeColor','topColor','bottomColor','shoeColor'])check(await page.locator(`[data-design="${field}"][aria-pressed="true"]`).count()===1,backend+' '+field+' initially shows the chosen swatch');
  await page.locator('#av-category-you').focus();await page.keyboard.press('ArrowRight');check(await page.locator('#av-category-hair').getAttribute('aria-selected')==='true',backend+' category tabs support keyboard arrows');
  if(backend==='webgpu'){await page.locator('#avatar-name').fill('Cove');await page.locator('#av-category-hair').click();await page.screenshot({path:`${out}/creator-hero.png`});}
  await page.locator('#avatar-name').fill('Cove '+backend);
  await page.locator('#av-category-hair').click();await page.locator('[data-design="hairStyle"][data-value="curls"]').click();
  await page.locator('[data-design="hairColor"]').nth(3).click();
  await page.locator('#av-category-face').click();await page.locator('[data-design="eyeStyle"][data-value="almond"]').click();
  await page.locator('#av-category-outfit').click();await page.locator('[data-design="topStyle"][data-value="hoodie"]').click();await page.locator('[data-design="bottomStyle"][data-value="trousers"]').click();
  await page.locator('#avatar-save').click();await page.waitForTimeout(250);const saved=await snapshot(page);
  check(saved.design.name==='Cove '+backend&&saved.design.hairStyle==='curls'&&saved.design.eyeStyle==='almond'&&saved.design.topStyle==='hoodie'&&saved.design.bottomStyle==='trousers',backend+' face, hair and outfit controls produce the chosen recipe');
  check(saved.savedCount===1&&saved.currentId&&!saved.dirty,backend+' save records one named character');
  await page.reload({waitUntil:'networkidle'});await ready(page);check(JSON.stringify((await snapshot(page)).design)===JSON.stringify(saved.design),backend+' saved appearance survives browser reload');
  await page.locator('#av-category-outfit').click();await page.locator('[data-design="topStyle"][data-value="vest"]').click();await page.locator('[data-design="bottomStyle"][data-value="skirt"]').click();const changed=await snapshot(page);
  check(changed.design.skinTone===saved.design.skinTone&&changed.design.hairColor===saved.design.hairColor&&changed.design.eyeStyle===saved.design.eyeStyle&&changed.design.topStyle==='vest'&&changed.design.bottomStyle==='skirt',backend+' saved character can change outfit while retaining identity');
  await page.locator('#avatar-save').click();await page.locator('.av-library summary').click();await page.locator('#avatar-save-copy').click();
  check((await snapshot(page)).savedCount===2,backend+' Save as new creates an independent character');const copyId=(await snapshot(page)).currentId;await page.locator('#avatar-name').fill('Harbor '+backend);await page.locator('#avatar-save').click();
  await page.selectOption('#avatar-saved',saved.currentId);await page.locator('#avatar-load').click();await page.waitForTimeout(200);
  check((await snapshot(page)).currentId===saved.currentId&&(await snapshot(page)).design.topStyle==='vest',backend+' saved character picker loads updated outfit');await page.reload({waitUntil:'networkidle'});await ready(page);check((await snapshot(page)).currentId===saved.currentId&&(await snapshot(page)).design.name==='Cove '+backend,backend+' loading a different saved character persists selection after reload');await page.locator('.av-library summary').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('#avatar-export').click();const download=await downloadPromise;const file=await download.path();const exported=JSON.parse(await fs.readFile(file,'utf8'));check(JSON.stringify(exported).includes('Cove '+backend),backend+' portable download contains saved character');
  await page.locator('#avatar-import').setInputFiles({name:'character.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.waitForTimeout(150);check((await snapshot(page)).design.topStyle==='vest',backend+' portable JSON imports into editable creator');
  await page.locator('#avatar-import').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"unrelated":true}')});await page.waitForTimeout(120);check((await page.locator('#avatar-message').textContent()).toLowerCase().includes('avatar')||(await page.locator('#avatar-message').textContent()).toLowerCase().includes('character'),backend+' invalid import explains failure without breaking creator');
  await page.locator('.av-library summary').click();await page.locator('.av-performance summary').click();
  const lodRows=[];
  for(const level of ['near','mid','far']){
   await page.selectOption('#avatar-lod',level);await page.waitForTimeout(220);
   const measured=await read(page,(_v,w)=>{const a=w.avatar,g=a.mesh.geometry,weights=g.getAttribute('skinWeight'),indices=g.getAttribute('skinIndex');let valid=weights.count===g.getAttribute('position').count&&indices.count===weights.count;for(let i=0;i<weights.count;i++){valid&&=Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-5;valid&&=indices.getX(i)<a.bones.length&&indices.getY(i)<a.bones.length;}return {snapshot:w.getSnapshot(),skinValid:valid,rootScale:a.root.scale.toArray(),bones:a.bones.length,boneMatrixBytes:a.skeleton.boneMatrices.byteLength,boneTexture:a.skeleton.boneTexture?{width:a.skeleton.boneTexture.image.width,height:a.skeleton.boneTexture.image.height,bytes:a.skeleton.boneTexture.image.data?.byteLength}:null,geometryVersions:Object.fromEntries(Object.entries(g.attributes).map(([k,v])=>[k,v.version]))};});
   check(measured.skinValid&&measured.rootScale.every(n=>n===1)&&measured.bones===17,backend+' '+level+' retains normalized skinning and metre scale');
   check(measured.snapshot.model.drawCalls===1&&measured.snapshot.model.triangles<=5000,backend+' '+level+' avatar stays inside model draw and triangle budget');lodRows.push({level,...measured});
  }
  check(lodRows[2].snapshot.model.triangles<lodRows[1].snapshot.model.triangles&&lodRows[1].snapshot.model.triangles<lodRows[0].snapshot.model.triangles,backend+' LOD reduces submitted avatar geometry');
  await page.selectOption('#avatar-lod','near');await page.waitForTimeout(150);
  const submitted=await read(page,(_v,w)=>{const scene=w.scene,renderer=w.renderer,root=w.avatar.root,previous=renderer.info.autoReset;w.setActive(null);renderer.info.autoReset=false;renderer.info.reset();renderer.render(scene,w.camera);const full={...renderer.info.render};root.visible=false;renderer.info.reset();renderer.render(scene,w.camera);const empty={...renderer.info.render};root.visible=true;renderer.info.autoReset=previous;w.setActive('avatars');return{drawCalls:full.drawCalls-empty.drawCalls,triangles:full.triangles-empty.triangles};});
  check(submitted.drawCalls===1&&submitted.triangles>0&&submitted.triangles<=5000,backend+' isolated GPU submission is one avatar color draw');measurements.push({backend,isolatedAvatar:submitted});
  await page.selectOption('#avatar-lod','auto');await page.locator('.av-performance summary').click();await page.selectOption('#avatar-pose','walk');
  const walkA=await read(page,(_v,w)=>({root:w.avatar.root.position.toArray(),phase:w.avatar.getState().phase,versions:Object.fromEntries(Object.entries(w.avatar.mesh.geometry.attributes).map(([k,v])=>[k,v.version]))}));await page.waitForTimeout(350);
  const walkB=await read(page,(_v,w)=>({root:w.avatar.root.position.toArray(),phase:w.avatar.getState().phase,versions:Object.fromEntries(Object.entries(w.avatar.mesh.geometry.attributes).map(([k,v])=>[k,v.version]))}));
  check(walkA.phase!==walkB.phase&&JSON.stringify(walkA.root)===JSON.stringify(walkB.root)&&JSON.stringify(walkA.versions)===JSON.stringify(walkB.versions),backend+' walk animates skeleton with static geometry and fixed placement');
  await page.selectOption('#avatar-pose','idle');await page.locator('#panel-avatars [data-emote="wave"]').click();await page.waitForTimeout(200);check((await read(page,(_v,w)=>w.avatar.getState())).emote==='wave',backend+' wave button starts an emote');
  const blink=await page.evaluate(async()=>{const{viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src),w=viewer.avatarWorkbench;let minimum=1,maximum=0;const until=performance.now()+7500;while(performance.now()<until){const b=w.avatar.getState().blink;minimum=Math.min(minimum,b);maximum=Math.max(maximum,b);await new Promise(r=>setTimeout(r,25));}return{minimum,maximum};});check(blink.minimum<.8&&blink.maximum>.99,backend+' automatic eyes close and reopen');
  await page.screenshot({path:`${out}/creator-${backend}.png`});
  const preGym=await snapshot(page);await goGym(page);check((await snapshot(page)).active==='gym',backend+' creator opens Testing Gym');const initialGym=await read(page,(_v,w)=>({snapshot:w.getSnapshot(),world:w.lod.stats(w.gym.root),levels:w.lod.inspect(w.gym.root),registered:w.lod.size}));
  const origin=(await snapshot(page)).position;await hold(page,['w'],900);const walking=await snapshot(page);await menuClick(page,'#gym-reset');const runOrigin=(await snapshot(page)).position;await hold(page,['Shift','w'],900);const running=await snapshot(page);
  check(distance(walking.position,origin)>.5,backend+' keyboard walking moves the avatar');check(distance(running.position,runOrigin)>distance(walking.position,origin)*1.45,backend+' Shift running travels faster than walking');
  await menuClick(page,'#gym-reset');for(const p of [[25,-48],[56,-57.5],[72,-57.5],[68.6,-49.8],[63,-28],[70,-33.2]])await driveTo(page,p,{duration:22000,tolerance:.3});await page.keyboard.press('e');check((await snapshot(page)).interacted.includes('tackle-box'),backend+' walking to library tackle box enables E interaction');
  await driveTo(page,[72,-33.2]);await page.keyboard.press('e');await page.waitForTimeout(150);check((await snapshot(page)).carrying===true,backend+' library rod attaches to the avatar hand');await page.screenshot({path:`${out}/rod-${backend}.png`});
  // Run is a held Shift on desktop; the on-screen toggle is touch-only.
  await page.keyboard.down('Shift');
  // The raised park now has real retaining barriers: use the mapped east-beach
  // access instead of asking the avatar to walk through a wall toward the dock.
  const castTarget=await read(page,(_v,w)=>{const p=w.gym.interactions.find(item=>item.id==='casting').position;return[p.x,p.z];});
  for(const target of [castTarget]) await driveTo(page,target,{duration:14000,tolerance:.55});
  await page.keyboard.up('Shift');
  const castBefore=(await read(page,(_v,w)=>w.avatar.getState())).castCount;await page.locator('#gym-viewport canvas').focus();await page.keyboard.press('e');await page.waitForTimeout(180);
  const castDuring=await read(page,(_v,w)=>w.avatar.getState());check((await snapshot(page)).interacted.includes('casting')&&castDuring.castCount===castBefore+1&&castDuring.casting,backend+' approaching dock and E starts one rod casting animation');await page.screenshot({path:`${out}/cast-${backend}.png`});
  await page.keyboard.press('e');await page.waitForTimeout(120);const repeatedCast=await read(page,(_v,w)=>w.avatar.getState());check(repeatedCast.castCount===castBefore+2&&repeatedCast.casting,backend+' E can rearm a cast before the prior emote expires');
  await page.waitForTimeout(1500);const castAfter=await read(page,(_v,w)=>w.avatar.getState());check(castAfter.castCount===castBefore+2&&!castAfter.casting&&castAfter.carrying>.9,backend+' each requested cast completes once and returns to the held-rod pose');
  await page.locator('#gym-return-rod').click();check((await snapshot(page)).carrying===false,backend+' equipped rod returns to its library station');
  await driveTo(page,[70,-32],{duration:4200,tolerance:.05});
  const collision=await read(page,async(_v,w)=>{const{canStandAt}=await import('/src/viewer/avatarController.ts');return{position:w.avatar.root.position.toArray(),legal:canStandAt(w.avatar.root.position.x,w.avatar.root.position.z,w.gym.bounds,w.gym.colliders)};});
  check(collision.legal&&Math.hypot(collision.position[0]-70,collision.position[2]+32)>.4&&Math.hypot(collision.position[0]-70,collision.position[2]+32)<1,backend+' physical tackle-box proxy blocks walking through it');

  await menuClick(page,'#gym-reset');await emoteClick(page,'sit');await page.waitForTimeout(450);check((await read(page,(_v,w)=>w.avatar.getState())).seated>.8,backend+' seated emote blends in');await hold(page,['d'],250);check((await snapshot(page)).emote==='none',backend+' walking exits seated emote');
  await emoteClick(page,'cheer');await page.waitForTimeout(200);check((await snapshot(page)).emote==='cheer',backend+' gym cheer control works');await page.screenshot({path:`${out}/gym-${backend}.png`});
  await page.locator('#tab-tank').click();const stopped=await snapshot(page);await page.waitForTimeout(350);const still=await snapshot(page);check(still.active===null&&still.frameCount===stopped.frameCount,backend+' hidden creator/gym stop rendering');
  await page.locator('#tab-gym').click();await page.waitForTimeout(200);check((await snapshot(page)).frameCount>still.frameCount,backend+' returning to gym resumes rendering');
  await page.locator('#gym-back').click();check(JSON.stringify((await snapshot(page)).design)===JSON.stringify(preGym.design),backend+' returning to creator retains appearance');
  measurements.push({backend,details:lodRows,initialGym,blink,walkDistance:distance(walking.position,origin),runDistance:distance(running.position,runOrigin),collision,final:await snapshot(page)});await context.close();
 }
 const shared=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}),first=await shared.newPage(),second=await shared.newPage();observe(first,'shared-tab-one');observe(second,'shared-tab-two');
 await first.goto(url+'?tab=avatars&webgl',{waitUntil:'networkidle'});await ready(first);await second.goto(url+'?tab=avatars&webgl',{waitUntil:'networkidle'});await ready(second);
 await first.locator('#avatar-name').fill('First visitor');await second.locator('#avatar-name').fill('Second visitor');await first.locator('#avatar-save').click();await second.waitForTimeout(120);
 check((await snapshot(second)).design.name==='Second visitor','Another tab saving preserves the current unsaved draft');await second.locator('#avatar-save').click();await first.waitForTimeout(160);
 check((await snapshot(first)).savedCount===2&&(await snapshot(second)).savedCount===2,'Two browser tabs preserve both newly saved characters');
 check((await first.locator('#avatar-saved option').allTextContents()).includes('Second visitor')&&(await second.locator('#avatar-saved option').allTextContents()).includes('First visitor'),'Saved-character lists refresh across browser tabs');
 // Hold the existing asynchronous boundaries to reproduce out-of-order completion.
 // The newer actions below still use the creator's actual controls.
 const firstId=(await snapshot(first)).currentId,secondId=(await snapshot(second)).currentId;
 await first.locator('.av-library summary').click();
 async function delayedLoad(edit){
  await read(first,(_v,w)=>{const original=w.lod.register;let release;window.__avatarQaGate={waiting:false,release:()=>release(),restore:()=>{w.lod.register=original;delete window.__avatarQaGate;}};const gate=new Promise(resolve=>{release=resolve;});let once=true;w.lod.register=async function(...args){const result=await original.apply(this,args);if(once){once=false;window.__avatarQaGate.waiting=true;await gate;}return result;};});
  try{
   await first.selectOption('#avatar-saved',firstId);await first.locator('#avatar-load').click();await first.waitForFunction(()=>window.__avatarQaGate?.waiting);
   await edit();await first.evaluate(()=>window.__avatarQaGate.release());await first.waitForTimeout(150);
  }finally{await first.evaluate(()=>window.__avatarQaGate?.restore());}
 }
 await delayedLoad(async()=>{await first.locator('#avatar-name').fill('Newer name draft');});
 check((await snapshot(first)).dirty&&(await snapshot(first)).design.name==='Newer name draft','Delayed Load completion preserves a newer unsaved name');
 await delayedLoad(async()=>{await first.locator('#av-category-outfit').click();await first.locator('[data-design="topStyle"][data-value="hoodie"]').click();});
 check((await snapshot(first)).dirty&&(await snapshot(first)).design.topStyle==='hoodie','Delayed Load completion preserves a newer unsaved outfit');
 const importRecipe=JSON.stringify({format:'monterey-bay-cozy-avatar',version:1,design:{...(await snapshot(first)).design,name:'Slow import'}});
 async function delayedImport(text,edit){
  await first.evaluate(()=>{const original=File.prototype.text;let release;window.__avatarQaGate={waiting:false,release:()=>release(),restore:()=>{File.prototype.text=original;delete window.__avatarQaGate;}};const gate=new Promise(resolve=>{release=resolve;});File.prototype.text=async function(){window.__avatarQaGate.waiting=true;await gate;return original.call(this);};});
  try{
   await first.locator('#avatar-import').setInputFiles({name:'delayed.json',mimeType:'application/json',buffer:Buffer.from(text)});await first.waitForFunction(()=>window.__avatarQaGate?.waiting);
   await edit();await first.evaluate(()=>window.__avatarQaGate.release());await first.waitForTimeout(150);
  }finally{await first.evaluate(()=>window.__avatarQaGate?.restore());}
 }
 await delayedImport(importRecipe,async()=>{await first.selectOption('#avatar-saved',secondId);await first.locator('#avatar-load').click();});
 check((await snapshot(first)).currentId===secondId&&(await snapshot(first)).design.name==='Second visitor'&&!(await snapshot(first)).dirty,'Delayed file import cannot replace a later selected character');
 await delayedImport(importRecipe,async()=>{await first.locator('#avatar-name').fill('Keep my current draft');await first.locator('#av-category-hair').click();await first.locator('[data-design="hairStyle"][data-value="bun"]').click();});
 check((await snapshot(first)).dirty&&(await snapshot(first)).design.name==='Keep my current draft'&&(await snapshot(first)).design.hairStyle==='bun','Delayed file import cannot replace newer appearance edits');
 await delayedImport('{"unrelated":true}',async()=>{await first.locator('#avatar-name').fill('Still editing');});
 check((await first.locator('#avatar-message').textContent()).includes('Unsaved changes')&&(await snapshot(first)).design.name==='Still editing','Stale import errors do not replace the current draft status');
 await shared.close();
 if(!persistenceOnly){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),phone=await context.newPage();observe(phone,'phone');await phone.goto(url+'?tab=avatars&webgl',{waitUntil:'networkidle'});await ready(phone);
 check(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px creator has no horizontal overflow');await phone.locator('#av-category-hair').tap();await phone.locator('[data-design="hairStyle"][data-value="bun"]').tap();check((await snapshot(phone)).design.hairStyle==='bun','Touch hairstyle selection changes preview');
 await phone.screenshot({path:`${out}/creator-phone.png`});await goGym(phone);check(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px gym has no horizontal overflow');const phoneStart=(await snapshot(phone)).position;await touchHold(phone,'[data-move="right"]',800);check(distance((await snapshot(phone)).position,phoneStart)>.5,'Touch directional control moves avatar');
 await phone.locator('#gym-run').tap();check(await phone.locator('#gym-run').getAttribute('aria-pressed')==='true','Touch Run toggle is operable');await emoteClick(phone,'wave',true);await phone.waitForTimeout(200);check((await snapshot(phone)).emote==='wave','Touch emote works with reduced motion');check((await read(phone,(_v,w)=>w.avatar.getState())).blink===1,'Reduced motion suppresses automatic blinking');await phone.screenshot({path:`${out}/gym-phone.png`});
 await phone.locator('#gym-back').tap();await phone.setViewportSize({width:320,height:740});await phone.waitForTimeout(100);check(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320px creator has no horizontal overflow');await context.close();
 }
 check(errors.length===0,'No browser or shader errors: '+errors.join('; '));check(requests.filter(u=>!u.includes('favicon')).length===0,'Avatar and gym load no image textures');
} catch(error){failure=error instanceof Error?error.message:String(error);if(activePage&&!activePage.isClosed())await activePage.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw error;}
finally{const sourceAfter=await sources(),changedSources=sourceAfter.filter((s,i)=>s.sha256!==sourceBefore[i].sha256).map(s=>s.file);if(changedSources.length&&!failure){failure='Source changed during browser verification: '+changedSources.join(', ');process.exitCode=1;console.error(failure);}await fs.writeFile(`${out}/browser-qa.json`,JSON.stringify({date:new Date().toISOString(),passed:failure===null,failure,sourceBefore,sourceAfter,changedSources,url,checks,errors,measurements,imageRequests:requests,deviceNote:'Chrome on this Mac; native WebGPU and forced WebGL 2. Phone checks emulate viewport/touch, not physical hardware.'},null,2)+'\n');await browser.close();}
