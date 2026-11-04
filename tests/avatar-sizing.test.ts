import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { AVATAR_SIZE_LIMITS, createAvatarModel, DEFAULT_AVATAR_DESIGN, normalizeAvatarDesign, type AvatarMotion } from '../src/models/avatar';
import { avatarDownload, parseAvatarCollection, parseAvatarDownload } from '../src/data/avatarSaves';
import { createLodController } from '../src/models/shared/lod/controller';

const sizes = [[1.20,.80],[1.20,1.25],[1.45,1],[1.80,.80],[1.80,1.25]] as const;
const looks = [
  {hairStyle:'sweep',topStyle:'tee',bottomStyle:'shorts',faceLines:'none'},
  {hairStyle:'bun',topStyle:'hoodie',bottomStyle:'skirt',faceLines:'defined'},
  {hairStyle:'bob',topStyle:'vest',bottomStyle:'trousers',faceLines:'soft'},
] as const;
const hash = (array: ArrayBufferView) => createHash('sha256').update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
const close = (a:number,b:number,epsilon=1e-6) => assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
function settle(m:ReturnType<typeof createAvatarModel>,motion:AvatarMotion) {for(let i=0;i<120;i++)m.update(1/60,motion);}

test('Height/build recipes clamp and quantize finite numbers while legacy or invalid fields use defaults',()=>{
  assert.deepEqual(AVATAR_SIZE_LIMITS,{heightMeters:{min:1.20,max:1.80,step:.01,default:1.45},bodyBuild:{min:.80,max:1.25,step:.01,default:1}});
  assert.equal(normalizeAvatarDesign({heightMeters:1.234,bodyBuild:1.127}).heightMeters,1.23);
  assert.equal(normalizeAvatarDesign({heightMeters:1.234,bodyBuild:1.127}).bodyBuild,1.13);
  assert.equal(normalizeAvatarDesign({heightMeters:-5,bodyBuild:999}).heightMeters,1.20);
  assert.equal(normalizeAvatarDesign({heightMeters:999,bodyBuild:-1}).heightMeters,1.80);
  assert.equal(normalizeAvatarDesign({heightMeters:-5,bodyBuild:999}).bodyBuild,1.25);
  assert.equal(normalizeAvatarDesign({bodyBuild:-1}).bodyBuild,.80);
  for(const value of [NaN,Infinity,-Infinity,'1.70',null,{},[],true]) {
    const d=normalizeAvatarDesign({heightMeters:value,bodyBuild:value});assert.equal(d.heightMeters,1.45);assert.equal(d.bodyBuild,1);
  }
  const {heightMeters,bodyBuild,...legacy}=DEFAULT_AVATAR_DESIGN;
  assert.equal(heightMeters,1.45);assert.equal(bodyBuild,1);assert.deepEqual(normalizeAvatarDesign(legacy),DEFAULT_AVATAR_DESIGN);
  assert.deepEqual(normalizeAvatarDesign(JSON.parse(JSON.stringify(normalizeAvatarDesign({heightMeters:1.234,bodyBuild:1.127})))),normalizeAvatarDesign({heightMeters:1.234,bodyBuild:1.127}));
});

test('Version 1 legacy collections/imports retain original size and new numeric choices round trip',()=>{
  const {heightMeters,bodyBuild,...legacy}=DEFAULT_AVATAR_DESIGN;
  for(const design of [legacy,...sizes.map(([heightMeters,bodyBuild])=>({...DEFAULT_AVATAR_DESIGN,...looks[1],heightMeters,bodyBuild}))]) {
    const expected=normalizeAvatarDesign(design),collection={version:1,selectedId:'saved',avatars:[{id:'saved',design,savedAt:''}]};
    assert.deepEqual(parseAvatarCollection(JSON.stringify(collection)).avatars[0].design,expected);
    assert.deepEqual(parseAvatarDownload(JSON.stringify({format:'monterey-bay-cozy-avatar',version:1,design})),expected);
    assert.deepEqual(parseAvatarDownload(avatarDownload(expected)),expected);
  }
});

