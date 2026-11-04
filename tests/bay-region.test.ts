import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,LineSegments,Raycaster,Vector3,Material,PerspectiveCamera} from 'three';
import {BAY_REGION,BAY_REGION_BUDGET,createBayRegion,sampleRegionalGrid} from '../src/viewer/mapStudy/bayRegion';
import {createLodController} from '../src/models/shared/lod/controller';

test('bay cache covers north/south shores and retains official source provenance and finite grids',()=>{
 assert(BAY_REGION.bounds[0]<-122.05&&BAY_REGION.bounds[2]>-121.75);assert(BAY_REGION.bounds[1]<36.6&&BAY_REGION.bounds[3]>36.98);
 for(const name of ['Santa Cruz','Capitola','Aptos','Moss Landing','Marina','Monterey','Pacific Grove'])assert(BAY_REGION.places.some(p=>p.name===name&&p.gazetteerId));
 for(const g of [BAY_REGION.terrain,BAY_REGION.bathy]){assert.equal(g.values.length,g.columns*g.rows);assert(g.values.every(Number.isFinite));}
 assert(BAY_REGION.sources.every(s=>s.url.startsWith('https://')&&s.retrievedUTC.startsWith('2026-10-25')));
 assert(BAY_REGION.bathy.values.some(v=>v<-1000),'Actual NOAA relief includes the deep canyon region');
 assert(Math.abs(sampleRegionalGrid({columns:2,rows:2,west:0,north:1,stepLon:1,stepLat:1,values:[0,10,20,30]},.5,.5)-15)<1e-6);
});
test('regional ocean follows the shoreline, terrain is finite and costs fit the web budget',async()=>{
 const bay=createBayRegion(),lod=createLodController();bay.root.updateMatrixWorld(true);let triangles=0,draws=0;
 const geometries=new Set<object>(),materials=new Set<Material>();let disposedGeometry=0,disposedMaterial=0;
 bay.root.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){
  if(o instanceof Mesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;draws++;}
  for(const a of (Object.values(o.geometry.attributes) as {array:ArrayLike<number>}[]))assert(Array.from(a.array).every(Number.isFinite));
  if(!geometries.has(o.geometry)){geometries.add(o.geometry);o.geometry.addEventListener('dispose',()=>disposedGeometry++);}
  for(const m of Array.isArray(o.material)?o.material:[o.material])if(!materials.has(m)){materials.add(m);m.addEventListener('dispose',()=>disposedMaterial++);}
 }});
 assert(triangles<=BAY_REGION_BUDGET.triangles,triangles+' triangles');assert(draws<=BAY_REGION_BUDGET.draws);assert.deepEqual(bay.root.scale.toArray(),[1,1,1]);
 const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
 for(const [lon,lat] of [[-121.98,36.8],[-121.94,36.9],[-122.04,36.9]]){const p=bay.point(lon,lat);assert(!bay.isLand(p.x,p.z));ray.ray.origin.set(p.x,2000,p.z);assert.equal(ray.intersectObject(bay.ocean).length,1,'Mapped ocean is covered once');}
 for(const [lon,lat] of [[-122.02,37],[-121.78,36.69],[-121.89,36.6]]){const p=bay.point(lon,lat);assert(bay.isLand(p.x,p.z));ray.ray.origin.set(p.x,2000,p.z);assert.equal(ray.intersectObject(bay.ocean).length,0,'Ocean must not cover inland terrain');}
 await lod.register(bay.root);const cost=lod.stats(bay.root);assert(cost.far.triangles<cost.near.triangles);bay.setSeafloor(true);assert(!bay.ocean.visible&&bay.seabed.visible);bay.setSeafloor(false);assert(bay.ocean.visible&&!bay.seabed.visible);
 lod.dispose();bay.dispose();bay.dispose();assert.equal(disposedGeometry,geometries.size);assert.equal(disposedMaterial,materials.size);
});
test('a detailed local crop has a real geometry hole and retains metre scale at another origin',async()=>{
 const bounds=[-100,-100,100,100] as const,footprint=[[-100,-100],[100,-100],[100,100],[-100,100]] as const;
 // Place a crop on known dry terrain near Monterey rather than offshore at the regional origin.
 const bay=createBayRegion([-121.88,36.6],[footprint],bounds);bay.root.updateMatrixWorld(true);
 const terrain:Mesh[]=[];bay.root.traverse(o=>{if(o instanceof Mesh&&o.name.startsWith('Bay terrain'))terrain.push(o);});
 const ray=new Raycaster(new Vector3(0,2000,0),new Vector3(0,-1,0));assert.equal(ray.intersectObjects(terrain).length,0,'Detailed terrain owns its crop without overlapping coarse land');
 const north=bay.point(-121.88,36.601);assert(Math.abs(north.z+111.195)<.01);assert.equal(north.x,0);
 const lod=createLodController(),camera=new PerspectiveCamera(45,1,1,200000);camera.position.set(0,2000,0);camera.lookAt(0,0,0);await lod.register(bay.root);
 for(const level of ['near','mid','far'] as const){lod.setMode(level);lod.update(camera,900,0,true);assert.equal(ray.intersectObjects(terrain).length,0,level+' preserves the detail hole');}
 lod.dispose();bay.dispose();
});
