import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out=process.env.ARTIFACT_DIR??'artifacts/otter-man-diving';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const checks=[],errors=[],results=[];const wait=ms=>new Promise(r=>setTimeout(r,ms));
const check=(v,s)=>{if(!v)throw Error(s);checks.push(s);console.log('PASS',s);};
const read=(p,fn,arg)=>p.evaluate(async({fn,arg})=>{const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return new Function('w','arg',`return (${fn})(w,arg)`)(viewer.avatarWorkbench,arg);},{fn:fn.toString(),arg});
const state=p=>read(p,w=>w?.getSnapshot());
async function until(p,fn,label){for(let i=0;i<180;i++){const s=await state(p);if(s&&fn(s))return s;await wait(200);}throw Error('Timed out: '+label+' '+JSON.stringify(await state(p)));}
try{for(const backend of ['webgpu','webgl']){
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('https://api.weather.gov/**',r=>r.abort());
 await context.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error'&&/shader|wgsl|glsl|validation|compile/i.test(e.text()))errors.push(e.text());});
 await p.clock.setFixedTime(new Date('2026-10-24T20:00:00Z'));
 await p.goto('http://127.0.0.1:5191/?tab=gym&whales=hide'+(backend==='webgl'?'&webgl':''));
 await until(p,s=>s.gymReady&&s.frameCount>4,'gym ready');
 check((await state(p)).backend===(backend==='webgpu'?'WebGPU':'WebGL 2'),backend+' renderer');
 await p.locator('#gym-viewport canvas').focus();await p.keyboard.press('e');await until(p,s=>s.otterSuit,'equip');
 await p.keyboard.down('Space');await until(p,s=>s.position[1]>20,'lift');await p.keyboard.up('Space');
 await p.keyboard.down('d');await p.keyboard.down('Shift');await until(p,s=>s.position[0]>185,'fly offshore');await p.keyboard.up('Shift');await p.keyboard.up('d');await wait(1300);
 await p.keyboard.down('c');await until(p,s=>s.position[1]<-2.4,'descend under water');await p.keyboard.up('c');await wait(1800);
 const submerged=await state(p);check(submerged.flight.submerged&&submerged.otterDive.activeBubbles>0,backend+' actual controls dive and emit bubbles');
 check(submerged.animation.handThrust===0&&submerged.animation.footThrust===0,backend+' all four air jets suppressed');
 check(submerged.otterDive.headlamp&&submerged.controller.breath===20,backend+' lamp on and unlimited suit air');
 check(submerged.weather.underwater,backend+' camera follows below surface');
 await p.screenshot({path:`${out}/${backend}-underwater.png`});
 // Freeze this real-input pose to compare identical scene pixels with the lamp on/off.
 await read(p,w=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));w.scene.updateMatrixWorld(true);});
 await read(p,w=>{w.weather.environment.headlamp.strength.value=0;w.renderer.render(w.scene,w.camera);});await p.screenshot({path:`${out}/${backend}-lamp-off.png`});
 await read(p,w=>{w.weather.environment.headlamp.strength.value=1.8;w.renderer.render(w.scene,w.camera);});await p.screenshot({path:`${out}/${backend}-lamp-on.png`});
 await read(p,w=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await p.locator('#gym-viewport canvas').focus();await p.keyboard.down('Space');await until(p,s=>s.position[1]>4,'resurface');await p.keyboard.up('Space');
 check(!(await state(p)).flight.submerged&&(await state(p)).animation.footThrust>0,backend+' surface restores flames');
 await p.locator('#gym-suit-return').click();await wait(600);const returned=await state(p);check(!returned.otterSuit&&!returned.otterDive.headlamp&&returned.otterDive.activeBubbles===0,backend+' return clears effects and restores outfit');
 // Review static geometry with a fixed camera; gameplay traversal above used real inputs.
 const costs=await read(p,async w=>{await w.lod.ready();return {park:w.lod.stats(w.gym.root),waterfront:w.lod.stats(w.gym.waterfront.root)};});
 await read(p,w=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));w.lod.setMode('near');});
 for(const [name,position,target] of [['pool',[-3,19,55],[-16,5,38]],['trail',[400,30,245],[430,8,280]]]){
  await read(p,(w,{position,target})=>{w.camera.position.fromArray(position);w.camera.lookAt(...target);w.camera.updateMatrixWorld(true);w.lod.update(w.camera,w.renderer.domElement.clientHeight,0,true);w.renderer.render(w.scene,w.camera);},{position,target});
  await p.screenshot({path:`${out}/${backend}-${name}.png`});
 }
 results.push({backend,submerged,costs});await context.close();
 }
 const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
 await mobile.route('https://api.weather.gov/**',r=>r.abort());
 const p=await mobile.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5191/?tab=gym&webgl&quality=base&whales=hide');
 await until(p,s=>s.gymReady&&s.frameCount>4,'touch ready');await p.locator('#gym-interact').tap();await until(p,s=>s.otterSuit,'touch equip');
 const button=p.locator('#gym-jump'),box=await button.boundingBox(),touch=await mobile.newCDPSession(p);
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
 await until(p,s=>s.position[1]>11,'held touch lift');await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 check((await state(p)).flight.flying,'base/reduced-motion held touch lift');
 check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px touch viewport fits');
 await p.screenshot({path:out+'/webgl-base-reduced-phone.png'});await p.locator('#gym-suit-return').tap();await until(p,s=>!s.otterSuit,'touch return');
 check(!(await state(p)).otterSuit,'touch returns outfit');await mobile.close();
 check(errors.length===0,'no browser or shader errors');
}finally{await fs.writeFile(out+'/checks.json',JSON.stringify({checks,errors,results},null,2));await browser.close();}
