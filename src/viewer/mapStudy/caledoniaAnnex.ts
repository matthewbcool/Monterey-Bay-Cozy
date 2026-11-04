/** Small cached ground extension for the real Meals on Wheels site north of the park. */
import {BufferGeometry,Float32BufferAttribute,Group} from 'three';
import data from '../../data/caledonia-meals-site.json';
import {mat,mesh} from '../../models/props/primitives';
import {finishStaticAsset} from '../../models/shared/staticAsset';
import {groundHeight as parkHeight,ELEVATION_GRID} from '../testingGym/elevation';
import {partitionConvex,type SurfacePoint} from './waterfrontSurfaces';
export const MEALS_SITE=data;
const [west,north,east,south]=data.crop;
export const inMealsAnnex=(x:number,z:number)=>x>=west&&x<=east&&z>=north&&z<south;
// Share the old district's X vertices along the southern seam. The cropped
// first cell is 5 m wide; the remaining cells keep the existing 7.5 m spacing.
const columns=14;
// Include the adjacent park's cell and triangle crossings, so the east edge
// reproduces its piecewise planar height exactly instead of resampling a step.
const eg=ELEVATION_GRID,eu=(east-eg.minX)/eg.stepX,ef=eu-Math.floor(eu);
const zKnots=[north,south];
for(let z=north;z<south;z+=7.5)zKnots.push(z);
for(let j=0;j<eg.rows;j++)for(const z of [eg.minZ+j*eg.stepZ,eg.minZ+(j+ef)*eg.stepZ])if(z>north&&z<south)zKnots.push(z);
const zs=[...new Set(zKnots.map(z=>Math.round(z*1e6)/1e6))].sort((a,b)=>a-b),rows=zs.length;
const gridZ=(z:number)=>{const j=Math.max(0,Math.min(rows-2,zs.findIndex(v=>v>z)-1));if(z>=south)return rows-1.000001;return j+(z-zs[j])/(zs[j+1]-zs[j]);};
const xAt=(i:number)=>i===0?west:east-(columns-1-i)*7.5;
const gridX=(x:number)=>x<xAt(1)?(x-west)/(xAt(1)-west):1+(x-xAt(1))/7.5;
/** A cached DEM, joined to the existing ground at the east/south boundaries.
 * Rendering and physics use the same triangles; only the short join is authored. */
export function createAnnexHeight(southHeight:(x:number,z:number)=>number){
 const g=data.terrain.grid,v=data.terrain.values;
 function source(x:number,z:number){
  const u=Math.max(0,Math.min(g.columns-1.000001,(x-g.minX)/g.stepX)),w=Math.max(0,Math.min(g.rows-1.000001,(z-g.minZ)/g.stepZ)),i=Math.floor(u),j=Math.floor(w),a=u-i,b=w-j;
  return v[j*g.columns+i]*(1-a)*(1-b)+v[j*g.columns+i+1]*a*(1-b)+v[(j+1)*g.columns+i]*(1-a)*b+v[(j+1)*g.columns+i+1]*a*b;
 }
 const heights=Array.from({length:columns*rows},(_,i)=>{
  const x=xAt(i%columns),z=zs[Math.floor(i/columns)],a=Math.min(1,(south-z)/15),b=Math.min(1,(east-x)/15);
  return source(x,z)*a*b+southHeight(x,south)*(1-a)+parkHeight(east,z)*(1-b)-parkHeight(east,south)*(1-a)*(1-b);
 });
 return (x:number,z:number)=>{
  const u=Math.max(0,Math.min(columns-1.000001,gridX(x))),v=Math.max(0,Math.min(rows-1.000001,gridZ(z))),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;
  const h=heights[j*columns+i],r=heights[j*columns+i+1],d=heights[(j+1)*columns+i],diagonal=heights[(j+1)*columns+i+1];
  return a>=b?h+a*(r-h)+b*(diagonal-r):h+b*(d-h)+a*(diagonal-d);
 };
}
export function createCaledoniaAnnex(floorAt:(x:number,z:number)=>number,xScale=1){
 type Region={points:SurfacePoint[];kind:'road'|'walk';minX:number;maxX:number;minZ:number;maxZ:number};
 const regions:Region[]=[];
 const add=(points:SurfacePoint[],kind:Region['kind'])=>regions.push({points,kind,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1]))});
 for(const p of data.paths){const walking=['footway','path','pedestrian','steps','cycleway'].includes(p.kind),tag=Number.parseFloat(p.width),width=Number.isFinite(tag)&&tag>0?Math.min(12,tag):walking?1.8:p.kind==='service'?3.6:6.4;
  for(let i=1;i<p.points.length;i++){const a=p.points[i-1],b=p.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.01)continue;const nx=-(b[1]-a[1])/len*width/2,nz=(b[0]-a[0])/len*width/2;
   add([[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]],walking?'walk':'road');
  }
 }
 regions.sort((a,b)=>Number(a.kind==='walk')-Number(b.kind==='walk'));
 const parts=new Map<string,number[]>();
 function emit(poly:SurfacePoint[],kind:string){if(poly.length<3)return;let values=parts.get(kind);if(!values){values=[];parts.set(kind,values);}for(let i=1;i<poly.length-1;i++){
  const t=[poly[0],poly[i],poly[i+1]],area=(t[1][1]-t[0][1])*(t[2][0]-t[0][0])-(t[1][0]-t[0][0])*(t[2][1]-t[0][1]);if(Math.abs(area)<1e-8)continue;if(area<0)t.reverse();for(const p of t)values.push(p[0],floorAt(...p),p[1]);
 }}
 for(let j=0;j<rows-1;j++)for(let i=0;i<columns-1;i++){
  const x=xAt(i),z=zs[j],xx=xAt(i+1),zz=zs[j+1],near=regions.filter(r=>r.minX<=xx&&r.maxX>=x&&r.minZ<=zz&&r.maxZ>=z);
  for(const tri of [[[x,z],[xx,z],[xx,zz]],[[x,z],[xx,zz],[x,zz]]] as SurfacePoint[][]){let remaining=[tri];for(const r of near){const next:SurfacePoint[][]=[];for(const p of remaining){const cut=partitionConvex(p,r.points);emit(cut.inside,r.kind);next.push(...cut.outside);}remaining=next;}for(const p of remaining)emit(p,'grass');}
 }
 const root=new Group(),colors:Record<string,string>={grass:'#b0ae91',road:'#8d9390',walk:'#c7c5b4'};
 for(const [kind,values]of parts){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(values,3));g.computeVertexNormals();mesh(root,'Meals site ground · '+kind,g,mat(colors[kind]));}
 finishStaticAsset(root,'caledonia-meals-ground',[xScale,1,1],{rim:false});root.traverse(o=>{if('geometry'in o)(o.geometry as BufferGeometry).userData.lodMaxErrorMetres=.02;});
 return root;
}
