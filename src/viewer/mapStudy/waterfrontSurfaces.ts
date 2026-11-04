/** Disjoint ground paint regions. Roads/path intersections share a single surface. */
import type polygonClipping from 'polygon-clipping';
import data from '../../data/pacific-grove-waterfront.json';
const snap=(n:number)=>Math.round(n*1e5)/1e5;
const road:polygonClipping.Polygon[]=[],trail:polygonClipping.Polygon[]=[];
const joins=new Map<string,{kind:'road'|'trail';ends:[number,number][];directions:[number,number][]}>();
for(const r of data.paths){
 const pedestrian=['footway','path','cycleway','steps','pedestrian'].includes(r.kind),tag=Number.parseFloat(r.width),width=Number.isFinite(tag)&&tag>0?Math.min(tag,12):pedestrian?2.2:r.kind==='service'?3.5:6;
 const [a,b]=r.points,dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.02)continue;
 const nx=-dz/length*width/2,nz=dx/length*width/2;
 const ring=[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]].map(p=>p.map(snap) as [number,number]);
 const kind=pedestrian&&r.name!=='Monterey Bay Coastal Trail'?'trail':'road';
 (kind==='trail'?trail:road).push([ring]);
 for(const p of [a,b]){
   const key=kind+':'+snap(p[0])+','+snap(p[1]);let join=joins.get(key);
   if(!join){join={kind,ends:[],directions:[]};joins.set(key,join);}
   join.ends.push([snap(p[0]+nx),snap(p[1]+nz)],[snap(p[0]-nx),snap(p[1]-nz)]);join.directions.push([dx/length,dz/length]);
 }
}
// Bevel adjoining mapped segments. Independent butt-ended rectangles leave a
// triangular bite at bends even when their height and depth are exact.
for(const join of joins.values()){
 if(join.directions.length<2)continue;
 const a=join.directions[0];if(join.directions.every(b=>Math.abs(a[0]*b[1]-a[1]*b[0])<.001))continue;
 const points=join.ends.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross=(a:number[],b:number[],c:number[])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const half=(list:[number,number][])=>{const h:[number,number][]=[];for(const p of list){while(h.length>=2&&cross(h[h.length-2],h[h.length-1],p)<=0)h.pop();h.push(p);}h.pop();return h;};
 const hull=[...half(points),...half([...points].reverse())];
 if(hull.length>=3)(join.kind==='road'?road:trail).push([hull]);
}
// Authored concrete access to the mapped Jewell gazebo and Little House.
const parkPaths=[[[ -10,388],[1.78,373.99]],[[1.78,373.99],[11,357]],[[11,357],[21,350]]];
for(const [a,b] of parkPaths){const dx=b[0]-a[0],dz=b[1]-a[1],n=Math.hypot(dx,dz),nx=-dz/n,nz=dx/n;trail.push([[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]]]);}
// Partition only the few intersecting ribbons in each DEM cell. Avoid a global
// floating-point union of thousands of almost-collinear source segments.
const beaches=data.polygons.filter(p=>p.kind==='beach').map(p=>[p.points] as polygonClipping.Polygon);
export const WATERFRONT_SURFACES=([['road',road],['trail',trail],['sand',beaches]] as const).flatMap(([kind,polys])=>polys.map(polygon=>{
 const points=polygon[0];return {kind,polygon,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1]))};
}));

export type SurfacePoint=[number,number];
const area=(p:SurfacePoint[])=>p.reduce((a,v,i)=>{const b=p[(i+1)%p.length];return a+v[0]*b[1]-b[0]*v[1];},0);
/** Convex terrain fragments split against rectangular ribbons, without a sweep-line
 * boolean operation on nearly coincident OSM joins. Results share exact cut vertices. */
export function partitionConvex(subject:SurfacePoint[],clip:SurfacePoint[]){
 // A ribbon can overlap the cell bounds yet miss an already-cut fragment.
 // Reject disjoint convex polygons before splitting: otherwise every line extends
 // across unrelated ground and needlessly multiplies triangles.
 for(const polygon of [subject,clip])for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],nx=a[1]-b[1],nz=b[0]-a[0];
  const project=(p:SurfacePoint)=>p[0]*nx+p[1]*nz;
  const s=subject.map(project),c=clip.map(project);
  if(Math.max(...s)<=Math.min(...c)+1e-9||Math.max(...c)<=Math.min(...s)+1e-9)return {inside:[],outside:[subject]};
 }
 let inside=subject;const outside:SurfacePoint[][]=[];const orientation=area(clip)>0?1:-1;
 for(let k=0;k<clip.length&&inside.length;k++){
  const a=clip[k],b=clip[(k+1)%clip.length],d=(p:SurfacePoint)=>orientation*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
  const yes:SurfacePoint[]=[],no:SurfacePoint[]=[];
  for(let i=0;i<inside.length;i++){const p=inside[i],q=inside[(i+1)%inside.length],dp=d(p),dq=d(q);(dp>=0?yes:no).push(p);if((dp<0)!==(dq<0)){const t=dp/(dp-dq),v:SurfacePoint=[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];yes.push(v);no.push(v);}}
  if(no.length>=3&&Math.abs(area(no))>1e-8)outside.push(no);
  inside=yes.length>=3&&Math.abs(area(yes))>1e-8?yes:[];
 }
 return {inside,outside};
}
