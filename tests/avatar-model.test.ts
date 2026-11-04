import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Color, PerspectiveCamera, Vector3 } from 'three';
import { AVATAR_BUDGET, AVATAR_OPTIONS, createAvatarModel, DEFAULT_AVATAR_DESIGN, normalizeAvatarDesign } from '../src/models/avatar';
import { createLodController } from '../src/models/shared/lod/controller';
import { applyNodeStyle } from '../src/viewer/nodeStyle';

function validGeometry(model: ReturnType<typeof createAvatarModel>) {
  const g=model.mesh.geometry, p=g.getAttribute('position'), si=g.getAttribute('skinIndex'), sw=g.getAttribute('skinWeight');
  for(const a of Object.values(g.attributes))assert.ok(Array.from(a.array).every(Number.isFinite));
  assert.equal(si.count,p.count);assert.equal(sw.count,p.count);
  for(let i=0;i<p.count;i++){
    let total=0;
    for(let k=0;k<4;k++) { assert.ok(si.getComponent(i,k)>=0&&si.getComponent(i,k)<model.bones.length);total+=sw.getComponent(i,k); }
    assert.ok(Math.abs(total-1)<1e-6);
  }
  assert.ok(Array.from(g.index!.array).every(i=>i>=0&&i<p.count));
}

test('Avatar recipes serialize appearance independently from outfits and reject corrupt storage fields',()=>{
  const design=normalizeAvatarDesign({...DEFAULT_AVATAR_DESIGN,name:'  Coastal friend\n  ',skinTone:'javascript:bad',hairStyle:'not-a-style',topColor:'#ABCDEF',bottomStyle:'skirt',unknown:'discard'});
  assert.equal(design.name,'Coastal friend');assert.equal(design.skinTone,DEFAULT_AVATAR_DESIGN.skinTone);assert.equal(design.hairStyle,DEFAULT_AVATAR_DESIGN.hairStyle);assert.equal(design.topColor,'#abcdef');assert.equal(design.bottomStyle,'skirt');assert.ok(!('unknown'in design));
  assert.deepEqual(normalizeAvatarDesign(JSON.parse(JSON.stringify(design))),design);
  for(const value of [null,undefined,'garbage',42,[],{}])assert.deepEqual(normalizeAvatarDesign(value),DEFAULT_AVATAR_DESIGN);
  const changed=normalizeAvatarDesign({...design,topStyle:'hoodie',topColor:'#112233'});assert.equal(changed.skinTone,design.skinTone);assert.equal(changed.hairStyle,design.hairStyle);assert.equal(changed.eyeColor,design.eyeColor);
});

test('All 810 appearance silhouettes fit one draw and the 5k near budget with valid GPU skinning',()=>{
  let maximum=0,minHeight=Infinity,maxHeight=0,maxBytes=0;
  for(const hairStyle of AVATAR_OPTIONS.hairStyle)for(const eyeStyle of AVATAR_OPTIONS.eyeStyle)for(const mouthStyle of AVATAR_OPTIONS.mouthStyle)for(const topStyle of AVATAR_OPTIONS.topStyle)for(const bottomStyle of AVATAR_OPTIONS.bottomStyle)for(const faceLines of AVATAR_OPTIONS.faceLines){
    const m=createAvatarModel({...DEFAULT_AVATAR_DESIGN,hairStyle,eyeStyle,mouthStyle,topStyle,bottomStyle,faceLines});validGeometry(m);
    assert.equal(m.root.scale.x,1);assert.equal(m.root.scale.y,1);assert.equal(m.root.scale.z,1);
    assert.equal(m.stats.draws,1);assert.equal(m.stats.materials,1);assert.equal(m.stats.imageTextures,0);assert.ok(m.stats.triangles<=AVATAR_BUDGET.triangles);
    assert.equal(m.mesh.material.map,null);assert.equal(m.mesh.material.transparent,false);assert.equal(m.mesh.material.vertexColors,true);
    assert.equal(m.bones.length,17);assert.equal(m.mesh.skeleton,m.skeleton);
    const bounds=m.mesh.geometry.boundingBox!,size=bounds.getSize(new Vector3());
    assert.ok(bounds.min.y>=-.002&&bounds.min.y<.01,'feet rest on metre floor');assert.ok(size.y>1.42&&size.y<1.55);assert.ok(size.x<.8);
    maximum=Math.max(maximum,m.stats.triangles);maxBytes=Math.max(maxBytes,m.stats.geometryBytes);minHeight=Math.min(minHeight,size.y);maxHeight=Math.max(maxHeight,size.y);m.dispose();
  }
  console.log('avatar full-variant envelope',{maximumTriangles:maximum,maxBytes,minHeight,maxHeight,draws:1,imageTextures:0});
});

