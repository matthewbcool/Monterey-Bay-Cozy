import {PHOTO_PIER,PIER_LENGTH} from './photoPier';
import { type GymPoint } from '../avatarController';
import clipping, { type MultiPolygon } from 'polygon-clipping';

/** Photo-informed adjustments over the coarse USGS grid, in NAVD88 metres.
 * Mapped footprints stay fixed. These terrace levels are provisional, not survey data. */
export const RECREATION_TERRACE = {
  height: 8.25,
  outline: [[-25,32],[-21,22],[-3,22],[-2.8,42.5],[6.5,70.7],[14.8,74.5],[17,85.7],[2,86.5],[-14,76],[-22.5,49.5],[-23.5,46]] as GymPoint[],
} as const;
export const RECREATION_TRAIL = {
  height: 11.5, start: [-34.732,76.358] as GymPoint, end: [28.351,107.237] as GymPoint, width: 3.2, bankWidth: .65,
} as const;
export const RECREATION_RETAINING = {
  start: [-22.5,49.5] as GymPoint, end: [-14,76] as GymPoint, height: 9.85, apronWidth: 3.5,
} as const;
interface Grid {minX:number;minZ:number;columns:number;rows:number;stepX:number;stepZ:number}
interface Plane {points:GymPoint[]; heights:number[]}
interface Mask {points:GymPoint[]; height:(x:number,z:number)=>number}
let grid:Grid;
const cells=new Map<number,Plane[]>();
interface FlatRegion {height:number;polygons:MultiPolygon}
let flatRegions:FlatRegion[]=[];
/** Exact constant-height parts of the resolved physical grade, including mask
 * priority and boundary transitions. Render them without redundant DEM edges. */
export function recreationFlatRegions():readonly FlatRegion[]{return flatRegions;}
const area=(p:readonly GymPoint[])=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0)/2;
function hull(points:readonly GymPoint[]):GymPoint[]{
  const p=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a:GymPoint,b:GymPoint,c:GymPoint)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=(points:GymPoint[])=>{const out:GymPoint[]=[];for(const p of points){while(out.length>1&&cross(out[out.length-2],out[out.length-1],p)<=0)out.pop();out.push(p);}return out;};
  return [...half(p).slice(0,-1),...half(p.reverse()).slice(0,-1)];
}
const lower=hull(RECREATION_TERRACE.outline);
function frame(a:GymPoint,b:GymPoint){
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]),tx=(b[0]-a[0])/length,tz=(b[1]-a[1])/length;
  return {length,at:(s:number,n:number):GymPoint=>[a[0]+tx*s-tz*n,a[1]+tz*s+tx*n],offset:(x:number,z:number)=>(x-a[0])*-tz+(z-a[1])*tx};
}
const trail=frame(RECREATION_TRAIL.start,RECREATION_TRAIL.end),wall=frame(RECREATION_RETAINING.start,RECREATION_RETAINING.end);
const quad=(f:ReturnType<typeof frame>,a:number,b:number,c:number,d:number)=>hull([f.at(a,c),f.at(b,c),f.at(b,d),f.at(a,d)]);
/** The mapped seaward facade, with a photo-inferred 2.5 m paved frontage.
 * Its source footprint is counter-clockwise in X/Z, so the right normal is outside. */
