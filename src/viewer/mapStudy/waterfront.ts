/** Shared next region. Data is cached; no map/terrain service is contacted in the game. */
import { Box3, PlaneGeometry, BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, InstancedMesh, Shape, Path, ShapeGeometry, ShapeUtils, ExtrudeGeometry, Vector2, Vector3 } from 'three';
import { addWaterfrontTrail } from './waterfrontTrail';
import { WATERFRONT_SURFACES, partitionConvex, type SurfacePoint } from './waterfrontSurfaces';
import { addJewellPark, JEWELL_BUILDING_ID, inJewellPark } from './jewellPark';
import polygonClipping from 'polygon-clipping';
import data from '../../data/pacific-grove-waterfront.json';
import { box, cylinder, mat, mesh, disposeObject } from '../../models/props/primitives';
import { finishSpatialBatches } from '../testingGym/spatialBatches';
import { createParkNature } from '../testingGym/nature';
import { groundHeight as parkHeight } from '../testingGym/elevation';
import { insidePolygon, type GymCollider, type GymPoint } from '../avatarController';
import { MUSEUM_SITE, MUSEUM_ROOMS, museumToWorld, museumToLocal, inMuseumRect } from '../../data/pacificGroveMuseum';
export const WATERFRONT = data;
export const WATERFRONT_BUDGET = { triangles: 100000, draws: 90 };
export const WATERFRONT_LAND = data.land.map(p=>[p[0],p[1]] as GymPoint);
export const WATERFRONT_BUILDING_IDS = new Set(data.buildings.map(b=>b.id));
const grid=data.terrain.grid, landPolygon=[data.land] as polygonClipping.Polygon;
// Remove DEM triangles under the authored museum floors instead of layering nearly
// coplanar surfaces. The source data remains unchanged and regional comparison works.
const museumFloors=[...MUSEUM_ROOMS.map(r=>r.rect),[14.08,0,19,14],[-.3,24.27,25.6,40],[15.34,20.82,25.6,24.27],[14.08,-14,19,0],[19,3.5,39.5,5.5]]
  .map(([a,b,c,d])=>[[[a,b],[c,b],[c,d],[a,d]]] as polygonClipping.Polygon);
const museumMask=polygonClipping.union(museumFloors[0],...museumFloors.slice(1))
  .map(p=>p.map(r=>r.map(([x,z])=>museumToWorld(x,z).map(n=>Math.round(n*1e5)/1e5) as [number,number])));
const nearMuseum=(x:number,z:number)=>x> -85&&x<20&&z>385&&z<480;