test('Idle, walking, running, emotes and blinks preserve placement and immutable geometry',()=>{
  const m=createAvatarModel(),g=m.mesh.geometry,buffers=Object.values(g.attributes).map(a=>a.array.slice());
  m.root.position.set(2,3,4);m.root.rotation.set(.1,.7,.2);const position=m.root.position.clone(),rotation=m.root.quaternion.clone();
  for(let i=0;i<120;i++)m.update(1/60,{speed:3.5});assert.ok(m.getState().speed>3.49);
  assert.ok(Math.abs(m.bones[9].rotation.x)>.01);assert.ok(Math.abs(m.bones[10].rotation.x)+Math.abs(m.bones[13].rotation.x)>.1);
  for(let i=0;i<60;i++)m.update(1/60,{emote:'wave'});assert.ok(m.bones[6].rotation.z>2);
  for(let i=0;i<60;i++)m.update(1/60,{emote:'cheer'});assert.ok(m.bones[3].rotation.z < -2);assert.ok(m.bones[6].rotation.z>2);
  for(let i=0;i<60;i++)m.update(1/60,{emote:'sit'});assert.ok(m.getState().seated>.99);assert.ok(m.bones[0].position.y<.38);
  m.root.updateMatrixWorld(true);m.skeleton.update();const seatedBounds=new Box3(),vertex=new Vector3();
  for(let i=0;i<g.getAttribute('position').count;i++){vertex.fromBufferAttribute(g.getAttribute('position'),i);m.mesh.applyBoneTransform(i,vertex);seatedBounds.expandByPoint(vertex);}
  assert.ok(seatedBounds.min.y>-.012&&seatedBounds.min.y<.025,'seated soles remain on the root floor');
  for(let i=0;i<60;i++)m.update(1/60,{speed:1.7,emote:'sit'});assert.ok(m.getState().seated<.001,'walking exits sit');
  let blinkSeen=false;for(let i=0;i<480;i++){m.update(1/60);if(m.getState().blink<.2)blinkSeen=true;}assert.ok(blinkSeen);
  m.update(.1,{reducedMotion:true});assert.equal(m.getState().blink,1);
  assert.ok(m.root.position.equals(position));assert.ok(m.root.quaternion.equals(rotation));
  Object.values(g.attributes).forEach((a,i)=>assert.deepEqual(a.array,buffers[i]));
  const state=m.getState();for(const dt of [NaN,Infinity,-1])m.update(dt,{speed:3.5});assert.deepEqual(m.getState(),state);
  m.dispose();m.update(.1);assert.ok(m.getState().disposed);
});

test('Walking and running clocks agree at 30, 60 and 120 Hz',()=>{
  const values=[30,60,120].map(hz=>{const m=createAvatarModel();for(let i=0;i<hz*2;i++)m.update(1/hz,{speed:3.5});const state=m.getState();m.dispose();return state;});
  for(const value of values){assert.ok(Math.abs(value.phase-values[0].phase)<1e-10);assert.ok(Math.abs(value.speed-values[0].speed)<1e-10);}
});

test('LOD preserves one draw, complete skinning and controller identity across hairstyles',async()=>{
  for(const hairStyle of AVATAR_OPTIONS.hairStyle){
    const m=createAvatarModel({...DEFAULT_AVATAR_DESIGN,hairStyle}),lod=createLodController(),camera=new PerspectiveCamera(45,1,.1,100);camera.position.set(0,1.1,4);camera.lookAt(0,.7,0);await lod.register(m.root);
    const skeleton=m.mesh.skeleton,bones=m.bones,root=m.root;const stats=lod.stats(root);console.log('avatar LOD',hairStyle,stats);
    assert.equal(stats.near.draws,1);assert.equal(stats.mid.draws,1);assert.equal(stats.far.draws,1);assert.ok(stats.mid.triangles<stats.near.triangles);assert.ok(stats.far.triangles<=stats.mid.triangles);
    for(const level of ['near','mid','far'] as const){lod.setMode(level);lod.update(camera,800,.1,true);validGeometry(m);m.update(.1,{speed:3.5,emote:'wave'});assert.equal(m.root,root);assert.equal(m.mesh.skeleton,skeleton);assert.equal(m.bones,bones);}
    m.dispose();assert.equal(lod.size,0);lod.dispose();
  }
});