export const BATH_HOUSE_FRONTAGE:GymPoint[]=[[-1.526,1.979],[-3.471,8.039],[3.239,10.197],[.437,18.937],[-2.588,17.969],[-3.445,20.627],[-5.872,28.210]];
export const BATH_HOUSE_APRON_WIDTH=2.5;
export const BATH_HOUSE_APRON_POLYGONS:GymPoint[][]=[];
for(let i=1;i<BATH_HOUSE_FRONTAGE.length;i++){
  const f=frame(BATH_HOUSE_FRONTAGE[i-1],BATH_HOUSE_FRONTAGE[i]);
  BATH_HOUSE_APRON_POLYGONS.push(quad(f,0,f.length,-BATH_HOUSE_APRON_WIDTH,.3));
  if(i<BATH_HOUSE_FRONTAGE.length-1){
    const next=frame(BATH_HOUSE_FRONTAGE[i],BATH_HOUSE_FRONTAGE[i+1]);
    BATH_HOUSE_APRON_POLYGONS.push(hull([f.at(f.length,-BATH_HOUSE_APRON_WIDTH),f.at(f.length,.3),next.at(0,-BATH_HOUSE_APRON_WIDTH),next.at(0,.3)]));
  }
}
const masks:Mask[]=[
  // Cut the coarse DEM below both concrete decks; shared render/footing planes.
  {points:quad(frame(PHOTO_PIER.start,PHOTO_PIER.end),-.4,PIER_LENGTH+.4,-1.7,4.3),height:()=>PHOTO_PIER.lower-.08},
  {points:lower,height:()=>RECREATION_TERRACE.height},
  ...BATH_HOUSE_APRON_POLYGONS.map(points=>({points,height:()=>RECREATION_TERRACE.height})),
  // Only the inland court edge receives a retaining bank. There is no seaward rim.
  {points:quad(wall,0,wall.length,0,RECREATION_TRAIL.bankWidth),height:(x,z)=>8.25+(9.85-8.25)*Math.max(0,Math.min(1,wall.offset(x,z)/RECREATION_TRAIL.bankWidth))},
  {points:quad(wall,0,wall.length,RECREATION_TRAIL.bankWidth,RECREATION_RETAINING.apronWidth),height:()=>RECREATION_RETAINING.height},
  {points:quad(trail,-3,trail.length+3,-4,10),height:()=>RECREATION_TRAIL.height},
];
function cut(poly:GymPoint[],a:GymPoint,b:GymPoint,side=1):GymPoint[]{
  const distance=(p:GymPoint)=>((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))*side,out:GymPoint[]=[];
  for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=distance(p),dq=distance(q);if(dp>=0)out.push(p);
    if((dp<0&&dq>0)||(dp>0&&dq<0)){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}
  return out;
}
function clean(poly:GymPoint[]):GymPoint[]{
  let p=poly.filter((v,i)=>{const a=poly[(i+poly.length-1)%poly.length];return Math.hypot(v[0]-a[0],v[1]-a[1])>1e-9;});
  p=p.filter((v,i)=>{const a=p[(i+p.length-1)%p.length],b=p[(i+1)%p.length];return Math.abs((v[0]-a[0])*(b[1]-v[1])-(v[1]-a[1])*(b[0]-v[0]))>1e-9;});
  return Math.abs(area(p))>1e-8?p:[];
}
function intersect(poly:GymPoint[],mask:readonly GymPoint[]){let p=poly;const side=area(mask)>0?1:-1;for(let i=0;i<mask.length&&p.length;i++)p=cut(p,mask[i],mask[(i+1)%mask.length],side);return clean(p);}
function contains(p:readonly GymPoint[],x:number,z:number){const sign=area(p)>0?1:-1;return p.every((a,i)=>{const b=p[(i+1)%p.length];return sign*((b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0]))>=-1e-5;});}
function barycentric(p:readonly GymPoint[],x:number,z:number){const [a,b,c]=p,det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
  const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(z-c[1]))/det,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(z-c[1]))/det;return [u,v,1-u-v];}
const bounds=masks.map(m=>({minX:Math.min(...m.points.map(p=>p[0])),maxX:Math.max(...m.points.map(p=>p[0])),minZ:Math.min(...m.points.map(p=>p[1])),maxZ:Math.max(...m.points.map(p=>p[1]))}));
/** Clip the authored levels into existing DEM cells once. Boundary vertices share
 * exact heights; untouched corners preserve the natural descent toward the beach.
 * These same triangles drive physical footing and rendered ground, not separate fits. */
