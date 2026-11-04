import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Mesh,Vector3} from 'three';
import {createAquarium,AQUARIUM_BUDGET} from '../src/models/aquarium/createAquarium';
import {AQUARIUM_ANCHOR,AQUARIUM_HEADING,PLACES,TANKS,EDGES,WAYPOINTS,UPPER_FLOOR,routeTo,tankOutline,type Point} from '../src/models/aquarium/layout';
import data from '../src/data/monterey-map.json';
import {project} from '../src/viewer/mapStudy';
const building=data.buildings.find(b=>b.tags.name==='Monterey Bay Aquarium')!;
const outer=building.rings[0].map(p=>{const v=project(p as [number,number],[...AQUARIUM_ANCHOR]);const c=Math.cos(AQUARIUM_HEADING),s=Math.sin(AQUARIUM_HEADING);return [c*v.x+s*v.y,-s*v.x+c*v.y] as Point;});
const model=createAquarium(outer);
test('Aquarium preserves metre-scale anchors and published tank envelopes',()=>{
  assert.deepEqual(model.root.scale.toArray(),[1,1,1]);
  assert.equal(TANKS.find(t=>t.id==='kelp')!.size[2],28*.3048);
  assert.equal(TANKS.find(t=>t.id==='otters')!.size[2],15*.3048);
  const open=TANKS.find(t=>t.id==='open-sea')!;open.size.forEach((v,i)=>assert.ok(Math.abs(v-[52,90,35][i]*.3048)<1e-10));
  const bounds=new Box3().setFromObject(model.root).getSize(new Vector3());
  assert.ok(bounds.x>185&&bounds.x<200);assert.ok(bounds.z>120&&bounds.z<140);assert.ok(bounds.y>=10.668);
  assert.equal(UPPER_FLOOR,5.2);assert.ok(TANKS.every(t=>t.evidence.length>40));
});
test('Both public floors stay within triangle/draw budgets and contain no group draw splits',()=>{
  for(const floor of [0,1] as const){model.setFloor(floor);const s=model.stats();assert.ok(s.triangles<=AQUARIUM_BUDGET.triangles,JSON.stringify(s));assert.ok(s.draws<=AQUARIUM_BUDGET.draws);}
  model.root.traverse(o=>{if(o instanceof Mesh){assert.equal(o.geometry.groups.length,0);assert.ok(o.geometry.attributes.color);}});
});
function inside(p:Point,ring:Point[]){let result=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
test('Every destination has a connected route; gallery routes avoid all tank envelopes',()=>{
  for(const p of PLACES){const r=routeTo(p.id);assert.equal(r.path[0].id,'entrance');assert.equal(r.path.at(-1)!.id,p.id);assert.ok(Number.isFinite(r.distance));}
  assert.throws(()=>routeTo('missing'));
  for(const [a,b] of EDGES){const start=WAYPOINTS.find(p=>p.id===a)!,end=WAYPOINTS.find(p=>p.id===b)!;
    if(start.floor!==end.floor){assert.deepEqual(start.point,end.point);assert.match(a,/lift/);continue;}
    for(let i=0;i<=100;i++){
      const t=i/100,p:Point=[start.point[0]*(1-t)+end.point[0]*t,start.point[1]*(1-t)+end.point[1]*t];
      for(const tank of TANKS.filter(t=>t.floors.includes(start.floor)))assert.ok(!inside(p,tankOutline(tank)),`${a} → ${b} intersects ${tank.id}`);
    }
  }
});
test('Geographic orientation does not resize or mirror the interior',()=>{
  const group=model.root;group.rotation.y=AQUARIUM_HEADING;group.updateMatrixWorld(true);
  const x=group.localToWorld(new Vector3(10,0,0)),bay=group.localToWorld(new Vector3(0,0,-10));
  assert.ok(Math.abs(x.length()-10)<1e-10&&Math.abs(bay.length()-10)<1e-10);assert.ok(x.x>0&&x.z>0&&bay.x>0&&bay.z<0);
});
