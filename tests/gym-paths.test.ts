import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Group, Mesh, Object3D, Raycaster, Vector3 } from 'three';
import features from '../src/data/lovers-point-features.json';
import { GROUND_KIND, pathStyle } from '../src/viewer/testingGym/pathStyle';
import { ACCESS_SURFACES, addBeachAccess, accessHeight } from '../src/viewer/testingGym/access';
import { disposeObject } from '../src/models/props/primitives';
import { canStandAt, createAvatarController, type GymCollider } from '../src/viewer/avatarController';
import { groundHeight } from '../src/viewer/testingGym/elevation';
import { addShoreEdges } from '../src/viewer/testingGym/shore';

test('path appearance preserves mapped surfaces and the documented two metre width',()=>{
  const path=features.paths.find(p=>p.id==='way/486665218')!;
  assert.equal(pathStyle(path).width,2);
  assert.equal(pathStyle(path).widthBasis,'OSM width');
  assert.equal(pathStyle(path).kind,GROUND_KIND.asphalt);
  const unpaved=features.paths.find(p=>p.id==='way/633871933')!;
  assert.equal(pathStyle(unpaved).kind,GROUND_KIND.gravel);
  const inferred=pathStyle({id:'unknown',highway:'footway',tags:{width:'unknown'}});
  assert.equal(inferred.widthBasis,'authored width');assert.equal(inferred.surfaceBasis,'inferred paving');
  assert.equal(inferred.width,1.85);
});

test('east access uses level turning landings and regular nonreversing risers',()=>{
  const route=ACCESS_SURFACES.filter(p=>p.sourceId==='way/633871947');
  assert(route.length>20);
  const landing=route.filter(p=>p.kind==='landing');
  assert(landing.length>1);assert(landing.every(p=>p.height===landing[0].height));
  let drops=0;
  for(let i=1;i<route.length;i++){
    const drop=route[i-1].height-route[i].height;
    assert(drop>=-1e-7&&drop<=.150001,'Stair cannot reverse direction or have a double riser');
    assert(Math.abs(drop/.15-Math.round(drop/.15))<1e-6);
    if(drop>.1)drops++;
  }
  assert(drops>=30,'Access must retain the full lawn-to-beach descent');
});

test('rendered stair tops match footing and level bends do not stack coincident faces',()=>{
  const root=new Group();addBeachAccess(root);root.updateMatrixWorld(true);
  const slabs=root.children.filter(p=>p instanceof Mesh&&!p.name.includes('handrail'));
  const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));let checks=0;
  try{
    for(const s of ACCESS_SURFACES.filter(s=>['way/633871947','way/633871934'].includes(s.sourceId))){
      // Avoid diagonal triangulation edges, where a ray intentionally hits both adjacent triangles.
      const x=s.x+s.dx*s.length*.137,z=s.z+s.dz*s.length*.137;
      ray.ray.origin.set(x,20,z);const hits=ray.intersectObjects(slabs,false);
      assert(hits.length>0,'Missing rendered stair top');
      assert(Math.abs(hits[0].point.y-accessHeight(x,z))<1e-5,'Visual/physical stair mismatch');
      assert.equal(hits.filter(h=>Math.abs(h.point.y-hits[0].point.y)<1e-5).length,1,'Coplanar stair tops');checks++;
    }
    assert(checks>80);
  }finally{disposeObject(root);}
});

test('court-side beach stairs preserve the broad photo-estimated width through treads, rails and collision clearance',()=>{
  const id='way/633871934',path=features.paths.find(p=>p.id===id)!;
  assert.equal(pathStyle(path).width,4);
  assert.equal(pathStyle(path).widthBasis,'photo-estimated recreation width');
  const route=ACCESS_SURFACES.filter(s=>s.sourceId===id);
  assert(route.every(s=>s.startWidth===4&&s.endWidth===4),'Treads and landings must retain the full four metre width');
  const root=new Group(),colliders:GymCollider[]=[];
  addBeachAccess(root,colliders);addShoreEdges(root,colliders);root.updateMatrixWorld(true);
  const slabs=root.children.filter(p=>p instanceof Mesh&&p.name.includes(`tread · ${id}`));
  const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
  try{
    for(const s of route)for(const across of [-1.55,1.55]){
      const x=s.x+s.dx*s.length*.137-s.dz*across,z=s.z+s.dz*s.length*.137+s.dx*across;
      assert(canStandAt(x,z,{minX:-145,maxX:150,minZ:-160,maxZ:130},colliders,.4),'The widened stair sides must stay walkable');
      ray.ray.origin.set(x,20,z);const hit=ray.intersectObjects(slabs,false)[0];
      assert(hit&&Math.abs(hit.point.y-accessHeight(x,z))<1e-5,'Widened edge must have a matching visible and physical tread');
    }
    const a=path.points[0],direction=route[0];
    const posts=root.children.filter(p=>p.name===`Beach access handrail post · ${id}`);
    assert(posts.length>4);
    for(const post of posts){
      const offset=-(post.position.x-a[0])*direction.dz+(post.position.z-a[1])*direction.dx;
      assert(Math.abs(Math.abs(offset)-2.06)<1e-6,'Rails must follow the widened outside edges');
    }
  }finally{disposeObject(root);}
});

test('court-side flight meets its terrace and beach without a raised rim and is walkable in both directions',()=>{
  const route=ACCESS_SURFACES.filter(s=>s.sourceId==='way/633871934'),first=route[0],last=route.at(-1)!;
  const landing=route.filter(s=>Math.hypot(s.x-first.x,s.z-first.z)<1.2);
  assert(landing.length>=6&&landing.every(s=>s.height===first.height),'Terrace entrance must be a broad level landing');
  for(const end of [first,last])for(const across of [-1.95,0,1.95]){
    const x=end.x-end.dz*across,z=end.z+end.dx*across;
    const clearance=end.height-groundHeight(x,z);
    assert(clearance>=0&&clearance<.12,'Stair endpoint must meet the actual terrace/beach level, not float over it');
  }
  for(let i=1;i<route.length;i++){
    const drop=route[i-1].height-route[i].height;
    assert(drop>=-1e-7&&drop<=.150001,'Descent must retain regular, nonreversing risers');
  }
  assert(first.height-last.height>4,'Flight must descend the full terrace-to-beach height');
  const scenery=new Group(),colliders:GymCollider[]=[];addShoreEdges(scenery,colliders);
  try{
    for(const across of [-1.5,0,1.5]){
      const a={x:first.x-first.dx*.6-first.dz*across,z:first.z-first.dz*.6+first.dx*across};
      const b={x:last.x+last.dx*.6-last.dz*across,z:last.z+last.dz*.6+last.dx*across};
      const root=new Object3D(),controller=createAvatarController({root,spawn:new Vector3(a.x,0,a.z),bounds:{minX:-145,maxX:150,minZ:-160,maxZ:130},colliders,groundHeight:accessHeight,body:{radius:.4,swimDepth:.8,swimImmersion:.7}});
      for(const target of [b,a]){
        for(let i=0;i<600;i++){
          const dx=target.x-root.position.x,dz=target.z-root.position.z,d=Math.hypot(dx,dz);if(d<.08)break;
          controller.update(1/60,{x:dx/d,z:dz/d,run:true});
        }
        assert(Math.hypot(target.x-root.position.x,target.z-root.position.z)<.1,'A player must be able to traverse the widened stair and its landings both ways');
      }
    }
  }finally{disposeObject(scenery);}
});