test('Default size preserves pre-sizing geometry bytes exactly',()=>{
  const expected={
    position:'b3183ff112017552edf04649f59ef4b8e6f025d8311aa9d6705df69f1495b4b0',
    normal:'3526cd68109817b7abe3ac71d7cee4575920d80c37295c3789d3cbf289b69f24',
    color:'8dbbdf0111fc7729493d98a7c9e4a1869d7f1a54d1953876169b4b28b96be3bc',
    skinIndex:'dc96ada2a1f44484c8b31f49d1ef7c2d917ff834ba3d1fcd939207ae205dc0ca',
    skinWeight:'10fd79278b35f7dd2b1ecb30228136f67b8254c4eaba98c12ec4733ee3755014',
    index:'7210cf89141b28281c8980c48a61af54c011f7eb35bf20d19809621eee33fc4f',
  };
  const m=createAvatarModel(),g=m.mesh.geometry;
  for(const [key,value] of Object.entries(expected))assert.equal(hash((key==='index'?g.index!:g.getAttribute(key)).array),value,key);
  assert.deepEqual(m.bones.slice(0,3).map(b=>b.position.toArray()),[[0,.57,0],[0,.18,0],[0,.30,0]]);
  assert.equal(m.stats.triangles,3453);assert.equal(m.stats.geometryBytes,135918);m.dispose();
});

test('Extreme sizes bake metres into outfits and bind pivots, preserve faces and keep identical topology',()=>{
  const vertex=new Vector3(),normal=new Vector3(),anchor=new Vector3();let maximum=0;
  for(const appearance of looks) {
    const base=createAvatarModel({...DEFAULT_AVATAR_DESIGN,...appearance}),source=base.mesh.geometry,p0=source.getAttribute('position'),n0=source.getAttribute('normal'),joint=source.getAttribute('skinIndex');
    base.skeleton.pose();base.root.updateMatrixWorld(true);base.skeleton.update();
    for(const [heightMeters,bodyBuild] of sizes) {
      const m=createAvatarModel({...DEFAULT_AVATAR_DESIGN,...appearance,heightMeters,bodyBuild}),g=m.mesh.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),scale=heightMeters/1.45;
      assert.deepEqual(m.root.scale.toArray(),[1,1,1]);assert.deepEqual(m.visual.scale.toArray(),[1,1,1]);
      assert.equal(m.stats.triangles,base.stats.triangles);assert.equal(m.stats.geometryBytes,base.stats.geometryBytes);assert.equal(m.stats.draws,1);assert.equal(m.stats.materials,1);assert.equal(m.stats.imageTextures,0);maximum=Math.max(maximum,m.stats.triangles);
      for(const key of ['color','skinIndex','skinWeight'])assert.deepEqual(g.getAttribute(key).array,source.getAttribute(key).array);
      assert.deepEqual(g.index!.array,source.index!.array);
      m.skeleton.pose();m.root.updateMatrixWorld(true);m.skeleton.update();
      for(let i=0;i<p.count;i++) {
        assert.ok([p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite));
        close(p.getY(i),p0.getY(i)*scale);
        const head=[2,15,16].includes(joint.getX(i));
        if(head){close(p.getX(i),p0.getX(i)*scale);close(p.getZ(i),p0.getZ(i)*scale);close(n.getX(i),n0.getX(i));close(n.getY(i),n0.getY(i));close(n.getZ(i),n0.getZ(i));}
        else if(p0.getY(i)<.90){close(p.getX(i),p0.getX(i)*bodyBuild*scale);close(p.getZ(i),p0.getZ(i)*bodyBuild*scale);}
        normal.fromBufferAttribute(n,i);if(normal.lengthSq()>.001)close(normal.length(),1,1e-5);
        vertex.fromBufferAttribute(p,i);m.mesh.applyBoneTransform(i,vertex);close(vertex.distanceTo(new Vector3().fromBufferAttribute(p,i)),0,1e-5);
      }
      m.anchors.rightHand.getWorldPosition(anchor);close(anchor.x,.30*bodyBuild*scale);close(anchor.y,.54*scale);close(anchor.z,.018*bodyBuild*scale);
      m.anchors.head.getWorldPosition(anchor);close(anchor.y,1.05*scale);
      close(m.dimensions.controllerRadius,.28*scale*Math.max(1,bodyBuild));close(m.dimensions.swimDepth,.85*scale);close(m.dimensions.swimImmersion,.78*scale);close(m.dimensions.seatedHipHeight,.36*scale);close(m.dimensions.seatedContactHeight,(.36-.09*bodyBuild)*scale);close(m.dimensions.cameraTargetHeight,.78*scale);
      assert.ok(g.boundingBox!.min.y>-.00001);close(g.boundingBox!.max.y,source.boundingBox!.max.y*scale);m.dispose();
    }
    base.dispose();
  }
  console.log('avatar sizing sampled near maximum',{maximumTriangles:maximum,draws:1,imageTextures:0});
});

