/** One CPU mesh shared by underwater rendering and collision sampling.
 * 10 m survey nodes offshore, 2.5 m tessellation at the authored shoreline join.
 * Native survey resolution is 2 m; the runtime crop is deliberately downsampled.
 */
import {BufferGeometry,Float32BufferAttribute,Group,Mesh,ShapeUtils,Vector2} from 'three';
import clipping from 'polygon-clipping';
import park from '../../data/lovers-point-gym.json';
import waterfront from '../../data/pacific-grove-waterfront.json';
import {insidePolygon,type GymPoint} from '../avatarController';
import {groundHeight,GYM_WATER_LEVEL} from './elevation';
import {surveyedHeight,nearbySurveyHeight} from './bathymetry';
import {createToonMaterial} from '../../models/shared/style';
import {disposeObject} from '../../models/props/primitives';
export const SEAFLOOR={bounds:{minX:-140,maxX:1500,minZ:-230,maxZ:900},step:10,shoreStep:2.5,joinMetres:20,budget:{triangles:65000,draws:1}} as const;
const coast:GymPoint[]=[...park.coast].reverse().concat(waterfront.coast).map(p=>[p[0],p[1]]);
const land:GymPoint[]=[...coast,[-145,900],[-145,-135]];
const landPoly:clipping.Polygon=[[...land,land[0]].map(p=>[p[0],p[1]])];
const segments=coast.slice(1).map((b,i)=>{const a=coast[i],dx=b[0]-a[0],dz=b[1]-a[1];return {x:a[0],z:a[1],dx,dz,l2:dx*dx+dz*dz};});
function shoreline(x:number,z:number){let d2=Infinity,sx=x,sz=z;for(const s of segments){const t=Math.max(0,Math.min(1,((x-s.x)*s.dx+(z-s.z)*s.dz)/(s.l2||1))),px=s.x+t*s.dx,pz=s.z+t*s.dz,d=(px-x)**2+(pz-z)**2;if(d<d2){d2=d;sx=px;sz=pz;}}return {distance:Math.sqrt(d2),x:sx,z:sz};}
/** Source-preserving offshore. The 20 m coastal reconciliation and NoData fallback are authored,
 * needed because independently mapped coast and land DEM do not share a surveyed wet/dry seam. */
