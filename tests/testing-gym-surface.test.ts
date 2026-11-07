import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Group, Mesh, Raycaster, Vector3 } from 'three';
import { createTestingGym } from '../src/viewer/testingGym';
import { groundHeight } from '../src/viewer/testingGym/elevation';
import { addParkBuildings } from '../src/viewer/testingGym/buildings';
import { PARK_TREES } from '../src/viewer/testingGym/placement';
import { prepareGeometryLods } from '../src/models/shared/lod/geometry';
import map from '../src/data/lovers-point-gym.json';
import { disposeObject } from '../src/models/props/primitives';
import { insidePolygon, type GymPoint } from '../src/viewer/avatarController';

// These probes inspect rendered triangles, not renderer bias/material settings.
test('painted terrain covers the land once at every LOD without stacked sheets or ground drift', async()=>{
  const gym=createTestingGym();
  try {
    const ground=gym.root.getObjectByName('gym-ground-surface') as Mesh;
    assert(ground);assert.equal(ground.userData.unpaintedArea,0);
    assert(Math.abs(ground.userData.paintAreas.reduce((sum:number,p:{area:number})=>sum+p.area,0)-ground.userData.planArea)<.01);
    const levels=await prepareGeometryLods(ground.geometry),ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
    const land=[...map.coast,[-145,-135],[-145,130],[72,130]].map(([x,z])=>[x,z] as GymPoint);
    for(const [name,geometry] of Object.entries(levels)) {
      // A categorical material ID must remain flat across a face at every LOD.
      // Interpolated IDs would blend or lose the grass/paving masks in the shader.
      const kinds=geometry.getAttribute('groundKind'),idx=geometry.index;
      assert(kinds&&kinds.count===geometry.attributes.position.count);
      for(let i=0;i<(idx?.count??kinds.count);i+=3){
        const values=[0,1,2].map(k=>kinds.getX(idx?idx.getX(i+k):i+k));
        assert(values.every(v=>Number.isInteger(v)&&v>=0&&v<=6));
        assert(values.every(v=>v===values[0]),name+' mixed ground categories on a face');
      }
      const positions=geometry.getAttribute('position');let renderedArea=0,reversedArea=0;
      for(let i=0;i<(idx?.count??positions.count);i+=3){
        const [a,b,c]=[0,1,2].map(k=>idx?idx.getX(i+k):i+k);
        const signed=((positions.getX(b)-positions.getX(a))*(positions.getZ(c)-positions.getZ(a))-(positions.getZ(b)-positions.getZ(a))*(positions.getX(c)-positions.getX(a)))/2;
        renderedArea+=Math.abs(signed);if(signed>0)reversedArea+=signed;
      }
      assert(Math.abs(renderedArea-ground.userData.planArea)<.05,`${name}: rendered coverage area differs from the land footprint`);
      // Float32 rounding can reverse microscopic slivers, but reduced detail must
      // never fold thin bike-paint triangles across neighbouring ground.
      assert(reversedArea<.0001,`${name}: folded terrain exceeds numerical sliver tolerance`);
      const view=new Mesh(geometry,ground.material);view.updateMatrixWorld(true);
      let checked=0;
      for(let x=-139.137;x<140;x+=7.137)for(let z=-151.319;z<125;z+=7.319) {
        if(!insidePolygon(x,z,land))continue;
        ray.ray.origin.set(x,50,z);const hits=ray.intersectObject(view);
        assert.equal(hits.length,1,`${name}: ${x},${z} has ${hits.length} ground faces`);
        assert(Math.abs(hits[0].point.y-groundHeight(x,z))<.06,`${name}: terrain no longer matches walking height`);checked++;
      }
      assert(checked>600);
      // Dense checks around the authored flats catch cracks or overlapping paint
      // where global terrace polygons join the original DEM subdivisions.
      for(let x=-28.173;x<12;x+=2.173)for(let z=1.319;z<87;z+=2.319){
        ray.ray.origin.set(x,50,z);const hits=ray.intersectObject(view);
        assert.equal(hits.length,1,`${name}: recreation seam at ${x},${z}`);
        assert(Math.abs(hits[0].point.y-groundHeight(x,z))<.06,`${name}: recreation footing drift at ${x},${z}`);
      }
    }
  }finally{gym.dispose();}
});

test('mapped buildings retain footprints and supported foundations with explicit photo height estimates',()=>{
  const parent=new Group();addParkBuildings(parent,[],groundHeight);parent.updateMatrixWorld(true);
  try {
    assert.equal(parent.children.length,map.buildings.length);
    for(const [i,building] of parent.children.entries()) {
      const source=map.buildings[i],meta=building.userData.foundation;
      // October 26 photos distinguish the low cafe/hut from generic 3.5 m masses.
      const wallHeight=source.id==='way/558778075'?8.4:source.id==='way/224525166'?2.45:source.id==='way/931232626'?2.3:source.height;
      assert.equal(meta.sourceId,source.id);assert.equal(meta.wallHeight,wallHeight);
      if(source.id==='way/224525165'){
        assert(Math.abs(meta.base-8.31)<1e-8,'Old bath house lower doors meet the pool promenade');
        assert(meta.terrainMax>meta.base+.5,'Hillside rear must not lift the waterfront floor');
        assert(Math.abs(groundHeight(-12,28.5)+.06-meta.base)<1e-8);
      }else assert(meta.base>meta.terrainMax&&meta.bottom<meta.terrainMax);
      const wall=building.children.find(c=>c.name.includes('mapped footprint / estimated height')) as Mesh;
      wall.geometry.computeBoundingBox();const b=wall.geometry.boundingBox!;
      assert(Math.abs(b.max.y-b.min.y-wallHeight)<.0001);
      assert(Math.abs(b.min.x-Math.min(...source.points.map(p=>p[0])))<.0001);
      if(source.id!=='way/224525165')for(const [x,z] of source.points)assert(groundHeight(x,z)<building.position.y,source.id+' uphill wall buried');
    }
  }finally{disposeObject(parent);}
});

test('bath house waterfront entrances have a continuous lower approach while the rear stays on the hillside',()=>{
  const source=map.buildings.find(b=>b.id==='way/224525165')!,points=source.points;
  const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
  for(let i=6;i<12;i++){
    const a=points[i],b=points[i+1],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=dz/len*Math.sign(area),nz=-dx/len*Math.sign(area);
    for(const t of [.15,.5,.85])for(const n of [.1,1,2]){
      const x=a[0]+dx*t+nx*n,z=a[1]+dz*t+nz*n;
      assert(Math.abs(groundHeight(x,z)-8.25)<1e-6,`Storefront approach rises above lower floor at ${x},${z}`);
    }
  }
  assert(groundHeight(-15,13)>9,'The western hillside must remain behind the bath house');
});

test('inventory tree trunks stay outside mapped building footprints without relocation',()=>{
  assert.equal(PARK_TREES.length,52);
  for(const tree of PARK_TREES)for(const building of map.buildings) {
    const points=building.points.map(([x,z])=>[x,z] as GymPoint);
    assert(!insidePolygon(tree.x,tree.z,points),String(tree.sourceId));
    assert.equal(tree.x,tree.original[0]);assert.equal(tree.z,tree.original[1]);
  }
});
