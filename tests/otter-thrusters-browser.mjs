/** Real-input checks for suit metal finish, prone pose and variable exhaust. */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out=process.env.ARTIFACT_DIR??'artifacts/otter-man-thrusters';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const checks=[],errors=[],measurements=[];const pause=ms=>new Promise(r=>setTimeout(r,ms));
const check=(v,label)=>{if(!v)throw Error(label);checks.push(label);console.log('PASS',label);};
const state=p=>p.evaluate(async()=>{const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);return viewer.avatarWorkbench?.getSnapshot();});
try {for(const backend of ['webgpu','webgl']){
 const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));
 p.on('console',e=>{if(e.type()==='error'&&/shader|wgsl|glsl|compile|validation/i.test(e.text()))errors.push(e.text());});
 await p.clock.setFixedTime(new Date('2026-10-24T20:00:00Z'));
 await p.goto('http://127.0.0.1:5191/?tab=gym'+(backend==='webgl'?'&webgl':''));
 const end=Date.now()+120000;while(Date.now()<end){const s=await state(p);if(s?.nearest==='otter-man-suit'&&s.frameCount>4)break;await pause(200);}
 check((await state(p)).backend===(backend==='webgpu'?'WebGPU':'WebGL 2'),backend+' renderer');
 await p.locator('#gym-viewport canvas').focus();await p.keyboard.press('e');await pause(800);
 const worn=await state(p);check(worn.otterSuit&&worn.model.drawCalls===1,backend+' one draw equipped');
 check(worn.animation.footThrust===0,backend+' exhaust off on ground');await p.screenshot({path:out+'/'+backend+'-metal.png'});
 await p.keyboard.down('Space');await pause(2200);await p.keyboard.up('Space');await pause(650);
 const hover=await state(p);check(hover.animation.handThrust>0&&hover.animation.footThrust>0,backend+' four jets in hover');
 await p.screenshot({path:out+'/'+backend+'-hover.png'});
 await p.keyboard.down('d');await pause(1300);const cruise=await state(p);
 check(cruise.animation.flightPitch>1.35,backend+' forward flight prone');await p.screenshot({path:out+'/'+backend+'-cruise.png'});
 await p.keyboard.down('Shift');await pause(1100);const boost=await state(p);
 check(boost.animation.footThrust>cruise.animation.footThrust*2,backend+' boost doubles foot thrust');await p.screenshot({path:out+'/'+backend+'-boost.png'});
 await p.keyboard.up('Shift');await p.keyboard.up('d');await pause(1800);
 check((await state(p)).animation.flightPitch<.1,backend+' hover upright again');
 await p.locator('#gym-suit-return').click();await pause(400);check(!(await state(p)).otterSuit,backend+' original outfit restored');
 const rig=await p.evaluate(async()=>{const {createAvatarModel,DEFAULT_AVATAR_DESIGN}=await import('/src/models/avatar/index.ts');const {createLodController}=await import('/src/models/shared/lod/controller.ts');const m=createAvatarModel({...DEFAULT_AVATAR_DESIGN},{gear:'otter-man'}),lod=createLodController();await lod.register(m.root);const r={stats:m.stats,lod:lod.stats(m.root)};lod.dispose();m.dispose();return r;});
 measurements.push({backend,hover:hover.animation,cruise:cruise.animation,boost:boost.animation,rig});await p.close();
}check(errors.length===0,'no browser or shader errors');
}finally{await fs.writeFile(out+'/checks.json',JSON.stringify({date:new Date().toISOString(),checks,errors,measurements},null,2));await browser.close();}
