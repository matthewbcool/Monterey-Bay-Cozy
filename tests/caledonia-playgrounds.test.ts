import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,Raycaster,Vector3} from 'three';
import {addCaledoniaPlaygrounds} from '../src/viewer/mapStudy/caledoniaPlaygrounds';
import {CALEDONIA,caledoniaHeight} from '../src/viewer/mapStudy/caledonia';
import {disposeObject} from '../src/models/props/primitives';
import {canStandAt} from '../src/viewer/avatarController';
function inside(x:number,z:number,ring:number[][]){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
test('Photo-derived equipment stays inside its mapped bed and leaves timber openings accessible',()=>{
 const root=new Group(),p=addCaledoniaPlaygrounds(root,caledoniaHeight);root.updateMatrixWorld(true);
 assert.equal(p.equipment.length,7);assert.equal(p.entrances.length,2);
 assert.deepEqual(p.entrances[0],[-263.391,233.076],'keep the cached footway entry clear');
 const v=new Vector3(),bounds={minX:-430,maxX:-145,minZ:90,maxZ:450};
 for(const item of p.equipment){
  const group=root.children.find(c=>c.name===item.name);assert(group);
  if(!item.sourceBed)continue;
  const bed=CALEDONIA.features.find(f=>f.id===item.sourceBed)!;
  group.traverse(o=>{if(!(o instanceof Mesh))return;const points=o.geometry.getAttribute('position');for(let i=0;i<points.count;i++){v.fromBufferAttribute(points,i).applyMatrix4(o.matrixWorld);assert(inside(v.x,v.z,bed.points),item.name+' escapes mapped play surface');assert(v.y<=item.top+.001,'flight collision covers render geometry');}});
  assert(!canStandAt(group.position.x,group.position.z,bounds,p.colliders,.3),'equipment has independent walking collision');
 }
 for(const gate of p.entrances)assert(canStandAt(...gate,bounds,p.colliders,.5),'bed opening clears larger avatars');
 const cost={triangles:0};root.traverse(o=>{if(o instanceof Mesh){assert(o.geometry.getAttribute('position').array.every(Number.isFinite));cost.triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;}});
 assert(cost.triangles<=3000,'playground additions fit the district budget without raising its ceiling');
 disposeObject(root);
});
test('Slide floors and both roof pitches face upward and supports meet the ground',()=>{
 const root=new Group();addCaledoniaPlaygrounds(root,caledoniaHeight);root.updateMatrixWorld(true);
 const v=new Vector3(),ray=new Raycaster(),down=new Vector3(0,-1,0);let slides=0,roofs=0,supports=0;
 root.traverse(o=>{
  if(!(o instanceof Mesh))return;
  if(o.name==='Molded slide with raised side lips'){
   const positions=o.geometry.getAttribute('position');
   for(let station=1;station<5;station++){const a=new Vector3().fromBufferAttribute(positions,station*8+2),b=new Vector3().fromBufferAttribute(positions,station*8+3);v.copy(a).lerp(b,.5).applyMatrix4(o.matrixWorld);ray.set(new Vector3(v.x,v.y+2,v.z),down);const hit=ray.intersectObject(o)[0];assert(hit,'slide floor visible from above');assert(Math.abs(hit.point.y-v.y)<.015,'ray reaches the floor, not an inverted underside');}
   slides++;
  }
  if(o.name==='Red playhouse roof'){o.geometry.computeBoundingBox();o.geometry.boundingBox!.getCenter(v).applyMatrix4(o.matrixWorld);ray.set(new Vector3(v.x,v.y+2,v.z),down);assert(ray.intersectObject(o).length>0,'both gable pitches visible from above');roofs++;}
  if(o.name==='Play support grounded in woodchips'){
   const positions=o.geometry.getAttribute('position');let min=Infinity;for(let i=0;i<positions.count;i++){v.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);min=Math.min(min,v.y-caledoniaHeight(v.x,v.z));}assert(min<=.01&&min>-.18,'post meets terrain without floating');supports++;
  }
 });
 assert.equal(slides,5);assert.equal(roofs,2);assert(supports>12);disposeObject(root);
});