test('Build-taper normals remain perpendicular to the deformed neck surface',()=>{
  const source=createAvatarModel(),g0=source.mesh.geometry,p0=g0.getAttribute('position'),n0=g0.getAttribute('normal'),joint=g0.getAttribute('skinIndex');
  let checked=0;
  for(const bodyBuild of [.80,1.25]) {
    const m=createAvatarModel({...DEFAULT_AVATAR_DESIGN,bodyBuild}),n=m.mesh.geometry.getAttribute('normal');
    const deform=(v:Vector3)=>{const t=Math.max(0,Math.min(1,(v.y-.90)/.14)),width=1+(bodyBuild-1)*(1-t*t*(3-2*t));return new Vector3(v.x*width,v.y,v.z*width);};
    for(let i=0;i<p0.count;i++)if(joint.getX(i)===1&&p0.getY(i)>.905&&p0.getY(i)<1.035) {
      const point=new Vector3().fromBufferAttribute(p0,i),normal=new Vector3().fromBufferAttribute(n0,i);if(normal.lengthSq()<.5)continue;
      const tangent=new Vector3(0,0,1).cross(normal).normalize();if(tangent.lengthSq()<.5)continue;
      const derivative=deform(point.clone().addScaledVector(tangent,.00001)).sub(deform(point.clone().addScaledVector(tangent,-.00001))).normalize();
      close(derivative.dot(new Vector3().fromBufferAttribute(n,i)),0,.0001);checked++;
    }
    m.dispose();
  }
  assert.ok(checked>20);source.dispose();
});

test('Scaled animation and attachments preserve world placement, equipment scale and static buffers',()=>{
  const motions:AvatarMotion[]=[{speed:0},{speed:1.7},{speed:3.5},{emote:'wave'},{emote:'cheer'},{emote:'sit',reducedMotion:true},{carrying:true},{carrying:true,emote:'cast'},{swimming:true,speed:1.7},{swimming:true,speed:0,reducedMotion:true}];
  for(const [heightMeters,bodyBuild] of sizes) {
    const m=createAvatarModel({...DEFAULT_AVATAR_DESIGN,heightMeters,bodyBuild}),reference=createAvatarModel(),equipment=new Group();equipment.position.set(0,-.14,.03);m.anchors.rightHand.add(equipment);
    m.root.position.set(8,2.4,-4);m.root.rotation.set(.1,.7,.2);const position=m.root.position.clone(),rotation=m.root.quaternion.clone(),scale=m.dimensions.heightScale;
    const buffers=Object.fromEntries(Object.entries(m.mesh.geometry.attributes).map(([key,a])=>[key,hash(a.array)]));
    for(const motion of motions) {
      settle(m,motion);settle(reference,motion);close(m.bones[0].position.y,reference.bones[0].position.y*scale,1e-9);
      m.bones.forEach((b,i)=>{close(b.rotation.x,reference.bones[i].rotation.x,1e-12);close(b.rotation.y,reference.bones[i].rotation.y,1e-12);close(b.rotation.z,reference.bones[i].rotation.z,1e-12);});
      assert.ok(m.root.position.equals(position));assert.ok(m.root.quaternion.equals(rotation));assert.deepEqual(m.root.scale.toArray(),[1,1,1]);assert.deepEqual(m.visual.scale.toArray(),[1,1,1]);
      m.root.updateMatrixWorld(true);const equipmentScale=equipment.getWorldScale(new Vector3());equipmentScale.toArray().forEach(v=>close(v,1,1e-9));
      if(motion.emote==='sit')close(m.bones[0].position.y,m.dimensions.seatedHipHeight,1e-7);
    }
    for(const [key,a] of Object.entries(m.mesh.geometry.attributes))assert.equal(hash(a.array),buffers[key]);
    assert.deepEqual(equipment.position.toArray(),[0,-.14,.03]);m.dispose();reference.dispose();
  }
});

