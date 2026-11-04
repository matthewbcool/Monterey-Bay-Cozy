import {test} from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, Raycaster, Vector3 } from 'three';
import { MUSEUM_SITE, MUSEUM_ROOMS, museumToWorld, museumToLocal, museumSurface } from '../src/data/pacificGroveMuseum';
import { createMuseumArea } from '../src/viewer/mapStudy/museum';
import { MUSEUM_BUDGET } from '../src/models/locations/pacificGroveMuseum';
import { createLodController } from '../src/models/shared/lod/controller';
import { canStandAt } from '../src/viewer/avatarController';
const bounds={minX:-145,maxX:1500,minZ:130,maxZ:900};
test('museum plan orientation follows Forest/Grand roads, metres and shared projection',()=>{
 const m=createMuseumArea(),regional=createMuseumArea([-121.9,36.62]);
 for(const [u,v]of [[0,0],[37.83,5.7],[16.5,16.5],[25.6,33.04]]){const p=museumToWorld(u,v),q=museumToLocal(...p);assert(Math.abs(q[0]-u)<1e-9&&Math.abs(q[1]-v)<1e-9);}
 assert(m.point(37.83,5.7).x<m.point(0,0).x,'Forest wing lies west of Grand wing');
 assert.deepEqual(m.root.scale.toArray(),[1,1,1]);assert.deepEqual(regional.root.scale.toArray(),[1,1,1]);
 assert(Math.abs(m.point(0,0).distanceTo(m.point(37.83,0))-37.83)<1e-8);
 assert.equal(MUSEUM_SITE.osmId,'way/1293958818');assert(MUSEUM_ROOMS.some(r=>r.id==='shop'&&r.rect[1]>20),'current gift shop is at back of lobby');
 m.dispose();regional.dispose();
});
test('museum doors connect entrance, public galleries, classroom and garden',()=>{
 const m=createMuseumArea();
 const paths=[[[16.5,-3],[16.5,16.3],[21.5,16.3],[24.5,16.3]],[[16.5,16.3],[12.2,16.3],[12.2,10],[7,10]],[[24.5,16.3],[26,16.3],[26,7.8],[34.2,7.8],[34.2,12],[34.2,19.7],[34.2,29]],[[16.5,16.3],[16.5,28],[21,28],[24,29],[28,29]]];
 for(const route of paths)for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],n=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.1);for(let k=0;k<=n;k++){const u=a[0]+(b[0]-a[0])*k/n,v=a[1]+(b[1]-a[1])*k/n,[x,z]=museumToWorld(u,v);assert(canStandAt(x,z,bounds,m.colliders,.35),`door clearance at ${u.toFixed(2)},${v.toFixed(2)}`);assert(Number.isFinite(museumSurface(x,z)),`floor at ${u},${v}`);}}
 const wall=museumToWorld(19,10);assert(!canStandAt(...wall,bounds,m.colliders));
 const holeEdge=museumToWorld(21.7,12);assert(!canStandAt(...holeEdge,m.upperBounds,m.upperColliders));
 assert(canStandAt(m.upstairs.x,m.upstairs.z,m.upperBounds,m.upperColliders,.35));m.dispose();
});
test('museum model is finite, batched, within budget, reduces LOD and preserves floor modes',async()=>{
 const m=createMuseumArea(),lod=createLodController();await lod.register(m.root);const stats=lod.stats(m.root);
 console.log('Museum LOD',JSON.stringify(stats));assert(stats.near.triangles<=MUSEUM_BUDGET.triangles);assert(stats.near.draws<=MUSEUM_BUDGET.draws);assert(stats.far.triangles<=stats.mid.triangles&&stats.mid.triangles<stats.near.triangles);
 m.root.traverse(o=>{if(o instanceof Mesh){assert(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));assert(o.geometry.attributes.normal);}});
 const size=m.bounds.getSize(new Vector3());assert(size.y<14&&size.x<60&&size.z<60);
 m.setView('ground');assert(!m.parts.upper.visible&&!m.parts.roofs.visible&&m.parts.ground.visible);m.setView('upper');assert(m.parts.upper.visible&&!m.parts.roofs.visible);m.setView('exterior');assert(m.parts.roofs.visible);
 lod.dispose();m.dispose();m.dispose();
});

test('ramp visual surface agrees with walking height and has a closed support',()=>{
 const m=createMuseumArea(),ray=new Raycaster();m.root.updateMatrixWorld(true);
 for(const x of [19.5,29.25,39]){const p=m.point(x,4.5,3);ray.set(p,new Vector3(0,-1,0));const hit=ray.intersectObject(m.parts.site,true)[0];assert(hit);assert(Math.abs(hit.point.y-m.floorAt(p.x,p.z)!)<.015);}
 m.dispose();
});