export function recreationGrades(g:Grid,source:readonly number[]){
  grid=g;cells.clear();
  const patches:{key:number;points:GymPoint[];height:(p:GymPoint)=>number}[]=[];
  for(let j=0;j<g.rows-1;j++)for(let i=0;i<g.columns-1;i++){
    const x=g.minX+i*g.stepX,z=g.minZ+j*g.stepZ,xx=x+g.stepX,zz=z+g.stepZ;
    if(!bounds.some(b=>x<=b.maxX&&xx>=b.minX&&z<=b.maxZ&&zz>=b.minZ))continue;

    for(const ids of [[j*g.columns+i,j*g.columns+i+1,(j+1)*g.columns+i+1],[j*g.columns+i,(j+1)*g.columns+i+1,(j+1)*g.columns+i]]){
      const triangle:GymPoint[]=ids.map(n=>[g.minX+(n%g.columns)*g.stepX,g.minZ+Math.floor(n/g.columns)*g.stepZ]);
      let remaining=[triangle];const pieces:GymPoint[][]=[];
      for(const mask of masks){const next:GymPoint[][]=[];
        for(const poly of remaining){const inside=intersect(poly,mask.points);if(!inside.length){next.push(poly);continue;}pieces.push(inside);
          let rest=poly;for(let k=0;k<mask.points.length&&rest.length;k++){const a=mask.points[k],b=mask.points[(k+1)%mask.points.length],outside=clean(cut(rest,a,b,-1));if(outside.length)next.push(outside);rest=cut(rest,a,b);}}
        remaining=next;
      }
      pieces.push(...remaining);
      const height=(p:GymPoint)=>{const mask=masks.find(m=>contains(m.points,...p));return mask?mask.height(...p):barycentric(triangle,...p).reduce((s,w,k)=>s+w*source[ids[k]],0);};
      for(const poly of pieces)patches.push({key:j*g.columns+i,points:poly,height});
    }

  }
  // Match every shared edge, including where a terrace only touches a neighbouring
  // triangle. Otherwise an added low corner can leave a crack in the natural slope.
  const knots=[...new Map(patches.flatMap(p=>p.points).map(p=>[`${p[0].toFixed(7)},${p[1].toFixed(7)}`,p])).values()];
  for(const patch of patches){
    const boundary:GymPoint[]=[];
    for(let k=0;k<patch.points.length;k++){
      const a=patch.points[k],b=patch.points[(k+1)%patch.points.length],dx=b[0]-a[0],dz=b[1]-a[1],length2=dx*dx+dz*dz;
      boundary.push(a);
      const cuts=knots.map(p=>({p,t:((p[0]-a[0])*dx+(p[1]-a[1])*dz)/length2}))
        .filter(({p,t})=>t>1e-7&&t<1-1e-7&&Math.abs((p[0]-a[0])*dz-(p[1]-a[1])*dx)<1e-7).sort((a,b)=>a.t-b.t);
      boundary.push(...cuts.map(c=>c.p));
    }
    const heights=boundary.map(patch.height),planes=cells.get(patch.key)??[];
    // A collinear knot whose height also lies on its neighbours' straight edge
    // changes neither shape nor shared-edge continuity. Keep only real bends.
    for(let k=boundary.length-1;k>=0&&boundary.length>3;k--){
      const before=(k+boundary.length-1)%boundary.length,after=(k+1)%boundary.length,a=boundary[before],p=boundary[k],b=boundary[after];
      const dx=b[0]-a[0],dz=b[1]-a[1],length2=dx*dx+dz*dz,t=((p[0]-a[0])*dx+(p[1]-a[1])*dz)/length2;
      if(t>=0&&t<=1&&Math.abs((p[0]-a[0])*dz-(p[1]-a[1])*dx)<1e-8&&Math.abs(heights[k]-(heights[before]+(heights[after]-heights[before])*t))<1e-8){boundary.splice(k,1);heights.splice(k,1);}
    }
    // Keep a convex affine patch intact. Its internal diagonals have no height
    // meaning, and cutting every path/paint polygon against them adds many faces.
    const first=boundary.slice(0,3),firstHeights=heights.slice(0,3);
    if(Math.abs(area(first))>1e-10&&boundary.every((point,i)=>Math.abs(barycentric(first,...point).reduce((sum,w,k)=>sum+w*firstHeights[k],0)-heights[i])<1e-8)){
      planes.push({points:boundary,heights});cells.set(patch.key,planes);continue;
    }
    // Every patch is convex. Clip nondegenerate ears to use n-2 triangles,
    // retaining all shared-edge knots (including collinear height changes).
    // A centre fan adds two faces per patch and unnecessarily splits paint.
    const remaining=boundary.map((_,i)=>i),sign=area(boundary)>0?1:-1;
    const append=(ids:number[])=>planes.push({points:ids.map(i=>boundary[i]),heights:ids.map(i=>heights[i])});
    while(remaining.length>3){
      const total=Math.abs(area(remaining.map(i=>boundary[i])));
      let ear=-1,best=-1;
      for(let k=0;k<remaining.length;k++){
        const a=boundary[remaining[(k+remaining.length-1)%remaining.length]],b=boundary[remaining[k]],c=boundary[remaining[(k+1)%remaining.length]];
        const abx=b[0]-a[0],abz=b[1]-a[1],bcx=c[0]-b[0],bcz=c[1]-b[1],twice=sign*(abx*bcz-abz*bcx);
        // Never leave the remaining boundary entirely collinear: its intermediate
        // knots may carry distinct heights and cannot be silently discarded.
        if(twice<=1e-10||total-twice/2<=1e-10)continue;
        const quality=twice/(abx*abx+abz*abz+bcx*bcx+bcz*bcz+(c[0]-a[0])**2+(c[1]-a[1])**2);
        if(quality>best){ear=k;best=quality;}
      }
      if(ear<0)throw new Error('Cannot triangulate recreation terrain boundary');
      append([remaining[(ear+remaining.length-1)%remaining.length],remaining[ear],remaining[(ear+1)%remaining.length]]);
      remaining.splice(ear,1);
    }
    append(remaining);
    cells.set(patch.key,planes);
  }
  // Rejoin adjacent coplanar pieces when their union is convex. The masks may
  // split a flat terrace several times, but those bookkeeping cuts are not terrain.
  for(const planes of cells.values()){
    let changed=true;
    while(changed){changed=false;
      outer:for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++){
        const a=planes[i],b=planes[j],height=(p:GymPoint)=>barycentric(a.points,...p).reduce((sum,w,k)=>sum+w*a.heights[k],0);
        if(b.points.some((p,k)=>Math.abs(height(p)-b.heights[k])>1e-8))continue;
        let points=clean(hull([...a.points,...b.points]));const joined=Math.abs(area(points)),separate=Math.abs(area(a.points))+Math.abs(area(b.points));
        if(Math.abs(joined-separate)>1e-7)continue;
        // Select a stable first triangle for affine height evaluation; nearly
        // collinear hull knots must not amplify floating-point roundoff.
        let pivot=0,best=0;for(let k=0;k<points.length;k++){const size=Math.abs(area([points[k],points[(k+1)%points.length],points[(k+2)%points.length]]));if(size>best){best=size;pivot=k;}}
        points=[...points.slice(pivot),...points.slice(0,pivot)];
        planes[i]={points,heights:points.map(height)};planes.splice(j,1);changed=true;break outer;
      }
    }
  }
  flatRegions=[RECREATION_TERRACE.height,RECREATION_RETAINING.height,RECREATION_TRAIL.height].map(height=>{
    const polygons:MultiPolygon=[];
    for(const planes of cells.values())for(const plane of planes)if(plane.heights.every(h=>Math.abs(h-height)<1e-8))polygons.push([plane.points.map(([x,z]):[number,number]=>[x,z])]);
    return {height,polygons:polygons.length?clipping.union(polygons):[]};
  }).filter(region=>region.polygons.length>0);
  return source.slice();
}
function cellAt(x:number,z:number){return cells.get(Math.floor((z-grid.minZ)/grid.stepZ)*grid.columns+Math.floor((x-grid.minX)/grid.stepX));}
export function recreationHeight(x:number,z:number,base:number){
  for(const plane of cellAt(x,z)??[]){const w=barycentric(plane.points,x,z);if(plane.points.length===3?w.every(v=>v>=-1e-7):contains(plane.points,x,z))return w.reduce((s,v,i)=>s+v*plane.heights[i],0);}
  return base;
}
/** Input polygons already lie within one DEM triangle. */
export function splitRecreationSurface(poly:GymPoint[]):GymPoint[][]{
  const x=poly.reduce((s,p)=>s+p[0],0)/poly.length,z=poly.reduce((s,p)=>s+p[1],0)/poly.length,planes=cellAt(x,z);
  if(!planes)return [poly];
  const out:GymPoint[][]=[];let reference:Plane|undefined,affine=true;
  for(const plane of planes){
    const p=intersect(poly,plane.points);if(!p.length)continue;
    reference??=plane;
    if(affine&&plane!==reference)for(const point of p){
      const sample=(plane:Plane)=>barycentric(plane.points,...point).reduce((sum,w,i)=>sum+w*plane.heights[i],0);
      if(Math.abs(sample(plane)-sample(reference))>1e-8){affine=false;break;}
    }
    out.push(area(p)>0?p.reverse():p);
  }
  // Level terraces and untouched DEM faces need no internal render cuts. Only
  // remove them after every overlapping patch agrees on the same exact plane;
  // transitions and their shared-edge height knots still use the full split.
  if(affine&&reference)for(const point of poly){
    const y=barycentric(reference.points,...point).reduce((sum,w,i)=>sum+w*reference!.heights[i],0);
    if(Math.abs(recreationHeight(...point,y)-y)>1e-8){affine=false;break;}
  }
  return affine&&out.length?[poly]:out;
}