export function seafloorEvidence(x:number,z:number){
 const shore=shoreline(x,z),survey=surveyedHeight(x,z),nearby=survey??nearbySurveyHeight(x,z);
 const fallback=GYM_WATER_LEVEL-Math.min(12,1+shore.distance*.25);
 let height=nearby??fallback;
 if(shore.distance<SEAFLOOR.joinMetres){
  // Land DEM is reliable for the original park only. The extension uses a submerged edge.
  const landY=shore.z<=130?groundHeight(shore.x,shore.z):GYM_WATER_LEVEL-.2;
  const edge=landY<=GYM_WATER_LEVEL+.75?landY:GYM_WATER_LEVEL-.1;
  const t=shore.distance/SEAFLOOR.joinMetres,weight=t*t*(3-2*t);
  height=(edge-shore.distance*.18)*(1-weight)+height*weight;
 }
 return {height,basis:shore.distance<SEAFLOOR.joinMetres?'shoreline-join':survey!==undefined?'survey':nearby!==undefined?'gap-nearest':'gap-authored'} as const;
}
type Triangle=readonly [number,number,number];
type MeshData={positions:number[];indices:number[];cells:Triangle[][];columns:number};
let cached:MeshData|undefined;
function meshData():MeshData{
 if(cached)return cached;
 const b=SEAFLOOR.bounds,columns=(b.maxX-b.minX)/10,rows=(b.maxZ-b.minZ)/10;
 const positions:number[]=[],indices:number[]=[],cells:Triangle[][]=Array.from({length:columns*rows},()=>[]),lookup=new Map<string,number>();
 function emit(rings:clipping.Polygon,cell:number){
  const contour=rings[0].slice(0,-1).map(p=>new Vector2(p[0],p[1])),holes=rings.slice(1).map(r=>r.slice(0,-1).map(p=>new Vector2(p[0],p[1])));
  if(contour.length<3)return;
  const points=[...contour,...holes.flat()];
  const ids=points.map(p=>{const key=`${p.x.toFixed(6)},${p.y.toFixed(6)}`;let id=lookup.get(key);if(id===undefined){id=positions.length/3;lookup.set(key,id);positions.push(p.x,seafloorEvidence(p.x,p.y).height,p.y);}return id;});
  for(const [a,bb,c] of ShapeUtils.triangulateShape(contour,holes)){
   const p=points[a],q=points[bb],r=points[c],cross=(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
   if(Math.abs(cross)<1e-8)continue;
   const tri:Triangle=cross<0?[ids[a],ids[bb],ids[c]]:[ids[a],ids[c],ids[bb]];indices.push(...tri);cells[cell].push(tri);
  }
 }
 for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
  const x=b.minX+i*10,z=b.minZ+j*10,cell=j*columns+i,d=shoreline(x+5,z+5).distance;
  if(d>8&&insidePolygon(x+5,z+5,land))continue;
  const step=d<30?SEAFLOOR.shoreStep:10;
  for(let dz=0;dz<10;dz+=step)for(let dx=0;dx<10;dx+=step){
   const xx=x+dx,zz=z+dz;
   // Keep the survey's diagonal (00→11), including when subdividing coastal cells.
   for(const ring of [[[xx,zz],[xx+step,zz],[xx+step,zz+step],[xx,zz]],[[xx,zz],[xx+step,zz+step],[xx,zz+step],[xx,zz]]]){
    const poly:clipping.Polygon=[ring as clipping.Pair[]];
    if(d>8){if(!insidePolygon(xx+step/2,zz+step/2,land))emit(poly,cell);}
    else for(const part of clipping.difference(poly,landPoly))emit(part,cell);
   }
  }
 }
 cached={positions,indices,cells,columns};return cached;
}
/** Constant-size cell lookup, exact barycentric interpolation of the rendered Near triangles.
 * No per-frame raycasts, geometry rebuilds or whole-scene searches. */
export function seafloorHeight(x:number,z:number):number{
 if(!Number.isFinite(x+z))return NaN;
 const b=SEAFLOOR.bounds,data=meshData(),i=Math.floor((x-b.minX)/10),j=Math.floor((z-b.minZ)/10);
 if(i>=0&&i<data.columns&&j>=0&&j<(b.maxZ-b.minZ)/10){
  const p=data.positions;
  for(const tri of data.cells[j*data.columns+i]){
   const a=tri[0]*3,bb=tri[1]*3,c=tri[2]*3,ax=p[a],az=p[a+2],ux=p[bb]-ax,uz=p[bb+2]-az,vx=p[c]-ax,vz=p[c+2]-az,det=ux*vz-uz*vx;
   const u=((x-ax)*vz-(z-az)*vx)/det,v=(ux*(z-az)-uz*(x-ax))/det;
   if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)return p[a+1]+u*(p[bb+1]-p[a+1])+v*(p[c+1]-p[a+1]);
  }
 }
 return seafloorEvidence(x,z).height;
}
export function createGymSeafloor(){
 const data=meshData(),geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(data.positions,3));geometry.setIndex(data.indices);geometry.computeVertexNormals();geometry.userData.lodMaxErrorMetres=.08;
 const material=createToonMaterial({color:'#a39674',rim:false}),mesh=new Mesh(geometry,material),root=new Group();
 mesh.name='USGS seafloor · surveyed offshore / inferred shore join';mesh.receiveShadow=true;mesh.castShadow=false;root.name='Monterey surveyed seafloor';root.add(mesh);root.userData.budget=SEAFLOOR.budget;
 return {root,floorAt:seafloorHeight,triangles:data.indices.length/3,dispose(){disposeObject(root);}};
}
