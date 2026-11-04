/** Caledonia district: cached OSM layout, USGS terrain and photo-informed park furniture. */
import { Box3, BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, SphereGeometry, Matrix4, Mesh, Path, Shape, ShapeGeometry, ShapeUtils, TorusGeometry, Vector2, Vector3 } from 'three';
import data from '../../data/caledonia-park.json';
import {MEALS_SITE,inMealsAnnex,createAnnexHeight,createCaledoniaAnnex} from './caledoniaAnnex';
import {createCaledoniaMeals} from './caledoniaMeals';
import { box, mat, mesh, disposeObject } from '../../models/props/primitives';
import { beam } from '../../models/locations/pacificGroveMuseum/helpers';
import { finishSpatialBatches } from '../testingGym/spatialBatches';
import { groundHeight as parkHeight } from '../testingGym/elevation';
import { waterfrontHeight, projectWaterfront } from './waterfront';
import { partitionConvex, type SurfacePoint } from './waterfrontSurfaces';
import { type GymCollider, type GymPoint } from '../avatarController';
import { createCaledoniaFence } from './caledoniaFence';
import { addCaledoniaPlaygrounds } from './caledoniaPlaygrounds';
export const CALEDONIA = data;
export const CALEDONIA_BUDGET = { triangles: 45000, draws: 8, imageTextures: 0 } as const;
export const CALEDONIA_BUILDING_IDS = new Set([...data.buildings,...MEALS_SITE.buildings].map(b=>b.id));
export const COURT = data.features.find(f=>f.id==='way/435247876')!;
export const PARK = data.features.find(f=>f.id==='way/871779748')!;
const ring=COURT.points, cx=ring.reduce((s,p)=>s+p[0],0)/ring.length,cz=ring.reduce((s,p)=>s+p[1],0)/ring.length;
const length=Math.hypot(ring[1][0]-ring[0][0],ring[1][1]-ring[0][1]),width=Math.hypot(ring[2][0]-ring[1][0],ring[2][1]-ring[1][1]);
const ux=(ring[1][0]-ring[0][0])/length,uz=(ring[1][1]-ring[0][1])/length;
export const COURT_FRAME={x:cx,z:cz,length,width,ux,uz};
export const courtPoint=(u:number,v:number):[number,number]=>[cx+u*ux-v*uz,cz+u*uz+v*ux];
const [west,north,east,south]=data.crop;
export const inCaledonia=(x:number,z:number)=>(x>=west&&x<=east&&z>=north&&z<=south)||inMealsAnnex(x,z);
export const caledoniaFootprint=(origin:readonly[number,number])=>[[west,north],[MEALS_SITE.crop[0],north],[MEALS_SITE.crop[0],MEALS_SITE.crop[1]],[east,MEALS_SITE.crop[1]],[east,south],[west,south]].map(p=>projectWaterfront(p,origin));
const sourceGrid=data.terrain.grid;
function dem(x:number,z:number){
 const g=sourceGrid,u=Math.max(0,Math.min(g.columns-1.000001,(x-g.minX)/g.stepX)),v=Math.max(0,Math.min(g.rows-1.000001,(z-g.minZ)/g.stepZ)),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,h=data.terrain.values,n=g.columns;
 return h[j*n+i]*(1-a)*(1-b)+h[j*n+i+1]*a*(1-b)+h[(j+1)*n+i]*(1-a)*b+h[(j+1)*n+i+1]*a*b;
}
const courtY=dem(cx,cz),step=7.5,columns=Math.round((east-west)/step)+1,rows=Math.round((south-north)/step)+1;
/** Keep the court apron level. The full park fence follows surrounding terrain. */
function grade(x:number,z:number){
 const u=(x-cx)*ux+(z-cz)*uz,v=-(x-cx)*uz+(z-cz)*ux;
 const distance=Math.hypot(Math.max(0,Math.abs(u)-length/2-8),Math.max(0,Math.abs(v)-width/2-8));
 const blend=Math.min(1,distance/14),h=courtY*(1-blend)+dem(x,z)*blend;
 const seam=Math.min(1,(east-x)/25),neighbor=z>=130?waterfrontHeight(east,z):parkHeight(east,z);
 return h*seam+neighbor*(1-seam);
}
const heights=Array.from({length:columns*rows},(_,i)=>grade(west+(i%columns)*step,north+Math.floor(i/columns)*step));
/** Rendering and walking share the exact two planes of each graded grid cell. */
function districtHeight(x:number,z:number){
 const u=Math.max(0,Math.min(columns-1.000001,(x-west)/step)),v=Math.max(0,Math.min(rows-1.000001,(z-north)/step)),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;
 const h=heights[j*columns+i],right=heights[j*columns+i+1],down=heights[(j+1)*columns+i],diagonal=heights[(j+1)*columns+i+1];
 return a>=b?h+a*(right-h)+b*(diagonal-right):h+b*(down-h)+a*(diagonal-down);
}
const annexHeight=createAnnexHeight(districtHeight);
export function caledoniaHeight(x:number,z:number){return inMealsAnnex(x,z)?annexHeight(x,z):districtHeight(x,z);}
function shape(points:number[][]){return new Shape(points.map(p=>new Vector2(p[0],-p[1])));}
type Region={points:SurfacePoint[];kind:string;minX:number;maxX:number;minZ:number;maxZ:number};
function region(points:number[][],kind:string):Region{return {points:points as SurfacePoint[],kind,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1]))};}
function routeRegions(points:number[][],width:number,kind:string){
 const [a,b]=points,dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<.01)return [];
 const nx=-dz/l*width/2,nz=dx/l*width/2;
 return [region([[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]],kind),...points.map(p=>region(Array.from({length:8},(_,i)=>[p[0]+Math.cos(i*Math.PI/4)*width/2,p[1]+Math.sin(i*Math.PI/4)*width/2]),kind))];
}
export function createCaledoniaArea(origin:readonly[number,number]=data.origin as [number,number]){
 const source=new Group(),colliders:GymCollider[]=[],flightObstacles:{minX:number;maxX:number;minZ:number;maxZ:number;top:number;footprint?:readonly GymPoint[]}[]=[];
 const colors={grass:'#b0ae91',lawn:'#8ea777',road:'#8d9390',walk:'#c7c5b4',play:'#d1ae79',court:'#b1b6a7'};
 const materials=Object.fromEntries(Object.entries(colors).map(([k,c])=>[k,mat(c)]));
 const roads:Region[]=[],sidewalks:Region[]=[],paths:Region[]=[];
 for(const path of data.paths){const pedestrian=['footway','path','cycleway','steps','pedestrian'].includes(path.kind),tag=Number.parseFloat(path.width),w=Number.isFinite(tag)&&tag>0?Math.min(12,tag):pedestrian?1.8:path.kind==='service'?3.6:6.4;
  if(pedestrian)paths.push(...routeRegions(path.points,w,'walk'));
  else{roads.push(...routeRegions(path.points,w,'road'));sidewalks.push(...routeRegions(path.points,w+3.2,'walk'));}
 }
 // Photo-inferred access along the lawn joins the open court apron and mapped playgrounds.
 const authoredPaths=[[[cx-ux*(length/2+1),cz-uz*(length/2+1)],[-304,263],[-280.2484,246.8753]], [[-278,298],[-272,290],[-260,268],[-246,237]]];
 for(const line of authoredPaths)for(let i=1;i<line.length;i++)paths.push(...routeRegions([line[i-1],line[i]],1.5,'walk'));
 // Concave source features are triangulated before convex partitioning.
 function featureRegions(points:number[][],kind:string){const v=points.map(p=>new Vector2(...p as [number,number]));return ShapeUtils.triangulateShape(v,[]).map(f=>region(f.map(i=>points[i]),kind));}
 const regions=[...featureRegions(ring,'court'),...roads,...paths,...sidewalks,...data.features.filter(f=>f.kind==='playground').flatMap(f=>featureRegions(f.points,'play')),...featureRegions(PARK.points,'lawn')];
 const tiles=new Map<string,number[]>();
 function emit(points:SurfacePoint[],kind:string,x:number,z:number){if(points.length<3)return;const key=kind+':'+Math.floor(x/128)+','+Math.floor(z/128);let values=tiles.get(key);if(!values){values=[];tiles.set(key,values);}
  for(let k=1;k<points.length-1;k++){const tri=[points[0],points[k],points[k+1]],area=(tri[1][1]-tri[0][1])*(tri[2][0]-tri[0][0])-(tri[1][0]-tri[0][0])*(tri[2][1]-tri[0][1]);if(Math.abs(area)<1e-8)continue;if(area<0)tri.reverse();for(const p of tri)values.push(p[0],caledoniaHeight(...p),p[1]);}
 }
 for(let j=0;j<rows-1;j++)for(let i=0;i<columns-1;i++){
  const x=west+i*step,z=north+j*step,xx=x+step,zz=z+step,near=regions.filter(r=>r.minX<=xx&&r.maxX>=x&&r.minZ<=zz&&r.maxZ>=z);
  for(const tri of [[[x,z],[xx,z],[xx,zz]],[[x,z],[xx,zz],[x,zz]]] as SurfacePoint[][]){let remaining=[tri];for(const r of near){const next:SurfacePoint[][]=[];for(const f of remaining){const cut=partitionConvex(f,r.points);emit(cut.inside,r.kind,x,z);next.push(...cut.outside);}remaining=next;}for(const f of remaining)emit(f,'grass',x,z);}
 }
 for(const [key,values] of tiles){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(values,3));g.computeVertexNormals();mesh(source,'Caledonia single ground · '+key,g,materials[key.split(':')[0]]);}
 const wood=mat('#9a8d70'),metal=mat('#758b8b'),white=mat('#efe9cf'),orange=mat('#ba7050'),bark=mat('#80735d'),leaf=mat('#708665');
 const court=new Group();court.name='Tommy Stillwell Court · two hoops';court.position.set(cx,courtY,cz);court.rotation.y=-Math.atan2(uz,ux);source.add(court);
 // Thin, raised paint ribbons are intentionally separated from the court surface.
 function marking(a:number[],b:number[]){
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),nx=-dz/length*.0325,nz=dx/length*.0325;
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute([a[0]+nx,.028,a[1]+nz,b[0]+nx,.028,b[1]+nz,b[0]-nx,.028,b[1]-nz,a[0]-nx,.028,a[1]-nz],3));
  g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();mesh(court,'Court paint · flat ribbon',g,white);
 }
 const half=length/2-1.2,side=width/2-1.1;
 for(const s of [-1,1]){marking([-half,s*side],[half,s*side]);marking([s*half,-side],[s*half,side]);for(const v of [-2.4,2.4])marking([s*half,v],[s*(half-5.6),v]);marking([s*(half-5.6),-2.4],[s*(half-5.6),2.4]);}
 marking([0,-side],[0,side]);
 function arc(x:number,r:number,start=0,end=Math.PI*2){const n=32;for(let i=0;i<n;i++)marking([x+Math.cos(start+(end-start)*i/n)*r,Math.sin(start+(end-start)*i/n)*r],[x+Math.cos(start+(end-start)*(i+1)/n)*r,Math.sin(start+(end-start)*(i+1)/n)*r]);}
 arc(0,1.8);for(const s of [-1,1])arc(s*(half-5.6),1.8,s>0?Math.PI/2:-Math.PI/2,s>0?Math.PI*1.5:Math.PI/2);
 for(const s of [-1,1]){
  const pole=s*(half+.8),board=s*(half-.2),hoop=s*(half-.58);
  for(const [a,b]of [[[pole,0,0],[pole,2.9,0]],[[pole,2.9,0],[pole-s*.25,3.65,0]],[[pole-s*.25,3.65,0],[board,3.65,0]]] as number[][][])beam(court,'Curved basketball support',a,b,.13,metal);
  // Original rounded fan-style board silhouette, based on the supplied street photo.
  const outline=new Shape();outline.moveTo(-.84,0);outline.lineTo(-.84,.5);outline.quadraticCurveTo(-.7,1.12,0,1.12);outline.quadraticCurveTo(.7,1.12,.84,.5);outline.lineTo(.84,0);outline.closePath();
  const g=new ExtrudeGeometry(outline,{depth:.06,bevelEnabled:false,curveSegments:6});g.rotateY(Math.PI/2);mesh(court,'White fan backboard',g,white,board,2.99,0);
  for(const v of [-.28,.28])beam(court,'Backboard target',[board-s*.04,3.1,v],[board-s*.04,3.53,v],.035,orange);
  for(const h of [3.1,3.53])beam(court,'Backboard target',[board-s*.04,h,-.28],[board-s*.04,h,.28],.035,orange);
  const rim=mesh(court,'Orange basketball rim',new TorusGeometry(.23,.022,4,12),orange,hoop,3.05,0);rim.rotation.x=Math.PI/2;
  for(let i=0;i<8;i++){const a=i*Math.PI/4;beam(court,'Open hoop net',[hoop+Math.cos(a)*.22,3.03,Math.sin(a)*.22],[hoop+Math.cos(a+.3)*.14,2.67,Math.sin(a+.3)*.14],.018,white);}
  const [x,z]=courtPoint(pole,0);colliders.push({kind:'circle',x,z,radius:.17});flightObstacles.push({minX:x-.8,maxX:x+.8,minZ:z-.8,maxZ:z+.8,top:courtY+4.2});
 }
 // The court is open inside the larger enclosed park; only its perimeter is fenced.
 const end=length/2+.45,edge=width/2+.5;
 function bench(x:number,z:number,angle=0){const g=new Group();g.position.set(x,caledoniaHeight(x,z),z);g.rotation.y=angle;source.add(g);box(g,'Park bench seat',[1.8,.1,.48],wood,[0,.46,0]);box(g,'Park bench back',[1.8,.35,.08],wood,[0,.77,-.2]);for(const s of [-.66,.66])box(g,'Bench frame',[.07,.5,.4],metal,[s,.25,0]);colliders.push({kind:'circle',x,z,radius:.96});}
 for(const u of [-10,-5,0,5,10]){const [x,z]=courtPoint(u,edge+1.4);bench(x,z,-Math.atan2(uz,ux));}
 for(const [x,z]of [[-280,255],[-264,252],[-254,218],[-235,185]])bench(x,z,.4);
 const playgrounds=addCaledoniaPlaygrounds(source,caledoniaHeight);colliders.push(...playgrounds.colliders);flightObstacles.push(...playgrounds.flightObstacles);
 // Authored trees avoid the playing surface and mapped streets.
 let seed=251025;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const trees=[[-306,266],[-291,258],[-274,277],[-267,267],[-254,249],[-243,229],[-257,209],[-239,198],[-235,174],[-228,155],[-221,137],[-281,302],[-301,295]];
 for(const [x,z]of trees){const y=caledoniaHeight(x,z),h=4.4+random()*1.7;beam(source,'Caledonia shade tree trunk',[x,y,z],[x+.2,y+h,z],.35,bark);for(let k=0;k<3;k++){const o=mesh(source,'Rounded shade tree canopy',new SphereGeometry(1,6,4),leaf,x+(k-1)*1.3,y+h+(k%2)*.6,z+random()-.5);o.scale.set(2.2,1.55,2);}colliders.push({kind:'circle',x,z,radius:.25});}
 const palette=['#d1c4aa','#c2cec1','#c6c1b4','#b6c7c9'].map(c=>mat(c)),roof=mat('#827e72');
 for(const b of data.buildings){const outer=b.rings[0],xs=outer.map(p=>p[0]),zs=outer.map(p=>p[1]),base=Math.max(...outer.map(p=>caledoniaHeight(p[0],p[1]))),bottom=Math.min(...outer.map(p=>caledoniaHeight(p[0],p[1])))-.25,tags=b.tags as Record<string,string|undefined>,explicit=parseFloat(tags.height??''),levels=Number(tags['building:levels']),height=explicit>0?explicit*(tags.height?.includes('ft')?.3048:1):levels>0?levels*3:tags.amenity==='toilets'?3.1:5.5;
  const s=shape(outer);for(const hole of b.rings.slice(1))s.holes.push(new Path(hole.map(p=>new Vector2(p[0],-p[1]))));const g=new ExtrudeGeometry(s,{depth:base+height-bottom,bevelEnabled:false,steps:1});g.rotateX(-Math.PI/2);g.translate(0,bottom,0);const sides=g.groups[1];if(sides){g.setAttribute('position',new Float32BufferAttribute(g.attributes.position.array.slice(sides.start*3,(sides.start+sides.count)*3),3));g.setAttribute('normal',new Float32BufferAttribute(g.attributes.normal.array.slice(sides.start*3,(sides.start+sides.count)*3),3));g.deleteAttribute('uv');g.clearGroups();}let hash=0;for(const c of b.id)hash=(hash*31+c.charCodeAt(0))>>>0;mesh(source,'Mapped Caledonia building '+b.id,g,palette[hash%palette.length]);const cap=new ShapeGeometry(s);cap.rotateX(-Math.PI/2);cap.translate(0,base+height,0);mesh(source,'Estimated roof '+b.id,cap,roof);
  const bounds={minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs),footprint:outer.map(p=>[p[0],p[1]] as GymPoint)};colliders.push({kind:'box',...bounds});flightObstacles.push({...bounds,top:base+height});
 }
 const root=finishSpatialBatches(source,'caledonia-park',256);root.name=data.name;root.userData={assetId:'caledonia-park',units:'metres',seed:251025,budget:CALEDONIA_BUDGET,limits:'Mapped boundaries and routes; inferred court grading, furniture, planting, street widths and building heights. Whole-park enclosure with mapped pedestrian access; fence height and gate widths are estimates. City gallery informs play equipment silhouettes and colors; dimensions and individual placements remain provisional.'};
 const scale=Math.cos(origin[1]*Math.PI/180)/Math.cos(data.origin[1]*Math.PI/180),matrix=new Matrix4().makeScale(scale,1,1);
 root.traverse(o=>{if(o instanceof Mesh){o.geometry.applyMatrix4(matrix);o.geometry.computeBoundingSphere();o.geometry.userData.lodMaxErrorMetres=.02;}});
 const fence=createCaledoniaFence(caledoniaHeight,scale);root.add(fence.root);colliders.push(...fence.colliders);flightObstacles.push(...fence.flightObstacles);
 const annex=createCaledoniaAnnex(caledoniaHeight,scale),meals=createCaledoniaMeals({floorAt:caledoniaHeight,xScale:scale});root.add(annex,meals.root);colliders.push(...meals.colliders);flightObstacles.push(...meals.flightObstacles);
 const offset=projectWaterfront([0,0],origin);root.position.set(offset[0],0,offset[1]);root.updateMatrixWorld(true);const bounds=new Box3().setFromObject(root);
 const parkX=(Math.min(...PARK.points.map(p=>p[0]))+Math.max(...PARK.points.map(p=>p[0])))/2,parkZ=(MEALS_SITE.crop[1]+Math.max(...PARK.points.map(p=>p[1])))/2;
 const focus=projectWaterfront([parkX,parkZ],origin),center=new Vector3(focus[0],caledoniaHeight(parkX,parkZ),focus[1]),entry=fence.entrances[0].outside;
 let disposed=false;return {root,bounds,center,meals,annex,playgrounds,colliders,flightObstacles,fence,parkBoundary:fence.boundary,parkEntrances:fence.entrances,containsPark:fence.contains,containsDistrict:inCaledonia,court:{...COURT_FRAME,y:courtY,hoops:2,entrances:[courtPoint(-end,4.25),courtPoint(end,4.25)]},spawn:new Vector3(entry[0],caledoniaHeight(...entry)+.045,entry[1]),floorAt:caledoniaHeight,dispose(){if(disposed)return;disposed=true;disposeObject(root);}};
}
