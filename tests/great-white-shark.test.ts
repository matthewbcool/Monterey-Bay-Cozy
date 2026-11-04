import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Mesh,MeshToonMaterial,Raycaster,SkinnedMesh,Vector3,type BufferGeometry} from 'three';
import {createGreatWhiteSharkModel} from '../src/models/great-white-shark/createGreatWhiteSharkModel';
import {GREAT_WHITE} from '../src/models/great-white-shark/definition';
import {buildSharkFins} from '../src/models/great-white-shark/fins';
import {buildSharkFace} from '../src/models/great-white-shark/face';
import {createModelAssembly,disposeModelResources} from '../src/models/shared/assembly';
import {buildFishBody} from '../src/models/shared/fish/body';
import {createToonMaterial,exportableClone} from '../src/models/shared/style';
import {createSwimmer,TANK_SIZE} from '../src/viewer/swimPath';

function stats(root:Mesh['parent']) {
  let triangles=0,draws=0;root!.traverseVisible(o=>{if(o instanceof Mesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  return {triangles,draws};
}
test('Shark keeps two matte toon draws and finite normalized weights over 60 seeded specimens',()=>{
  for(let seed=0;seed<60;seed++) {
    const m=createGreatWhiteSharkModel({seed});assert.equal(m.root.userData.seed,seed);
    assert.deepEqual(stats(m.root),{triangles:1908,draws:2});
    assert.ok(stats(m.root).triangles<=GREAT_WHITE.budget.triangles);
    m.root.traverse(o=>{if(o instanceof Mesh){
      assert.ok(o.material instanceof MeshToonMaterial);assert.equal(o.material.userData.rim,false);
      for(const attribute of Object.values((o.geometry as BufferGeometry).attributes))assert.ok(Array.from(attribute.array).every(Number.isFinite));
      const w=o.geometry.attributes.skinWeight;
      for(let i=0;i<w.count;i++)assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-6);
    }});
    m.setLifeState('caught');assert.deepEqual(stats(m.root),{triangles:1648,draws:2});m.dispose();m.dispose();
  }
  const a=createGreatWhiteSharkModel({seed:42}),b=createGreatWhiteSharkModel({seed:42}),c=createGreatWhiteSharkModel({seed:7});
  const positions=(m:typeof a)=>(m.parts.get('surface')!.children[0] as Mesh).geometry.attributes.position.array;
  assert.deepEqual(positions(a),positions(b));assert.notDeepEqual(positions(a),positions(c));[a,b,c].forEach(m=>m.dispose());
});
test('Shark metre size, ventral mouth and physics proxies scale together without scaling the root',()=>{
  const a=createGreatWhiteSharkModel({seed:42}),b=createGreatWhiteSharkModel({seed:42,lengthMeters:6});
  const size=(m:typeof a)=>new Box3().setFromObject(m.root,true).getSize(new Vector3());
  assert.ok(Math.abs(size(a).x-4)<1e-5);assert.ok(Math.abs(size(b).x-6)<1e-5);
  assert.ok(Math.abs(size(b).z/size(a).z-1.5)<1e-6);
  assert.deepEqual(a.root.scale.toArray(),[1,1,1]);assert.deepEqual(a.visual.scale.toArray(),[1,1,1]);
  assert.ok(Math.abs(b.physics.colliders[0].radius/a.physics.colliders[0].radius-1.5)<1e-10);
  assert.ok(a.physics.anchors.mouth[1]<0);
  a.physics.anchors.mouth.forEach((value,i)=>assert.ok(Math.abs(b.physics.anchors.mouth[i]-value*1.5)<1e-8));
  a.dispose();b.dispose();for(const lengthMeters of [0,-1,NaN,Infinity])assert.throws(()=>createGreatWhiteSharkModel({lengthMeters}));
  for(const seed of [-1,.5,NaN,2**32])assert.throws(()=>createGreatWhiteSharkModel({seed}));
});
test('Shark fin roots intersect the actual body and foil faces point outward',()=>{
  const a=createModelAssembly('shark-attachment'),material=createToonMaterial({vertexColors:true});
  buildFishBody(a,GREAT_WHITE,material,(_x,_h,_s,c)=>c.set('#ffffff'),1);
  buildSharkFins(a,GREAT_WHITE,material,1);buildSharkFace(a,GREAT_WHITE,material,1);a.root.updateMatrixWorld(true);
  const body=a.parts.get('body')!.children[0] as Mesh,ray=new Raycaster();
  // Sample the full line between the two buried root corners, including the thin lower fins.
  for(const side of [-1,1])for(const kind of ['pectoral','pelvic']) {
    const mesh=a.parts.get(`${kind}-${side}`)!.children[0] as Mesh,g=mesh.geometry;
    assert.ok(g.attributes.normal.getY(7)>.7,'upper foil faces outward');
    const [start,end]=g.userData.rootSeam as [number[],number[]],first=new Vector3().fromArray(start),last=new Vector3().fromArray(end);
    for(let i=0;i<=8;i++) {
      const p=first.clone().lerp(last,i/8);
      ray.set(new Vector3(p.x,-2,p.z),new Vector3(0,1,0));const hit=ray.intersectObject(body)[0];
      assert.ok(hit,`${kind} root must be under body footprint`);assert.ok(p.y-hit.point.y>.001,`${kind} seam must be embedded`);
    }
  }
  const marks=a.parts.get('gills-mouth-nares')!;assert.equal(marks.children.filter(o=>o.name.includes(':gill-')).length,10);
  for(const gill of marks.children.filter(o=>o.name.includes(':gill-')) as Mesh[]){
    const n=gill.geometry.attributes.normal;for(let i=0;i<n.count;i++)assert.equal(Math.sign(n.getZ(i)),gill.name.includes('gill--1')?-1:1,'slit faces outward on either flank');
  }
  for(const group of a.parts.values())for(const mesh of group.children as Mesh[]){
    const g=mesh.geometry;if(!g.userData.rootSeam)continue;
    // Every edge in the closed fin shell must have two incident triangles.
    const edges=new Map<string,number>(),index=g.index!;
    for(let i=0;i<index.count;i+=3)for(let j=0;j<3;j++){
      const a=index.getX(i+j),b=index.getX(i+(j+1)%3),key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)??0)+1);
    }
    assert.ok([...edges.values()].every(n=>n===2),mesh.name+' must be closed');
  }
  assert.ok(marks.children.some(o=>o.name.endsWith(':ventral-mouth')));disposeModelResources(a.root);
});
test('Fast swimming preserves shark fins, animates tail without buffer uploads, and caught/physics freeze placement',()=>{
  const m=createGreatWhiteSharkModel({seed:42}),skin=m.parts.get('surface')!.children[0] as SkinnedMesh;
  const attributes=Object.values(skin.geometry.attributes),arrays=attributes.map(a=>a.array);
  const p=skin.geometry.attributes.position,finIndices:number[]=[],tailIndices:number[]=[];
  for(let i=0;i<p.count;i++){if(p.getY(i)>.8&&p.getX(i)<0||Math.abs(p.getZ(i))>1)finIndices.push(i);if(p.getX(i)>1.7)tailIndices.push(i);}
  const vertices=(indices:number[])=>{m.root.updateMatrixWorld(true);return indices.map(i=>skin.getVertexPosition(i,new Vector3()));};
  const fins=vertices(finIndices),tail=vertices(tailIndices);assert.ok(fins.length>5);
  m.setSwimMode('fast',true);for(let i=0;i<9;i++)m.update(.1);
  vertices(finIndices).forEach((v,i)=>assert.ok(v.distanceTo(fins[i])<1e-6,'dorsal/pectoral tips stay extended'));
  assert.ok(vertices(tailIndices).some((v,i)=>v.distanceTo(tail[i])>.05));
  attributes.forEach((a,i)=>assert.equal(a.array,arrays[i]));
  m.setLifeState('caught');const phase=m.getState().phase;m.update(.1);assert.equal(m.getState().phase,phase);assert.equal(m.getState().frequency,0);
  assert.ok(m.parts.get('caught-details')!.visible&&!m.parts.get('head-details')!.visible);
  m.setLifeState('alive');m.setMotionOwner('physics');m.root.position.set(2,3,4);const swimmer=createSwimmer(m);swimmer.update(.1,1);m.update(.1);assert.deepEqual(m.root.position.toArray(),[2,3,4]);
  m.setMotionOwner('external');swimmer.resume();for(let i=0;i<1500;i++){swimmer.update(.1,1);assert.ok(Math.abs(m.root.position.x)+2<TANK_SIZE.width/2);assert.ok(Math.abs(m.root.position.z)+2<TANK_SIZE.depth/2);}
  m.dispose();
});
test('Exported shark owns a connected skeleton and leaves live toon materials untouched',()=>{
  const m=createGreatWhiteSharkModel({seed:42}),copy=exportableClone(m.root),objects=new Set();
  copy.clone.traverse(o=>objects.add(o));let skins=0;
  copy.clone.traverse(o=>{if(o instanceof SkinnedMesh){skins++;assert.ok(o.skeleton.bones.every(b=>objects.has(b)));assert.ok(o.material!== (m.parts.get('surface')!.children[0] as Mesh).material);}});
  assert.equal(skins,1);assert.ok((m.parts.get('surface')!.children[0] as Mesh).material instanceof MeshToonMaterial);copy.dispose();m.dispose();
});
