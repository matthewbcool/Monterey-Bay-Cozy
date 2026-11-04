/** Real-input flight plus fixed underwater inspection on both rendering backends. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out=process.env.ARTIFACT_DIR??'artifacts/bathymetry';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const errors=[],results=[];
async function until(p,fn,label){for(let i=0;i<160;i++){const state=await read(p,w=>w?.getSnapshot());if(fn(state))return state;await p.waitForTimeout(200);}throw Error('Timed out: '+label);}
const read=(p,fn,arg)=>p.evaluate(async({fn,arg})=>{const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return new Function('w','arg',`return (${fn})(w,arg)`)(viewer.avatarWorkbench,arg);},{fn:fn.toString(),arg});
try{for(const [backend,tier] of [['webgpu','standard'],['webgl','standard'],['webgl','base']]){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.route('https://api.weather.gov/**',r=>r.abort());
 await context.routeWebSocket(u=>u.hostname==='127.0.0.1'&&u.searchParams.has('token'),s=>s.send(JSON.stringify({type:'connected'})));
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error'&&/shader|wgsl|glsl|validation|compile/i.test(e.text()))errors.push(e.text());});
 await p.clock.setFixedTime(new Date('2026-10-25T21:00:00Z'));
 await p.goto(`http://127.0.0.1:5191/?tab=gym&whales=hide&quality=${tier}`+(backend==='webgl'?'&webgl':''));
 for(let i=0;i<160;i++){const s=await read(p,w=>w?.getSnapshot());if(s?.gymReady&&s.frameCount>5)break;if(i===159)throw Error('Gym did not load');await p.waitForTimeout(250);}
 await p.locator('#gym-menu > summary').click();await p.locator('.gym-weather > summary').click();await p.selectOption('#gym-weather-mode','clear');await p.selectOption('#gym-weather-clock','preview');await p.fill('#gym-weather-date','2026-10-25T14:00');await p.locator('#gym-weather-date').dispatchEvent('change');await p.locator('#gym-menu > summary').click();
 await p.locator('#gym-viewport canvas').focus();await p.keyboard.press('e');await p.keyboard.down('Space');await p.waitForTimeout(4500);await p.keyboard.up('Space');await p.waitForTimeout(800);
 const flying=await read(p,w=>w.getSnapshot());if(!flying.flight?.flying)throw Error('Otter flight failed');
 await p.screenshot({path:`${out}/${backend}-${tier}-flight.png`});
 const metrics=await read(p,async w=>{await w.lod.ready();return {state:w.getSnapshot(),shadow:{bias:w.weather.sun.shadow.bias,normalBias:w.weather.sun.shadow.normalBias,target:w.weather.sun.target.position.toArray(),resolution:w.weather.sun.shadow.mapSize.x},seafloor:w.lod.stats(w.gym.seafloor.root),shark:w.gym.coastalLife.swimmers.find(s=>s.id==='great-white-shark').model.root.position.toArray()};});
 await p.keyboard.down('d');await p.keyboard.down('Shift');await until(p,s=>s.position[0]>185,'flight to offshore depth');await p.keyboard.up('Shift');await p.keyboard.up('d');await p.waitForTimeout(700);
 await p.keyboard.down('c');await until(p,s=>s.position[1]<-1.8,'dive over measured floor');await p.keyboard.up('c');await p.waitForTimeout(1200);
 metrics.diving=await read(p,w=>w.getSnapshot());if(!metrics.diving.flight.submerged||!metrics.diving.weather.underwater)throw Error('Underwater follow view failed');
 await p.screenshot({path:`${out}/${backend}-${tier}-dive.png`});
 // Fixed review positions; these are visual inspections, not traversal evidence.
 await read(p,w=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));w.scene.updateMatrixWorld(true);});
 await read(p,w=>{const shark=w.gym.coastalLife.swimmers.find(s=>s.id==='great-white-shark').model.root;w.gym.coastalLife.setViewer(shark.position.x,shark.position.z);w.camera.position.copy(shark.position).add({x:5,y:-.3,z:9});w.camera.lookAt(shark.position);w.camera.near=.1;w.camera.updateProjectionMatrix();w.weather.update({time:0,dt:0,underwater:true,overview:false,reducedMotion:true,shadowFocus:w.avatar.root.position,water:w.gym.water});w.lod.setMode('near');w.lod.update(w.camera,1000,0,true);w.renderer.render(w.scene,w.camera);});
 await p.screenshot({path:`${out}/${backend}-${tier}-shark.png`});
 await read(p,w=>{w.camera.position.set(180,-1.5,-50);w.camera.lookAt(200,-5,-60);w.camera.updateMatrixWorld();w.lod.update(w.camera,1000,0,true);w.renderer.render(w.scene,w.camera);});
 await p.screenshot({path:`${out}/${backend}-${tier}-seafloor.png`});
 results.push({backend,tier,...metrics});console.log('Captured',backend,tier,JSON.stringify(metrics.seafloor));await context.close();
 }if(errors.length)throw Error(errors.join('\n'));
}finally{await fs.writeFile(out+'/browser.json',JSON.stringify({errors,results},null,2));await browser.close();}
