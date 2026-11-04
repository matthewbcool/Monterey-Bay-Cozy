import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,MeshBasicMaterial,DoubleSide,Raycaster,Vector3} from 'three';
import {createMuseumArea} from '../src/viewer/mapStudy/museum';
import {museumToWorld,MUSEUM_SITE} from '../src/data/pacificGroveMuseum';
import {createGymOceanGeometry} from '../src/viewer/testingGym/oceanGeometry';
import {createWaterfrontArea,waterfrontHeight,WATERFRONT_BUDGET} from '../src/viewer/mapStudy/waterfront';
import {partitionConvex} from '../src/viewer/mapStudy/waterfrontSurfaces';
import {prepareGeometryLods} from '../src/models/shared/lod/geometry';
import {createLodController} from '../src/models/shared/lod/controller';
test('museum entrance approach and every stair tread agree with the walking surface',async()=>{
 const m=createMuseumArea(),ray=new Raycaster(),lod=createLodController();await lod.register(m.root);
 for(const v of [-13.9,-10.6,-6.2,-5.1,-3.1,-2.75,-2.25,-1.75,-1.25,-.75,-.25,.1]){
  const p=m.point(16.54,v,8);ray.set(p,new Vector3(0,-1,0));const hit=ray.intersectObject(m.parts.site,true)[0];assert(hit,'support at '+v);assert(Math.abs(hit.point.y-m.floorAt(p.x,p.z)!)<.012,'height at '+v);
 }
 const shop=m.point(12.4,23.2,5);ray.set(shop,new Vector3(0,-1,0));assert.equal(ray.intersectObject(m.parts.ground,true).filter(h=>Math.abs(h.point.y-MUSEUM_SITE.floor)<.005).length,1,'shop/services overlap has one visible floor');
 const sourceParts=Object.values(m.parts).flatMap(p=>p.userData.sourceParts??[]).join(' ');assert(!/Dusty|specimen|display case|Diorama|activity table/i.test(sourceParts));
 assert(!m.colliders.some(c=>c.kind==='circle'&&Math.hypot(c.x-m.point(22.4,10.7).x,c.z-m.point(22.4,10.7).z)<.1),'no invisible old exhibit collider');
 lod.dispose();m.dispose();
});
test('ocean geometry omits inland museum/park and preserves offshore water',async()=>{
 const geometry=createGymOceanGeometry(),material=new MeshBasicMaterial({side:DoubleSide}),o=new Mesh(geometry,material),ray=new Raycaster();o.position.set(260,1,-180);o.updateMatrixWorld(true);
 for(const p of [museumToWorld(16.54,-3),museumToWorld(24,12),[1.78,373.99],[-25,350]]){ray.set(new Vector3(p[0],100,p[1]),new Vector3(0,-1,0));assert.equal(ray.intersectObject(o).length,0);}
 for(const [x,z]of [[210,-45],[150,-40],[700,300]]){ray.set(new Vector3(x,100,z),new Vector3(0,-1,0));assert(ray.intersectObject(o).length>0);}
 assert((geometry.index?.count??geometry.attributes.position.count)/3<800,'fewer triangles than old plane');const levels=await prepareGeometryLods(geometry);for(const level of Object.values(levels)){o.geometry=level;const p=museumToWorld(16.54,-3);ray.set(new Vector3(p[0],100,p[1]),new Vector3(0,-1,0));assert.equal(ray.intersectObject(o).length,0);}for(const g of new Set(Object.values(levels)))g.dispose();material.dispose();
});
test('Jewell district stays within budget and has one terrain surface under bare park ground',()=>{
 const a=createWaterfrontArea(),ray=new Raycaster();a.root.updateMatrixWorld(true);assert.equal(a.jewellPark.benches,7);assert.equal(a.jewellPark.source.gazeboId,'node/8156311269');
 for(const [x,z]of [[-8.47,356.13],[-17.37,362.18],[3.53,366.29]]){ray.set(new Vector3(x,100,z),new Vector3(0,-1,0));const hits=ray.intersectObject(a.root,true).filter(h=>Math.abs(h.point.y-waterfrontHeight(x,z))<.15);assert.equal(hits.length,1,'one ground at '+[x,z]);}
 let n=0;a.root.traverse(o=>{if(o instanceof Mesh)n+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*('count' in o?Number(o.count):1);});assert(n<=WATERFRONT_BUDGET.triangles,`${n} triangles`);a.dispose();
});
test('convex surface partition conserves area at nearly collinear intersections',()=>{
 const area=(p:number[][])=>Math.abs(p.reduce((a,v,i)=>{const q=p[(i+1)%p.length];return a+v[0]*q[1]-q[0]*v[1];},0))/2;
 const cut=partitionConvex([[0,0],[10,0],[10,10],[0,10]],[[4,-1e-12],[6,1e-12],[6,12],[4,12]]);assert(Math.abs(area(cut.inside)+cut.outside.reduce((n,p)=>n+area(p),0)-100)<1e-8);
 assert(MUSEUM_SITE.upper===3.6);
});
