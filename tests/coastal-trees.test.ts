import assert from 'node:assert/strict';
import test from 'node:test';
import {Box3,Mesh,Vector3,InstancedMesh,Matrix4} from 'three';
import {TREE_SPECIES,createCoastalTree,type TreeSpecies} from '../src/models/habitat/trees/createCoastalTree';
import {disposeObject} from '../src/models/props/primitives';
import {prepareGeometryLods,triangles} from '../src/models/shared/lod/geometry';
import {PARK_TREES,TREE_PLACEMENT_OVERRIDES} from '../src/viewer/testingGym/placement';
import {createParkNature} from '../src/viewer/testingGym/nature';
import {mulberry32} from '../src/models/shared/random';
import {TREE_SCALE_STUDY} from '../src/viewer/testingGym/treeScaleStudy';
import features from '../src/data/lovers-point-features.json';
import {pathStyle} from '../src/viewer/testingGym/pathStyle';
import inventory from '../src/data/lovers-point-trees.json';
for(const species of Object.keys(TREE_SPECIES) as TreeSpecies[])test(`${species}: 40 reproducible seeds, exact height, low geometry and owned LODs`,async()=>{
 for(let seed=0;seed<40;seed++){
  const root=createCoastalTree({species,seed}),copy=createCoastalTree({species,seed});
  const mesh=root.children[0] as Mesh,other=copy.children[0] as Mesh,bounds=new Box3().setFromObject(root);
  assert.equal(root.children.length,1);assert.deepEqual(root.scale.toArray(),[1,1,1]);
  assert(Math.abs(bounds.min.y)<1e-5);assert(Math.abs(bounds.max.y-TREE_SPECIES[species].height)<1e-5);
  assert.deepEqual(mesh.geometry.attributes.position.array,other.geometry.attributes.position.array);
  assert(triangles(mesh.geometry)<=260);assert(!Array.isArray(mesh.material)&&!mesh.material.transparent);
  const levels=await prepareGeometryLods(mesh.geometry);
  assert(triangles(levels.far)<triangles(levels.near)*.7);assert(triangles(levels.mid)<=triangles(levels.near));
  const counts=new Map(Object.values(levels).map(g=>[g,0]));for(const g of counts.keys())g.addEventListener('dispose',()=>counts.set(g,counts.get(g)!+1));
  disposeObject(root);assert([...counts.values()].every(n=>n===1));disposeObject(copy);
 }
});
test('park records preserve source coordinates and species with explicit trail overrides; native showcase trees are not planted speculatively',()=>{
 assert.equal(PARK_TREES.length,52);assert.equal(new Set(PARK_TREES.map(t=>t.sourceId)).size,52);
 assert.equal(PARK_TREES.filter(t=>t.species==='monterey-cypress').length,43);
 assert(!PARK_TREES.some(t=>t.species==='monterey-pine'||t.species==='coast-live-oak'));
 for(const tree of PARK_TREES){const k=Math.PI/180*6371008.8;assert(Math.abs(tree.original[0]-(tree.longitude-inventory.origin[0])*k*Math.cos(inventory.origin[1]*Math.PI/180))<.00051);assert(Math.abs(tree.original[1]+(tree.latitude-inventory.origin[1])*k)<.00051);}
});
test('bike path and crossing stay clear of every trunk and its collision radius',()=>{
 const trails=features.paths.filter(p=>p.highway==='cycleway'||p.tags.name==='Monterey Bay Coastal Trail');
 assert.equal(trails.length,2);
 assert.deepEqual(PARK_TREES.filter(t=>t.x!==t.original[0]||t.z!==t.original[1]).map(t=>t.sourceId).sort(),[4869,4870,4871]);
 for(const tree of PARK_TREES){
  const source=inventory.trees.find(t=>t.sourceId===tree.sourceId)!;
  assert.deepEqual(tree.original.slice(0,2),[source.x,source.z]);
  assert.deepEqual([tree.x,tree.z],TREE_PLACEMENT_OVERRIDES[tree.sourceId]??[source.x,source.z]);
  for(const path of trails)for(let i=1;i<path.points.length;i++){
   const a=path.points[i-1],b=path.points[i],dx=b[0]-a[0],dz=b[1]-a[1];
   const t=Math.max(0,Math.min(1,((tree.x-a[0])*dx+(tree.z-a[1])*dz)/(dx*dx+dz*dz)));
   assert(Math.hypot(tree.x-a[0]-t*dx,tree.z-a[1]-t*dz)>=pathStyle(path).width/2+tree.trunkRadius+.75,`Tree ${tree.sourceId} blocks ${path.id}`);
  }
 }
});
test('spatial tree batches preserve exact source positions, scale, IDs and shared geometry',()=>{
 const nature=createParkNature(mulberry32(6256),(x,z)=>x*.01+z*.02);for(const tree of PARK_TREES)nature.tree(tree);const root=nature.finish();
 try{let count=0;const bySpecies=new Map(),matrix=new Matrix4(),p=new Vector3(),s=new Vector3();
 for(const child of root.children){const batch=child as InstancedMesh;if(!batch.userData.treeSourceIds)continue;count+=batch.count;
  const species=batch.name.split(':')[0];if(bySpecies.has(species))assert.equal(bySpecies.get(species),batch.geometry);else bySpecies.set(species,batch.geometry);
  for(let i=0;i<batch.count;i++){const tree=PARK_TREES.find(t=>t.sourceId===batch.userData.treeSourceIds[i])!;batch.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix);s.setFromMatrixScale(matrix);assert(Math.abs(p.x-tree.x)<1e-5&&Math.abs(p.z-tree.z)<1e-5);assert(Math.abs(p.y-tree.x*.01-tree.z*.02)<1e-5);assert(Math.abs(s.y-tree.height)<1e-5);}
 }assert.equal(count,52);assert.equal(root.children.length,5);
 }finally{disposeObject(root);}
});