test('Owned skeleton, geometry and renderer-converted materials dispose once',()=>{
  for(const convert of [false,true]){
    const m=createAvatarModel(),source=m.mesh.material;let sourceCount=0,nodeCount=0,geometryCount=0,skeletonCount=0;
    source.addEventListener('dispose',()=>sourceCount++);m.mesh.geometry.addEventListener('dispose',()=>geometryCount++);
    const release=m.skeleton.dispose.bind(m.skeleton);m.skeleton.dispose=()=>{skeletonCount++;release();};
    if(convert){applyNodeStyle(m.root);m.mesh.material.addEventListener('dispose',()=>nodeCount++);}
    m.dispose();m.dispose();assert.equal(sourceCount,1);assert.equal(nodeCount,convert?1:0);assert.equal(geometryCount,1);assert.equal(skeletonCount,1);
  }
});


test('Carrying keeps a usable hand anchor and casting plays once per emote transition',()=>{
  const m=createAvatarModel();for(let i=0;i<90;i++)m.update(1/60,{carrying:true});
  assert.ok(m.getState().carrying>.99);assert.ok(m.bones[6].rotation.x<-.70);assert.ok(m.bones[8].rotation.x>1.7);
  const carryArm=m.bones[6].rotation.x,source=m.mesh.geometry.getAttribute('position').array.slice();
  m.update(.1,{carrying:true,emote:'cast'});assert.ok(m.getState().casting);assert.equal(m.getState().castCount,1);
  for(let i=0;i<20;i++)m.update(1/60,{carrying:true,emote:'cast'});assert.ok(m.bones[6].rotation.x<carryArm-.8);
  for(let i=0;i<180;i++)m.update(1/60,{carrying:true,emote:'cast'});assert.equal(m.getState().casting,false);assert.equal(m.getState().castCount,1);assert.equal(m.getState().castProgress,1);assert.ok(Math.abs(m.bones[6].rotation.x-carryArm)<.001);
  for(let i=0;i<60;i++)m.update(1/60,{carrying:true,emote:'wave'});assert.ok(m.bones[6].rotation.z>2);
  m.update(.1,{carrying:true,emote:'cast'});assert.equal(m.getState().castCount,2);assert.ok(m.getState().casting);
  assert.deepEqual(m.mesh.geometry.getAttribute('position').array,source);m.dispose();
});


test('Face lines remain subtle head-bound geometry with no change to legacy default appearance',async()=>{
  const {faceLines: omitted,...legacy}=DEFAULT_AVATAR_DESIGN;
  const plain=createAvatarModel(),old=createAvatarModel(normalizeAvatarDesign(legacy));
  assert.equal(omitted,'none');assert.equal(old.design.faceLines,'none');assert.deepEqual(old.mesh.geometry.getAttribute('position').array,plain.mesh.geometry.getAttribute('position').array);
  assert.equal(normalizeAvatarDesign({...legacy,faceLines:'unrecognized'}).faceLines,'none');
  const baseTriangles=plain.stats.triangles;old.dispose();plain.dispose();
  for(const faceLines of ['soft','defined'] as const)for(const skinTone of AVATAR_OPTIONS.skinTone){
    const m=createAvatarModel({...DEFAULT_AVATAR_DESIGN,faceLines,skinTone}),g=m.mesh.geometry;
    const p=g.getAttribute('position'),n=g.getAttribute('normal'),c=g.getAttribute('color'),j=g.getAttribute('skinIndex'),w=g.getAttribute('skinWeight');
    const shade=new Color(skinTone).multiplyScalar(faceLines==='defined'?.61:.77);let lines=0;
    for(let i=0;i<p.count;i++)if(Math.abs(c.getX(i)-shade.r)<1e-6&&Math.abs(c.getY(i)-shade.g)<1e-6&&Math.abs(c.getZ(i)-shade.b)<1e-6){
      lines++;assert.equal(j.getX(i),2);assert.equal(w.getX(i),1);assert.ok(n.getZ(i)>.3,'crease faces outward');
      const x=p.getX(i),y=p.getY(i),headZ=.235*Math.sqrt(Math.max(.02,1-(x/.267)**2-((y-1.18)/.252)**2));
      assert.ok(Math.abs(p.getZ(i)-headZ-.0032)<1e-6,'crease follows curved head surface');
    }
    assert.ok(lines>20);assert.ok(m.stats.triangles-baseTriangles>0&&m.stats.triangles-baseTriangles<250);assert.equal(m.stats.draws,1);assert.equal(m.stats.imageTextures,0);
    if(skinTone===AVATAR_OPTIONS.skinTone[0]){
      const lod=createLodController();await lod.register(m.root);const stats=lod.stats(m.root);console.log('avatar face lines',faceLines,m.stats,stats);
      assert.equal(stats.far.draws,1);assert.ok(stats.far.triangles<stats.near.triangles);lod.dispose();
    }
    m.dispose();
  }
});
