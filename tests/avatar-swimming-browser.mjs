// Focused swimming QA through real creator/gym controls and the visible requestAnimationFrame loop.
// PREVIEW_URL defaults to the shared preview; SWIMMING_ARTIFACT_DIR can isolate a rerun.
// No avatar teleport, controller.update(), synthetic time advance, or breath state writes.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
// The gym keeps its tools in one menu; open it before using a menu control. Touch pages tap.
async function openMenu(page,tap=false){if(!await page.locator('#gym-menu').evaluate(e=>e.open)){const s=page.locator('#gym-menu > summary');await(tap?s.tap():s.click());}}
async function menuClick(page,selector,tap=false){await openMenu(page,tap);const l=page.locator(selector);await(tap?l.tap():l.click());}

const url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';
const out=process.env.SWIMMING_ARTIFACT_DIR??'artifacts/avatar-swimming';
const sourceFiles=['src/main.ts','src/viewer/avatarWorkbench.ts','src/viewer/avatarWorkbench.css','src/viewer/avatarController.ts','src/viewer/testingGym.ts','src/models/avatar/index.ts','src/models/avatar/geometry.ts','src/models/avatar/design.ts','src/data/avatarSaves.ts','src/viewer/nodeStyle.ts','src/models/shared/lod/controller.ts','src/models/shared/lod/geometry.ts'];
for(const file of await fs.readdir('src/viewer/testingGym',{recursive:true}))if(file.endsWith('.ts'))sourceFiles.push('src/viewer/testingGym/'+file);
const digest=()=>Promise.all(sourceFiles.map(async file=>({file,sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex')})));
const sourceBefore=await digest();await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL??'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const checks=[],errors=[],imageRequests=[],measurements=[],viteEvents=[],stablePages=new WeakMap();
let activePage,failure=null;
function check(ok,label){if(!ok)throw Error(label);checks.push(label);console.log('PASS',label);}
function observe(page,label){activePage=page;page.on('pageerror',e=>errors.push(label+': '+e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_CERT_AUTHORITY_INVALID'))errors.push(label+': '+m.text());});page.on('request',r=>{if(r.resourceType()==='image'&&/^https?:/.test(r.url()))imageRequests.push(r.url());});page.on('websocket',s=>s.on('framereceived',({payload})=>{try{const v=JSON.parse(String(payload));if(['update','full-reload','error'].includes(v.type))viteEvents.push({label,at:new Date().toISOString(),value:v});}catch{}}));}
async function read(page,fn,arg){
 const result=await page.evaluate(async({fn,arg})=>{const{viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);const w=viewer.avatarWorkbench;if(!w)throw Error('Avatar workbench not ready');await w.ready;return{value:await new Function('w','arg',`return (${fn})(w,arg)`)(w,arg),origin:performance.timeOrigin,mainScene:viewer.scene.uuid};},{fn:fn.toString(),arg});
 const expected=stablePages.get(page);if(expected&&(expected.origin!==result.origin||expected.mainScene!==result.mainScene))throw Error('Page restarted during swimming QA');return result.value;
}
const snapshot=page=>read(page,w=>w.getSnapshot());
async function ready(page){await page.locator('#avatar-pose option[value="swim"]').waitFor({state:'attached',timeout:45000});await page.waitForFunction(async()=>{const{viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return !!viewer.avatarWorkbench?.getSnapshot().backend;},null,{timeout:45000});stablePages.set(page,await page.evaluate(async()=>{const{viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return{origin:performance.timeOrigin,mainScene:viewer.scene.uuid};}));await page.waitForTimeout(200);}
async function waitState(page,predicate,timeout=12000){const start=Date.now();let value;while(Date.now()-start<timeout){value=await snapshot(page);if(predicate(value))return value;await page.waitForTimeout(100);}throw Error('State wait timed out: '+predicate.toString()+'; last='+JSON.stringify(value));}
async function goGym(page){await page.locator('#avatar-to-gym').click();await waitState(page,s=>s.gymReady&&s.controller,45000);await page.locator('#gym-viewport canvas').focus();}
async function hold(page,key,ms){await page.keyboard.down(key);try{await page.waitForTimeout(ms);}finally{await page.keyboard.up(key);}}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
async function enterWater(page){
 await menuClick(page,'#gym-swim-start');await page.locator('#gym-viewport canvas').focus();const start=await snapshot(page);
 await page.keyboard.down('w');try{await waitState(page,s=>s.controller?.swimming,15000);await page.waitForTimeout(650);}finally{await page.keyboard.up('w');}
 await page.waitForTimeout(350);const end=await snapshot(page);check(end.controller.swimming&&distance(start.position,end.position)>6,'Try swimming + forward key enters the bay from dry sand');return{start,end};
}
// Passive observations choose the route; keyboard events perform all travel.
async function driveTo(page,target,timeout=14000,stopOnDry=false){
 await page.locator('#gym-viewport canvas').focus();const start=Date.now(),samples=[];let down=[];
 try{while(Date.now()-start<timeout){
  const state=await read(page,w=>{const e=w.camera.matrixWorld.elements;return{snapshot:w.getSnapshot(),forward:[-e[8],-e[10]]};});samples.push(state.snapshot.position);
  const p=state.snapshot.position,c=state.snapshot.controller,dx=target[0]-p[0],dz=target[2]-p[2];if(stopOnDry&&!c.swimming&&!c.wading&&distance(p,c.safePosition)<.05)break;if(Math.hypot(dx,dz)<.25)break;
  const [fx,fz]=state.forward,l=Math.hypot(fx,fz),horizontal=(-fz*dx+fx*dz)/l,vertical=(fx*dx+fz*dz)/l,max=Math.max(Math.abs(horizontal),Math.abs(vertical)),want=[];
  if(Math.abs(horizontal)>max*.4)want.push(horizontal>0?'d':'a');if(Math.abs(vertical)>max*.4)want.push(vertical>0?'w':'s');
  for(const k of down)if(!want.includes(k))await page.keyboard.up(k);for(const k of want)if(!down.includes(k))await page.keyboard.down(k);down=want;await page.waitForTimeout(90);
 }}finally{for(const k of down)await page.keyboard.up(k);}
 await page.waitForTimeout(180);return samples;
}
async function measure(page){return read(page,w=>{
 const a=w.avatar,g=a.mesh.geometry,p=g.getAttribute('position'),weight=g.getAttribute('skinWeight'),indices=g.getAttribute('skinIndex');let valid=true,fingerprint=2166136261;
 for(const attr of Object.values(g.attributes))for(const value of attr.array){valid&&=Number.isFinite(value);fingerprint=Math.imul(fingerprint^Math.round(value*1e6),16777619)>>>0;}
 for(let i=0;i<p.count;i++){valid&&=Math.abs(weight.getX(i)+weight.getY(i)+weight.getZ(i)+weight.getW(i)-1)<1e-5;for(const get of ['getX','getY','getZ','getW'])valid&&=indices[get](i)>=0&&indices[get](i)<a.bones.length;}
 const face=a.root.position.clone().set(0,.168,.235);a.anchors.head.localToWorld(face);
 return{snapshot:w.getSnapshot(),valid,fingerprint,versions:Object.fromEntries(Object.entries(g.attributes).map(([k,v])=>[k,v.version])),boneAngles:a.bones.map(b=>b.rotation.toArray().slice(0,3)),scale:a.root.scale.toArray(),face:face.toArray(),waterHeight:w.gym?.swimming?.surfaceHeight(a.root.position.x,a.root.position.z)??null,imageTextures:a.stats.imageTextures};
});}
async function detail(page,level,inGym=false){const parent=inGym?'.gym-performance':'.av-performance';if(!await page.locator(parent).evaluate(e=>e.open))await page.locator(parent+' summary').click();await page.selectOption(inGym?'#gym-lod':'#avatar-lod',level);await page.waitForTimeout(170);await page.locator(parent+' summary').click();}
async function isolatedDraw(page){return read(page,w=>{
 const r=w.renderer,root=w.avatar.root,previous=r.info.autoReset,visible=root.visible;r.info.autoReset=false;
 try{root.visible=true;r.info.reset();r.render(w.scene,w.camera);const full={...r.info.render};root.visible=false;r.info.reset();r.render(w.scene,w.camera);const empty={...r.info.render};return{drawCalls:full.drawCalls-empty.drawCalls,triangles:full.triangles-empty.triangles};}
 finally{root.visible=visible;r.info.autoReset=previous;r.render(w.scene,w.camera);}
});}
async function touchEnter(page){
 await menuClick(page,'#gym-swim-start',true);const button=page.locator('[data-move="forward"]');await button.scrollIntoViewIfNeeded();const b=await button.boundingBox(),session=await page.context().newCDPSession(page),point={x:b.x+b.width/2,y:b.y+b.height/2};
 try{await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await waitState(page,s=>s.controller?.swimming,15000);await page.waitForTimeout(650);}
 finally{await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();}
 await page.waitForTimeout(350);
}
try{
 for(const backend of ['webgpu','webgl']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'}),page=await context.newPage();observe(page,backend);
  await page.goto(`${url}?tab=avatars${backend==='webgl'?'&webgl':''}`,{waitUntil:'networkidle'});await ready(page);
  check((await snapshot(page)).backend===(backend==='webgpu'?'WebGPU':'WebGL 2'),backend+' actual renderer backend');
  await page.locator('#avatar-name').fill('Swimming visitor');await page.locator('#avatar-save').click();const firstId=(await snapshot(page)).currentId;
  await page.locator('.av-library summary').click();await page.locator('#avatar-save-copy').click();await page.locator('#avatar-name').fill('Coastal swimmer');await page.locator('#avatar-save').click();await page.locator('.av-library summary').click();
  const preview=[];
  for(const pose of ['swim','tread']){
   await page.selectOption('#avatar-pose',pose);await page.waitForTimeout(650);const a=await measure(page);await page.waitForTimeout(250);const b=await measure(page);
   check(b.snapshot.animation.swimming>.98&&b.snapshot.pose===pose,backend+' '+pose+' preview selects swimming animation');
   check(a.fingerprint===b.fingerprint&&JSON.stringify(a.versions)===JSON.stringify(b.versions)&&JSON.stringify(a.snapshot.position)===JSON.stringify(b.snapshot.position),backend+' '+pose+' animates without geometry uploads or root movement');
   check(JSON.stringify(a.boneAngles)!==JSON.stringify(b.boneAngles),backend+' '+pose+' limbs animate');preview.push({pose,before:a,after:b});await page.screenshot({path:`${out}/preview-${pose}-${backend}.png`});
  }
  const levels=[];await page.selectOption('#avatar-pose','swim');
  for(const level of ['near','mid','far']){await detail(page,level);const row=await measure(page),draw=await isolatedDraw(page);check(row.valid&&row.scale.every(n=>n===1)&&row.snapshot.model.drawCalls===1&&row.imageTextures===0,backend+' '+level+' swimming preserves skinning, scale and budgets');check(draw.drawCalls===1&&draw.triangles===row.snapshot.model.triangles,backend+' '+level+' submits one avatar color draw');levels.push({level,row,draw});}
  await detail(page,'auto');await goGym(page);const route=await enterWater(page);const start=await read(page,w=>w.gym.swimStart.toArray());
  check(!route.start.controller.swimming&&!route.start.controller.wading&&route.start.controller.breath>19,backend+' practice button starts on dry sand with available breath');
  const beforeTread=await measure(page);await page.waitForTimeout(700);const afterTread=await measure(page);
  check(afterTread.snapshot.controller.breath===20,backend+' surface swimming keeps full breath');
  check(afterTread.snapshot.animation.swimming>.99&&afterTread.snapshot.speed<.08,backend+' stopping movement treads water');
  check(Number.isFinite(afterTread.waterHeight)&&afterTread.face[1]>afterTread.waterHeight+.1,backend+' swimming face stays above the modeled water');
  check(!await page.locator('#gym-breath').isVisible()&&await page.locator('#gym-run').isDisabled()&&await page.locator('#gym-interact').isDisabled(),backend+' breath is hidden and land-only actions are disabled');
  for(const emote of ['wave','sit'])check(!await page.locator(`#panel-gym [data-emote="${emote}"]`).isVisible(),backend+' '+emote+' is unavailable while swimming');check((await snapshot(page)).emote==='none'&&!(await snapshot(page)).carrying,backend+' swimming blocks land emotes and carried equipment');
  const beforeLoad=await snapshot(page);await openMenu(page,false);await page.selectOption('#gym-avatar',firstId);await page.waitForTimeout(300);const afterLoad=await snapshot(page);
  check(afterLoad.controller.swimming&&afterLoad.currentId===firstId&&distance(beforeLoad.position,afterLoad.position)<.2&&afterLoad.controller.breath<=beforeLoad.controller.breath+.05&&afterLoad.controller.breath>beforeLoad.controller.breath-1.5,backend+' loading a saved avatar preserves swimming position and breath');
  const beforeTab=await snapshot(page);await page.locator('#gym-back').click();await page.waitForTimeout(700);await page.locator('#avatar-to-gym').click();await page.waitForTimeout(250);const afterTab=await snapshot(page);
  check(afterTab.controller.swimming&&distance(beforeTab.position,afterTab.position)<.2&&afterTab.controller.breath<=beforeTab.controller.breath+.05&&afterTab.controller.breath>beforeTab.controller.breath-.7,backend+' creator/gym tab changes preserve water position and remaining breath');
  await page.screenshot({path:`${out}/treading-${backend}.png`});
  const returning=await driveTo(page,start,10000,true);const onShore=await waitState(page,s=>!s.controller.swimming&&!s.controller.wading,3000);
  check(onShore.controller.breath===20,backend+' shore has full breath');
  measurements.push({backend,preview,levels,route,beforeTread,afterTread,beforeLoad,afterLoad,beforeTab,afterTab,returning,onShore});await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),phone=await context.newPage();observe(phone,'phone');await phone.goto(url+'?tab=avatars&webgl',{waitUntil:'networkidle'});await ready(phone);await goGym(phone);await touchEnter(phone);
 const phoneA=await measure(phone);await phone.waitForTimeout(500);const phoneB=await measure(phone);
 check(phoneB.snapshot.controller.swimming&&phoneB.snapshot.controller.breath===20, '390px touch movement reaches surface swimming with full breath');
 check(JSON.stringify(phoneA.boneAngles)!==JSON.stringify(phoneB.boneAngles)&&phoneB.snapshot.animation.blink===1,'reduced-motion touch swimming keeps deliberate limb action');
 check(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px swimming controls have no horizontal overflow');
 check(await phone.locator('#gym-breath-meter').getAttribute('aria-label')==='Breath remaining'&&!!await phone.locator('#gym-breath-meter').getAttribute('aria-valuetext'),'touch breath meter has an accessible label and remaining-time text');
 check(!await phone.locator('#gym-breath').isVisible(),'surface swimming hides the phone breath panel');measurements.push({backend:'phone-webgl',before:phoneA,after:phoneB});await context.close();
 check(errors.length===0,'No browser or shader errors: '+errors.join('; '));check(imageRequests.filter(x=>!x.includes('favicon')).length===0,'Swimming adds no image texture requests');
}catch(error){failure=error instanceof Error?error.message:String(error);if(activePage&&!activePage.isClosed()){measurements.push({failureSnapshot:await snapshot(activePage).catch(()=>null)});await activePage.screenshot({path:`${out}/failure.png`}).catch(()=>{});}throw error;}
finally{const sourceAfter=await digest(),changedSources=sourceAfter.filter((v,i)=>v.sha256!==sourceBefore[i].sha256).map(v=>v.file);if(changedSources.length&&!failure){failure='Source changed during swimming QA: '+changedSources.join(', ');process.exitCode=1;console.error(failure);}await fs.writeFile(`${out}/browser-qa.json`,JSON.stringify({date:new Date().toISOString(),passed:failure===null,failure,url,checks,errors,measurements,imageRequests,viteEvents,sourceBefore,sourceAfter,changedSources,environment:'Chrome on this Mac, native WebGPU and forced WebGL2; 390px touch is desktop emulation, not physical phone profiling. All breath timing uses the visible app animation loop.'},null,2)+'\n');await browser.close();}