test('the Beach House grove towers over the roof without relocating or enlarging every tree',async()=>{
 const studied=PARK_TREES.filter(t=>t.heightBasis==='photo-based site estimate');assert.equal(studied.length,14);
 const largest=PARK_TREES.find(t=>t.sourceId===4852)!;assert.equal(largest.height,22);assert.equal(largest.heightUncertaintyMetres,3);
 for(const [id,height] of Object.entries(TREE_SCALE_STUDY.heights)){
  const tree=PARK_TREES.find(t=>t.sourceId===Number(id))!,source=inventory.trees.find(t=>t.sourceId===Number(id))!;
  assert.equal(tree.height,height);assert.equal(tree.x,source.x);assert.equal(tree.z,source.z);assert.equal(tree.species,source.species);
  assert(tree.height>11.5,'Mature grove should rise above the Beach House representative roof');assert(tree.trunkRadius<.7,'Taller crown must not create an oversized trunk obstacle');
 }
 assert.equal(PARK_TREES.find(t=>t.sourceId===4845)!.height,2.8,'Young point-side replacement stays small');
 assert.equal(PARK_TREES.find(t=>t.sourceId===4843)!.height,9,'Exposed perimeter is not enlarged uniformly');
 // Source positions relative to the house and road remain intact.
 assert(largest.x>40&&largest.z<-30);assert(PARK_TREES.find(t=>t.sourceId===4828)!.x<0);
 const root=createCoastalTree({species:'monterey-cypress',seed:734,heightMetres:22});
 try{const mesh=root.children[0] as Mesh,levels=await prepareGeometryLods(mesh.geometry);for(const g of Object.values(levels)){g.computeBoundingBox();assert(Math.abs(g.boundingBox!.max.y-22)<.00001);assert(Math.abs(g.boundingBox!.min.y)<.00001);}
  // At ankle level only the slim trunk is present, so visual and collision sizes agree.
  const p=mesh.geometry.attributes.position;let radius=0;for(let i=0;i<p.count;i++)if(p.getY(i)<.1)radius=Math.max(radius,Math.hypot(p.getX(i),p.getZ(i)));
  assert(radius<largest.trunkRadius&&radius>.35,`Mature trunk radius ${radius}`);
 }finally{disposeObject(root);}
});
