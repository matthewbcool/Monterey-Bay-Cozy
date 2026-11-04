import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Mesh,Raycaster,Vector3} from 'three';
import {BATHYMETRY,surveyedHeight} from '../src/viewer/testingGym/bathymetry';
import {createGymSeafloor,SEAFLOOR,seafloorEvidence,seafloorHeight} from '../src/viewer/testingGym/seafloor';
import {createCoastalLife,coastalDistance,coastalIsWater} from '../src/viewer/testingGym/coastalLife';
import {createLodController} from '../src/models/shared/lod/controller';
test('bathymetry preserves source datum, NoData, signed elevations and independently sampled control points',()=>{
 const {source,grid,values}=BATHYMETRY;
 assert.equal(source.horizontalCRS,'EPSG:26910');assert.equal(source.verticalDatum,'NAVD88');assert.equal(source.nativeCellMetres,2);assert.equal(grid.step,10);
 assert.equal(values.length,grid.columns*grid.rows);assert.equal(values.filter(v=>v!==null).length,10929);
 assert.equal(createHash('sha256').update(readFileSync('artifacts/bathymetry/usgs-monterey-crop.tif')).digest('hex'),source.inputSha256);
 // Values directly sampled from the native GeoTIFF, not generated from the runtime interpolation.
 for(const [x,z,h] of [[140,-40,-1.454],[180,-50,-3.253],[240,-100,-7.165],[200,-220,-9.334],[500,0,-11.464]])assert(Math.abs(surveyedHeight(x,z)!-h)<.001);
 assert.equal(surveyedHeight(-100,800),undefined);assert.equal(surveyedHeight(NaN,0),undefined);assert.equal(surveyedHeight(10000,0),undefined);
 assert.equal(seafloorEvidence(180,-50).basis,'survey');assert.equal(seafloorEvidence(77,-48).basis,'shoreline-join');
 assert(surveyedHeight(200,-220)! < -5,'Do not restore the old flat five-metre seabed');
});
test('rendered seabed and movement share the same triangles, with bounded LOD and ownership',async()=>{
 const floor=createGymSeafloor(),lod=createLodController(),mesh=floor.root.children[0] as Mesh;
 try{
  assert(floor.triangles<SEAFLOOR.budget.triangles,String(floor.triangles));assert.equal(floor.root.children.length,1);
  floor.root.updateMatrixWorld(true);const ray=new Raycaster(),down=new Vector3(0,-1,0);
  // Off-grid positions catch interpolation sign/index errors and include the beach join.
  for(const [x,z] of [[82.1,-48],[85.6,-47.1],[105.4,-45.3],[176.1,-52.7],[205.3,-105.8],[521.3,15.6]]){
   ray.set(new Vector3(x,20,z),down);const hit=ray.intersectObject(mesh)[0];assert(hit,`No floor at ${x},${z}`);assert(Math.abs(hit.point.y-floor.floorAt(x,z))<.0002,`Floor mismatch at ${x},${z}`);
  }
  await lod.register(floor.root);const stats=lod.stats(floor.root);assert(stats.mid.triangles<stats.near.triangles);assert(stats.far.triangles<=stats.mid.triangles);assert(stats.bytes<4*1048576);
 }finally{lod.dispose();floor.dispose();}
});
test('the one four-metre shark patrols off Lovers Point, clears real terrain and stays visible from the park',()=>{
 const life=createCoastalLife(seafloorHeight),shark=life.swimmers.find(s=>s.id==='great-white-shark')!;
 try{
  assert.equal(life.swimmers.filter(s=>s.id==='great-white-shark').length,1);
  for(let i=0;i<512;i++){const p=shark.curve.getPointAt(i/512);assert(coastalIsWater(p.x,p.z));assert(coastalDistance(p.x,p.z)>20);assert(p.y-seafloorHeight(p.x,p.z)>.75,'Body clears the surveyed bottom');assert(Math.hypot(p.x-25,p.z+35)<210,'Whole patrol inside arrival interest radius');}
  life.setViewer(25,-35);assert(shark.active);life.setViewer(5000,5000);assert(!shark.active);life.setViewer(180,-55,true);assert(shark.active);
  for(const bed of life.beds)for(const p of bed.plants)assert(Math.abs(p.y-seafloorHeight(p.x,p.z))<1e-8,'Kelp is anchored on measured/inferred floor');
 }finally{life.dispose();}
});