// Grid-aligned district patch: disjoint paving is concentrated at the museum/park.
export const DISTRICT_SURFACE_BOUNDS={minX:grid.minX+7*grid.stepX,maxX:grid.minX+24*grid.stepX,minZ:grid.minZ+28*grid.stepZ,maxZ:grid.minZ+45*grid.stepZ};
const patch=DISTRICT_SURFACE_BOUNDS;
/** Partition the coastal trail and district cells; distant residential roads keep sparse ribbons. */
const coastalRoutes=data.paths.filter(r=>r.name==='Monterey Bay Coastal Trail');
const paintedCells=new Set<string>();
const paintRects:polygonClipping.Polygon[]=[[[[patch.minX,patch.minZ],[patch.maxX,patch.minZ],[patch.maxX,patch.maxZ],[patch.minX,patch.maxZ]]]];
for(const r of coastalRoutes){
  const xs=r.points.map(p=>p[0]),zs=r.points.map(p=>p[1]);
  for(let j=Math.floor((Math.min(...zs)-40-grid.minZ)/grid.stepZ);j<=Math.floor((Math.max(...zs)+40-grid.minZ)/grid.stepZ);j++)
  for(let i=Math.floor((Math.min(...xs)-40-grid.minX)/grid.stepX);i<=Math.floor((Math.max(...xs)+40-grid.minX)/grid.stepX);i++){
    const key=i+','+j;if(paintedCells.has(key))continue;paintedCells.add(key);
    const x=grid.minX+i*grid.stepX,z=grid.minZ+j*grid.stepZ,xx=grid.minX+(i+1)*grid.stepX,zz=grid.minZ+(j+1)*grid.stepZ;
    paintRects.push([[[x,z],[xx,z],[xx,zz],[x,zz]]]);
  }
}
const paintedMask=polygonClipping.union(paintRects[0],...paintRects.slice(1));
function overlapsPaint(minX:number,maxX:number,minZ:number,maxZ:number){
  if(minX<=patch.maxX&&maxX>=patch.minX&&minZ<=patch.maxZ&&maxZ>=patch.minZ)return true;
  for(let j=Math.floor((minZ-grid.minZ)/grid.stepZ);j<=Math.floor((maxZ-grid.minZ)/grid.stepZ);j++)
  for(let i=Math.floor((minX-grid.minX)/grid.stepX);i<=Math.floor((maxX-grid.minX)/grid.stepX);i++)if(paintedCells.has(i+','+j))return true;
  return false;
}
const value=(i:number,j:number)=>data.terrain.values[j*grid.columns+i];
/** Two planes per DEM cell; a short explicit transition meets the existing park seam. */
export function waterfrontHeight(x:number,z:number){
  const u=Math.max(0,Math.min(grid.columns-1.000001,(x-grid.minX)/grid.stepX));
  const v=Math.max(0,Math.min(grid.rows-1.000001,(z-grid.minZ)/grid.stepZ));
  const i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,h00=value(i,j),h11=value(i+1,j+1);
  const h=a>=b?h00+a*(value(i+1,j)-h00)+b*(h11-value(i+1,j)):h00+b*(value(i,j+1)-h00)+a*(h11-value(i,j+1));
  const blend=Math.max(0,Math.min(1,(z-130)/20));
  const base=Math.max(1.08,parkHeight(x,130)*(1-blend)+h*blend);
  // The museum owns its elevated floors and supports. Do not pull adjacent DEM
  // vertices up to floor height: that folds the street/sidewalk into long spikes.
  return base;
}
export function inWaterfront(x:number,z:number){return z>=130&&insidePolygon(x,z,WATERFRONT_LAND);}
export function waterfrontFootprint(origin:readonly[number,number]):GymPoint[]{return [[-145,130],[1500,130],[1500,900],[-145,900]].map(p=>projectWaterfront(p,origin));}
export function projectWaterfront(p:readonly number[],origin:readonly[number,number]):[number,number]{
  const r=Math.PI/180*6371008.8,s=Math.cos(origin[1]*Math.PI/180)/Math.cos(data.origin[1]*Math.PI/180);
  return [p[0]*s+(data.origin[0]-origin[0])*r*Math.cos(origin[1]*Math.PI/180),p[1]-(data.origin[1]-origin[1])*r];
}
function shape(rings:readonly (readonly number[])[]){return new Shape(rings.map(p=>new Vector2(p[0],-p[1])));}
export function createWaterfrontArea(origin:readonly[number,number]=data.origin as [number,number]){
  const source=new Group(),colliders:GymCollider[]=[],flightObstacles:{minX:number;maxX:number;minZ:number;maxZ:number;top:number;footprint?:readonly GymPoint[]}[]=[];
  const grass=mat('#9fa778'),stone=mat('#8b897b'),road=mat('#848b83'),trail=mat('#c8bea0'),sand=mat('#d9c6a3');
  // Interior grid cells emit directly into spatial tiles. Only coastline/crop cells
  // need polygon clipping; avoid constructing thousands of temporary scene objects.
  const tiles=new Map<string,number[]>();
  const edges=data.land.map((a,i)=>{const b=data.land[(i+1)%data.land.length];return {minX:Math.min(a[0],b[0]),maxX:Math.max(a[0],b[0]),minZ:Math.min(a[1],b[1]),maxZ:Math.max(a[1],b[1])};});
  function emit(input:number[][],x:number,z:number,kind:string){
    // Boolean cuts can retain collinear vertices. Omit zero-area fans and their
    // redundant edge points without changing the painted region or DEM plane.
    const unique=input.filter((p,i)=>{const a=input[(i+input.length-1)%input.length];return Math.hypot(p[0]-a[0],p[1]-a[1])>1e-8;});
    const points=unique.filter((p,i)=>{const a=unique[(i+unique.length-1)%unique.length],b=unique[(i+1)%unique.length];return Math.abs((p[0]-a[0])*(b[1]-p[1])-(p[1]-a[1])*(b[0]-p[0]))>1e-8;});
    if(points.length<3)return;
    const key=kind+':'+Math.floor(x/256)+','+Math.floor(z/256);let values=tiles.get(key);if(!values){values=[];tiles.set(key,values);}
    for(let k=1;k<points.length-1;k++){const tri=[points[0],points[k],points[k+1]];
      if(Math.abs((tri[1][0]-tri[0][0])*(tri[2][1]-tri[0][1])-(tri[1][1]-tri[0][1])*(tri[2][0]-tri[0][0]))<1e-8)continue;
      if((tri[1][1]-tri[0][1])*(tri[2][0]-tri[0][0])-(tri[1][0]-tri[0][0])*(tri[2][1]-tri[0][1])<0)tri.reverse();
      for(const p of tri)values.push(p[0],waterfrontHeight(p[0],p[1]),p[1]);}
  }
  for(let j=0;j<grid.rows-1;j++)for(let i=0;i<grid.columns-1;i++){
    const x=grid.minX+i*grid.stepX,z=grid.minZ+j*grid.stepZ,xx=x+grid.stepX,zz=z+grid.stepZ;
    if(xx< -145||x>1500||zz<130||z>900)continue;
    const edge=edges.some(e=>e.minX<=xx&&e.maxX>=x&&e.minZ<=zz&&e.maxZ>=z);
    if(!edge&&!inWaterfront((x+xx)/2,(z+zz)/2))continue;
    const district=x>=patch.minX-.001&&xx<=patch.maxX+.001&&z>=patch.minZ-.001&&zz<=patch.maxZ+.001;
    const regions=district||paintedCells.has(i+','+j)?WATERFRONT_SURFACES.filter(r=>(district||r.kind!=='sand')&&r.minX<=xx&&r.maxX>=x&&r.minZ<=zz&&r.maxZ>=z):[];
    function fragments(polys:polygonClipping.MultiPolygon){
      const result:SurfacePoint[][]=[];
      for(const poly of polys){const rings=poly.map(r=>r.slice(0,-1).map(p=>new Vector2(p[0],p[1]))),vertices=rings.flat();for(const face of ShapeUtils.triangulateShape(rings[0],rings.slice(1)))result.push(face.map(i=>[vertices[i].x,vertices[i].y]));}return result;
    }
    for(const tri of [[[x,z],[xx,z],[xx,zz]],[[x,z],[xx,zz],[x,zz]]]){
      let base=edge?polygonClipping.intersection([tri] as polygonClipping.Polygon,landPolygon):[[[...tri,tri[0]]]] as polygonClipping.MultiPolygon;
      if(nearMuseum(x,z))base=polygonClipping.difference(base,museumMask);
      if(!base.length)continue;
      // Partition rather than overlay. Each convex fragment belongs to one finish.
      let remaining=fragments(base);
      for(const region of regions){const next:SurfacePoint[][]=[];for(const fragment of remaining){const cut=partitionConvex(fragment,region.polygon[0] as SurfacePoint[]);if(cut.inside.length)emit(cut.inside,x,z,region.kind);next.push(...cut.outside);}remaining=next;}
      for(const fragment of remaining)emit(fragment,x,z,'grass');
    }
  }
  for(const [key,values] of tiles){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(values,3));g.computeVertexNormals();mesh(source,'Single-surface waterfront '+key,g,({grass,road,trail,sand} as Record<string,typeof grass>)[key.split(':')[0]]);}
  // Close coast/crop below the water datum.
  const walls:number[]=[];
  data.land.forEach((a,i)=>{const b=data.land[(i+1)%data.land.length],count=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/8);for(let k=0;k<count;k++){
    const x=a[0]+(b[0]-a[0])*k/count,z=a[1]+(b[1]-a[1])*k/count,xx=a[0]+(b[0]-a[0])*(k+1)/count,zz=a[1]+(b[1]-a[1])*(k+1)/count;
    walls.push(x,waterfrontHeight(x,z),z,xx,waterfrontHeight(xx,zz),zz,xx,-4,zz,x,waterfrontHeight(x,z),z,xx,-4,zz,x,-4,z);
  }});
  const skirt=new BufferGeometry();skirt.setAttribute('position',new Float32BufferAttribute(walls,3));skirt.computeVertexNormals();mesh(source,'Coastal bluff and bounded inland crop',skirt,stone);
  // Outside the detailed district retain the existing sparse route ribbons.
  for(const route of data.paths){
    if(route.name==='Monterey Bay Coastal Trail')continue; // entirely owned by the partitioned surface
    const pedestrian=['footway','path','cycleway','steps','pedestrian'].includes(route.kind),tag=Number.parseFloat(route.width),width=Number.isFinite(tag)&&tag>0?Math.min(tag,12):pedestrian?2.2:route.kind==='service'?3.5:6;
    const [a,b]=route.points,dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.02)continue;
    const nx=-dz/length*width/2,nz=dx/length*width/2,n=Math.ceil(length/6);
    for(let k=0;k<n;k++){
      const x=a[0]+dx*k/n,z=a[1]+dz*k/n,xx=a[0]+dx*(k+1)/n,zz=a[1]+dz*(k+1)/n;
      const local=polygonClipping.intersection([[[x+nx,z+nz],[xx+nx,zz+nz],[xx-nx,zz-nz],[x-nx,z-nz]]],landPolygon);
      const clipped=overlapsPaint(Math.min(x,xx)-Math.abs(nx),Math.max(x,xx)+Math.abs(nx),Math.min(z,zz)-Math.abs(nz),Math.max(z,zz)+Math.abs(nz))?polygonClipping.difference(local,paintedMask):local;
      for(const p of clipped){
        const g=new ShapeGeometry(shape(p[0]));g.rotateX(-Math.PI/2);const v=g.attributes.position;for(let i=0;i<v.count;i++)v.setY(i,waterfrontHeight(v.getX(i),v.getZ(i))+(pedestrian?.12:.07));g.computeVertexNormals();mesh(source,'Mapped '+route.kind+' '+route.name,g,pedestrian?trail:road);
      }
    }
  }
  const palette=['#dac8a5','#c4d4cb','#c8bfad','#b6c8cd','#ece0c6'].map(c=>mat(c)),roof=mat('#756b60');
  for(const b of data.buildings){
    if(b.id===MUSEUM_SITE.osmId||b.id===JEWELL_BUILDING_ID)continue; // detailed museum owns geometry and door colliders
    const rings=b.rings,outer=rings[0],xs=outer.map(p=>p[0]),zs=outer.map(p=>p[1]);
    const cx=xs.reduce((a,b)=>a+b,0)/xs.length,cz=zs.reduce((a,b)=>a+b,0)/zs.length;
    if(!inWaterfront(cx,cz))continue;
    const tags=b.tags as Record<string,string|undefined>,explicit=Number.parseFloat(tags.height??''),levels=Number(tags['building:levels']);
    const height=explicit>0?explicit*(tags.height?.includes('ft')?.3048:1):levels>0?levels*3:6;
    const base=Math.max(...outer.map(p=>waterfrontHeight(p[0],p[1]))),s=shape(outer);for(const hole of rings.slice(1))s.holes.push(new Path(hole.map(p=>new Vector2(p[0],-p[1]))));
    const bottom=Math.min(...outer.map(p=>waterfrontHeight(p[0],p[1])))-.5;
    const g=new ExtrudeGeometry(s,{depth:base+height-bottom,bevelEnabled:false,steps:1});g.rotateX(-Math.PI/2);g.translate(0,bottom,0);
    // Only the side group is needed: the explicit roof supplies the top and terrain hides the bottom.
    const sides=g.groups[1];if(sides){const trimmed=new Float32BufferAttribute(g.attributes.position.array.slice(sides.start*3,(sides.start+sides.count)*3),3);const normals=new Float32BufferAttribute(g.attributes.normal.array.slice(sides.start*3,(sides.start+sides.count)*3),3);g.setAttribute('position',trimmed);g.setAttribute('normal',normals);g.deleteAttribute('uv');g.clearGroups();}
    let hash=0;for(const char of b.id)hash=(hash*31+char.charCodeAt(0))>>>0;mesh(source,'Mapped building '+b.id,g,palette[hash%palette.length]);
    const cap=new ShapeGeometry(s);cap.rotateX(-Math.PI/2);cap.translate(0,base+height,0);mesh(source,'Estimated flat roof '+b.id,cap,roof);
    // Public-source cannery character; facade subdivisions and roof details are estimates.
    // Keep details in existing static batches and preserve the mapped building envelope.
    const aquarium=tags.name==='Monterey Bay Aquarium';
    const cannery=tags['addr:street']==='Cannery Row';
    if(aquarium||cannery){
      const glass=mat('#527e83'),trim=mat('#d5d3bc'),steel=mat('#667978');
      for(let i=0;i<outer.length;i++){
        const a=outer[i],b=outer[(i+1)%outer.length],dx=b[0]-a[0],dz=b[1]-a[1],span=Math.hypot(dx,dz);
        if(span<7)continue;
        let nx=-dz/span,nz=dx/span;const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
        if(insidePolygon(mx+nx*.1,mz+nz*.1,outer.map(p=>[p[0],p[1]] as GymPoint))){nx=-nx;nz=-nz;}
        const bays=Math.floor(span/(aquarium?11:14)),width=span/bays*.66;
        for(let j=0;j<bays;j++)for(const y of aquarium?[2.4,6.6]:[2.5]){
          if(y+1.3>height)continue;
          const x=a[0]+dx*(j+.5)/bays,z=a[1]+dz*(j+.5)/bays;
          const window=mesh(source,'Cannery recessed glazing',new PlaneGeometry(width,2.1),glass,x+nx*.06,base+y,z+nz*.06);window.rotation.y=Math.atan2(nx,nz);
          const sill=mesh(source,'Cannery window sill',new PlaneGeometry(width+.18,.12),trim,x+nx*.09,base+y-1.08,z+nz*.09);sill.rotation.y=window.rotation.y;
          const mullion=mesh(source,'Industrial window division',new PlaneGeometry(.085,2.1),trim,x+nx*.11,base+y,z+nz*.11);mullion.rotation.y=window.rotation.y;
        }
      }
      if(aquarium){
        // Low raised monitor roofs fit entirely within the source footprint, away from its courtyard.
        let monitors=0;
        for(let x=Math.min(...xs)+12;x<Math.max(...xs)-12;x+=23)for(let z=Math.min(...zs)+12;z<Math.max(...zs)-12;z+=24){
          const monitorRing=[[x-7.2,z-4.2],[x+7.2,z-4.2],[x+7.2,z+4.2],[x-7.2,z+4.2]];
          if(monitors>=4||polygonClipping.difference([monitorRing] as polygonClipping.Polygon,rings as polygonClipping.Polygon).length)continue;
          box(source,'Cannery roof monitor',[14,.9,8],glass,[x,base+height+.45,z]);
          box(source,'Monitor cap',[14.4,.18,8.4],steel,[x,base+height+.99,z]);
          if(monitors<2){cylinder(source,'Hovden-inspired cannery stack',.7,5,steel,[x,base+height+2.5,z]);cylinder(source,'Stack rim',.8,.18,steel,[x,base+height+5,z]);}
          monitors++;
        }
      }
    }
    flightObstacles.push({footprint:outer.map(p=>[p[0],p[1]] as GymPoint),minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs),top:base+height+(aquarium?5.2:0)});
    colliders.push({kind:'box',footprint:outer.map(p=>[p[0],p[1]] as GymPoint),minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)});
  }
  const jewellPark=addJewellPark(source,waterfrontHeight,colliders,flightObstacles);
  const trailDetails=addWaterfrontTrail(source,waterfrontHeight,colliders);
  let seed=241026;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const nature=createParkNature(random,waterfrontHeight);
  for(let i=3;i<data.coast.length-3;i+=7){const [x,z]=data.coast[i];nature.rock(x,z,2+random()*2);}
  // Seeded ornamental trees are artistic placements, outside mapped road/building clearances.
  for(let i=0;i<90;i++){const x=-100+random()*1400,z=155+random()*700;if(!inWaterfront(x,z)||inJewellPark(x,z))continue;
    const [u,v]=museumToLocal(x,z);if(inMuseumRect(u,v,[-5,-6,43,45]))continue;
    if(colliders.some(c=>c.kind==='box'&&x>c.minX-8&&x<c.maxX+8&&z>c.minZ-8&&z<c.maxZ+8))continue;
    if(data.paths.some(r=>{const [a,b]=r.points,dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<8;}))continue;
    nature.tree(x,z,6+random()*3);
  }
  const root=finishSpatialBatches(source,'pacific-grove-waterfront',256);
  root.traverse(o=>{if(o instanceof Mesh)o.geometry.userData.lodMaxErrorMetres=.02;});root.add(nature.finish());root.name=data.name;
  root.userData={assetId:'pacific-grove-waterfront',units:'metres',seed:241026,source:data.source,limits:data.limits,budget:WATERFRONT_BUDGET};
  const scale=Math.cos(origin[1]*Math.PI/180)/Math.cos(data.origin[1]*Math.PI/180),matrix=new Matrix4().makeScale(scale,1,1),instance=new Matrix4(),seen=new Set<BufferGeometry>();
  root.traverse(o=>{if(o instanceof InstancedMesh){for(let i=0;i<o.count;i++){o.getMatrixAt(i,instance);o.setMatrixAt(i,instance.premultiply(matrix));}o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();}else if(o instanceof Mesh&&!seen.has(o.geometry)){o.geometry.applyMatrix4(matrix);o.geometry.computeBoundingSphere();seen.add(o.geometry);}});
  const [x,z]=projectWaterfront([0,0],origin);root.position.set(x,0,z);root.updateMatrixWorld(true);const bounds=new Box3().setFromObject(root);let disposed=false;
  const gazebo=jewellPark.gazebo,gazeboFloor=Array.from({length:8},(_,i)=>[gazebo.x+Math.sin(i*Math.PI/4)*3.5,gazebo.z+Math.cos(i*Math.PI/4)*3.5] as GymPoint);
  const floorAt=(x:number,z:number)=>insidePolygon(x,z,gazeboFloor)?gazebo.y+.1:waterfrontHeight(x,z);
  return {root,colliders,flightObstacles,trail:trailDetails,jewellPark,floorAt,bounds,center:bounds.getCenter(new Vector3()),dispose(){if(disposed)return;disposed=true;root.traverse(o=>{if(o instanceof InstancedMesh)o.dispose();});disposeObject(root);}};
}
