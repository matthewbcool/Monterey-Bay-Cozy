/** Cached regional geography: no provider requests, scene controls or animation ownership. */
import { Box3, BufferGeometry, Color, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, ShapeUtils, Vector2, Vector3, type Material } from 'three';
import polygonClipping from 'polygon-clipping';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import data from '../../data/monterey-bay-region.json';
import { createToonMaterial } from '../../models/shared/style';
import { insidePolygon, type GymPoint } from '../avatarController';
import { splitSegmentAtPolygon } from './clip';
export const BAY_REGION=data;
export const BAY_REGION_BUDGET={triangles:85000,draws:40,imageTextures:0} as const;
const R=6371008.8*Math.PI/180;
type Point=[number,number];
type Rect=readonly [number,number,number,number];
interface Grid {columns:number;rows:number;west:number;north:number;stepLon:number;stepLat:number;values:number[]}
/** Clamped bilinear source sampling; pixel spacing describes resolution, not accuracy. */
export function sampleRegionalGrid(grid:Grid,lon:number,lat:number){
 const u=Math.max(0,Math.min(grid.columns-1.000001,(lon-grid.west)/grid.stepLon)),v=Math.max(0,Math.min(grid.rows-1.000001,(grid.north-lat)/grid.stepLat));
 const i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,n=grid.columns;
 return grid.values[j*n+i]*(1-a)*(1-b)+grid.values[j*n+i+1]*a*(1-b)+grid.values[(j+1)*n+i]*(1-a)*b+grid.values[(j+1)*n+i+1]*a*b;
}
export function createBayRegion(origin:readonly number[]=data.origin,detailFootprints:readonly (readonly GymPoint[])[]=[],localBounds?:Rect){
 const root=new Group();root.name='Monterey Bay · regional landscape';
 root.userData={assetId:'monterey-bay-region',units:'metres',budget:BAY_REGION_BUDGET,sourceDate:data.downloaded};
 const cos=Math.cos(origin[1]*Math.PI/180),sx=cos/Math.cos(data.origin[1]*Math.PI/180),tx=(data.origin[0]-origin[0])*R*cos,tz=-(data.origin[1]-origin[1])*R;
 const project=(lon:number,lat:number):Point=>[(lon-origin[0])*R*cos,-(lat-origin[1])*R];
 const convert=(p:number[]):Point=>[p[0]*sx+tx,p[1]+tz];
 const land=data.land.map(p=>p.map(r=>r.map(convert))) as polygonClipping.MultiPolygon,water=data.water.map(p=>p.map(r=>r.map(convert))) as polygonClipping.MultiPolygon;
 const [west,south,east,north]=data.bounds,[minX,minZ]=project(west,north),[maxX,maxZ]=project(east,south);
 const crop:GymPoint[]=[[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ]];
 const mask=detailFootprints.length?polygonClipping.union([detailFootprints[0] as Point[]],...detailFootprints.slice(1).map(p=>[p as Point[]])):[];
 const ground=mask.length?polygonClipping.difference(land,mask):land;
 const isLand=(x:number,z:number)=>land.some(p=>insidePolygon(x,z,p[0])&&!p.slice(1).some(r=>insidePolygon(x,z,r)));
 function heightAt(x:number,z:number){
  const lon=origin[0]+x/(R*cos),lat=origin[1]-z/R,h=sampleRegionalGrid(data.terrain,lon,lat);
  // The original local massing lives at Y=0. A recorded 600 m transition meets
  // that comparison plane; detailed park/waterfront holes retain their own DEM.
  const blend=localBounds?Math.min(1,Math.hypot(Math.max(localBounds[0]-x,0,x-localBounds[2]),Math.max(localBounds[1]-z,0,z-localBounds[3]))/600):1;
  return .08+Math.max(0,h)*blend;
 }
 const cellX=(maxX-minX)/(data.terrain.columns-1),cellZ=(maxZ-minZ)/(data.terrain.rows-1);
 function terrainHeight(x:number,z:number){
  const u=Math.max(0,Math.min(data.terrain.columns-1.000001,(x-minX)/cellX)),v=Math.max(0,Math.min(data.terrain.rows-1.000001,(z-minZ)/cellZ));
  const i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,xx=minX+i*cellX,zz=minZ+j*cellZ,h00=heightAt(xx,zz),h11=heightAt(xx+cellX,zz+cellZ);
  return a>=b?h00+a*(heightAt(xx+cellX,zz)-h00)+b*(h11-heightAt(xx+cellX,zz)):h00+b*(heightAt(xx,zz+cellZ)-h00)+a*(h11-heightAt(xx,zz+cellZ));
 }
 const edgeBoxes=ground.flatMap(p=>p.flatMap(r=>r.map((a,i)=>{const b=r[(i+1)%r.length];return {minX:Math.min(a[0],b[0]),maxX:Math.max(a[0],b[0]),minZ:Math.min(a[1],b[1]),maxZ:Math.max(a[1],b[1])};})));
 const grass=new Color('#9eae83'),forest=new Color('#4e725c'),sand=new Color('#c4bf94'),deep=new Color('#294759'),shallow=new Color('#78aaa4');
 const terrainMaterial=createToonMaterial({vertexColors:true,rim:false,name:'bay:terrain'}),seabedMaterial=createToonMaterial({vertexColors:true,rim:false,name:'bay:seabed'});
 const tiles=new Map<string,{positions:number[];colors:number[]}>();
 function emit(polygons:polygonClipping.MultiPolygon,target:{positions:number[];colors:number[]},sample:(x:number,z:number)=>number,underwater=false){
  for(const polygon of polygons){
   const rings=polygon.map(r=>r.slice(0,-1).map(p=>new Vector2(p[0],p[1]))),vertices=rings.flat();
   for(const face of ShapeUtils.triangulateShape(rings[0],rings.slice(1))){
    const t=face.map(i=>vertices[i]);if((t[1].y-t[0].y)*(t[2].x-t[0].x)-(t[1].x-t[0].x)*(t[2].y-t[0].y)<0)t.reverse();
    for(const p of t){const h=sample(p.x,p.y),color=underwater?shallow.clone().lerp(deep,Math.min(1,-h/1600)):h<20?sand.clone().lerp(grass,h/20):grass.clone().lerp(forest,Math.min(1,(h-20)/420));target.positions.push(p.x,h,p.y);target.colors.push(color.r,color.g,color.b);}
   }
  }
 }
 for(let j=0;j<data.terrain.rows-1;j++)for(let i=0;i<data.terrain.columns-1;i++){
  const x=minX+i*cellX,z=minZ+j*cellZ,xx=x+cellX,zz=z+cellZ;
  const crossing=edgeBoxes.some(b=>b.minX<=xx&&b.maxX>=x&&b.minZ<=zz&&b.maxZ>=z);
  if(!crossing&&!ground.some(p=>insidePolygon((x+xx)/2,(z+zz)/2,p[0])&&!p.slice(1).some(r=>insidePolygon((x+xx)/2,(z+zz)/2,r))))continue;
  const key=Math.floor((x-minX)/12000)+','+Math.floor((z-minZ)/12000);let tile=tiles.get(key);if(!tile){tile={positions:[],colors:[]};tiles.set(key,tile);}
  for(const triangle of [[[x,z],[xx,z],[xx,zz]],[[x,z],[xx,zz],[x,zz]]] as Point[][]){
   const polygon=[[...triangle,triangle[0]]] as polygonClipping.Polygon;
   emit(crossing?polygonClipping.intersection(polygon,ground):[polygon],tile,terrainHeight);
  }
 }
 function geometry(values:{positions:number[];colors?:number[]}){
  const source=new BufferGeometry();source.setAttribute('position',new Float32BufferAttribute(values.positions,3));
  let g=source;
  if(values.colors){
   source.setAttribute('color',new Float32BufferAttribute(values.colors,3));
   // Share the static grid vertices before computing normals. This also gives
   // the existing LOD simplifier continuous topology instead of isolated faces.
   g=mergeVertices(source,1e-4);source.dispose();g.computeVertexNormals();
  }
  g.computeBoundingSphere();g.userData.lodMaxErrorMetres=8;return g;
 }
 for(const [id,values] of tiles){const mesh=new Mesh(geometry(values),terrainMaterial);mesh.name='Bay terrain · '+id;root.add(mesh);}
 const oceanValues={positions:[] as number[],colors:[] as number[]};emit(water,oceanValues,()=>-.3);
 const ocean=new Mesh(geometry(oceanValues),createToonMaterial({color:'#467f85',rim:false,name:'bay:ocean'}));ocean.name='Bay water · coastline clipped';root.add(ocean);
 const seabedValues={positions:[] as number[],colors:[] as number[]},bx=24,bz=30;
 const bed=(x:number,z:number)=>Math.min(-1,sampleRegionalGrid(data.bathy,origin[0]+x/(R*cos),origin[1]-z/R));
 for(let j=0;j<bz;j++)for(let i=0;i<bx;i++){
  const x=minX+(maxX-minX)*i/bx,z=minZ+(maxZ-minZ)*j/bz,xx=minX+(maxX-minX)*(i+1)/bx,zz=minZ+(maxZ-minZ)*(j+1)/bz;
  emit(polygonClipping.intersection([[[x,z],[xx,z],[xx,zz],[x,zz]]],water),seabedValues,bed,true);
 }
 const seabed=new Mesh(geometry(seabedValues),seabedMaterial);seabed.name='ETOPO1 regional seafloor';seabed.visible=false;root.add(seabed);
 // Source coast, without the rectangular extraction boundary.
 const coastPositions:number[]=[];
 for(const p of land)for(const ring of p)for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length];
  if((Math.abs(a[0]-minX)<1&&Math.abs(b[0]-minX)<1)||(Math.abs(a[0]-maxX)<1&&Math.abs(b[0]-maxX)<1)||(Math.abs(a[1]-minZ)<1&&Math.abs(b[1]-minZ)<1)||(Math.abs(a[1]-maxZ)<1&&Math.abs(b[1]-maxZ)<1))continue;
  const spans=detailFootprints.reduce((spans,p)=>spans.flatMap(([a,b])=>splitSegmentAtPolygon(a,b,p).outside),[[a,b]] as [GymPoint,GymPoint][]);
  for(const [a,b] of spans)coastPositions.push(a[0],terrainHeight(...a)+2,a[1],b[0],terrainHeight(...b)+2,b[1]);
 }
 const coast=new LineSegments(geometry({positions:coastPositions}),new LineBasicMaterial({color:'#d6d9ba'}));coast.name='Regional shoreline';root.add(coast);
 const roadPositions:number[]=[];
 for(const road of data.roads)for(let i=1;i<road.points.length;i++){
  for(const [a,b] of splitSegmentAtPolygon(convert(road.points[i-1]),convert(road.points[i]),crop).inside){
   // The original local street snapshot already owns this footprint.
   const parts=localBounds?splitSegmentAtPolygon(a,b,[[localBounds[0],localBounds[1]],[localBounds[2],localBounds[1]],[localBounds[2],localBounds[3]],[localBounds[0],localBounds[3]]]).outside:[[a,b]];
   for(const [a,b] of parts){
    const breaks=[0,1];
    for(const [v0,v1] of [[(a[0]-minX)/cellX,(b[0]-minX)/cellX],[(a[1]-minZ)/cellZ,(b[1]-minZ)/cellZ],[(a[0]-minX)/cellX-(a[1]-minZ)/cellZ,(b[0]-minX)/cellX-(b[1]-minZ)/cellZ]]){
      if(Math.abs(v1-v0)<1e-9)continue;for(let k=Math.ceil(Math.min(v0,v1));k<Math.max(v0,v1);k++){const t=(k-v0)/(v1-v0);if(t>1e-8&&t<1-1e-8)breaks.push(t);}
    }
    const ordered=[...new Set(breaks)].sort((a,b)=>a-b);
    for(let k=1;k<ordered.length;k++)for(const t of [ordered[k-1],ordered[k]]){const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;roadPositions.push(x,terrainHeight(x,z)+2,z);}
   }
  }
 }
 const roads=new LineSegments(geometry({positions:roadPositions}),new LineBasicMaterial({color:'#dfc99d'}));roads.name='USGS regional highways';root.add(roads);
 const fallbackValues={positions:[] as number[],colors:[] as number[]};if(mask.length)emit(polygonClipping.intersection(land,mask),fallbackValues,()=>-.08);
 const fallback=new Mesh(geometry(fallbackValues),createToonMaterial({color:'#9eae83',rim:false}));fallback.visible=false;fallback.name='Flat comparison under detailed study';root.add(fallback);
 const bounds=new Box3(new Vector3(minX,-2000,minZ),new Vector3(maxX,600,maxZ));let disposed=false;
 return {root,bounds,places:data.places,heightAt:terrainHeight,isLand,roads,coast,ocean,seabed,
  point:(lon:number,lat:number)=>{const [x,z]=project(lon,lat);return new Vector3(x,terrainHeight(x,z),z);},
  setSeafloor(show:boolean){seabed.visible=show;ocean.visible=!show;},setDetailed(show:boolean){fallback.visible=!show;},
  dispose(){if(disposed)return;disposed=true;const geometries=new Set<BufferGeometry>(),materials=new Set<Material>();root.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);}}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}
 };
}