test('Every size and LOD contains animated reach and keeps scaled swimmers above the water',async()=>{
  const camera=new PerspectiveCamera(45,1,.1,100);camera.position.set(0,1.2,4);camera.lookAt(0,.8,0);
  const point=new Vector3(),face=new Vector3();let minimumScaledClearance=Infinity;const costs=[];
  for(const [heightMeters,bodyBuild] of sizes) {
    const m=createAvatarModel({...DEFAULT_AVATAR_DESIGN,...looks[1],heightMeters,bodyBuild}),lod=createLodController(),scale=m.dimensions.heightScale;
    await lod.register(m.root);costs.push({heightMeters,bodyBuild,lod:lod.stats(m.root)});
    for(const level of ['near','mid','far'] as const) {
      lod.setMode(level);lod.update(camera,800,.1,true);const g=m.mesh.geometry,p=g.getAttribute('position'),si=g.getAttribute('skinIndex'),sw=g.getAttribute('skinWeight'),buffer=hash(p.array),sphere=g.boundingSphere!.clone();sphere.radius*=1.4;
      for(let i=0;i<p.count;i++){close(sw.getX(i)+sw.getY(i)+sw.getZ(i)+sw.getW(i),1);for(let k=0;k<4;k++)assert.ok(si.getComponent(i,k)>=0&&si.getComponent(i,k)<17);}
      const motions:AvatarMotion[]=[{speed:3.5},{emote:'cheer'},{emote:'sit',reducedMotion:true},{emote:'cast',carrying:true},{swimming:true,speed:0},{swimming:true,speed:1.7}];
      for(const motion of motions) {
        settle(m,motion);
        for(let frame=0;frame<24;frame++) {
          m.update(1/12,motion);m.root.updateMatrixWorld(true);m.skeleton.update();
          for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);m.mesh.applyBoneTransform(i,point);assert.ok(m.mesh.boundingBox!.containsPoint(point),`${heightMeters}/${bodyBuild} ${level}: fixed box`);assert.ok(m.mesh.boundingSphere!.containsPoint(point),`${heightMeters}/${bodyBuild} ${level}: fixed sphere`);assert.ok(sphere.containsPoint(point),`${heightMeters}/${bodyBuild} ${level}: LOD sphere`);}
          if(motion.swimming){face.set(0,.168*scale,.235*scale).applyMatrix4(m.anchors.head.matrixWorld);const clearance=face.y-m.dimensions.swimImmersion;minimumScaledClearance=Math.min(minimumScaledClearance,clearance/scale);assert.ok(clearance>.12*scale);}
        }
      }
      assert.equal(hash(p.array),buffer);assert.equal(lod.stats(m.root)[level].draws,1);assert.equal(m.stats.imageTextures,0);
    }
    lod.dispose();m.dispose();
  }
  console.log('avatar size/LOD costs',costs);console.log('avatar sizing swim minimum normalized clearance',minimumScaledClearance);
});
