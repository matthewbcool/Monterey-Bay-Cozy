import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, ShapeUtils, Vector2 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import clipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import { createToonMaterial } from '../../models/shared/style';
import { defineGeometryLods } from '../../models/shared/lod/geometry';
import { ELEVATION_GRID, groundHeight } from './elevation';
import { recreationFlatRegions, splitRecreationSurface } from './recreationGrade';

function outline(mesh:Mesh):MultiPolygon {
  const p=mesh.geometry.attributes.position,index=mesh.geometry.index,triangles:Polygon[]=[];
  for(let i=0;i<(index?.count??p.count);i+=3) {
    const ring=[0,1,2].map(k=>{const n=index?index.getX(i+k):i+k;return [p.getX(n),p.getZ(n)] as [number,number];});
    const [a,b,c]=ring;
    if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))>1e-8)triangles.push([ring]);
  }
  return triangles.length?clipping.union(triangles):[];
}
const area=(polygons:MultiPolygon)=>polygons.reduce((sum,polygon)=>sum+polygon.reduce((total,ring,index)=>{
  const a=Math.abs(ring.reduce((n,p,i)=>{const q=ring[(i+1)%ring.length];return n+p[0]*q[1]-p[1]*q[0];},0))/2;
  return total+(index===0?a:-a);
},0),0);

/** Resolve paint into disjoint planar regions, then lift them on the DEM planes.
 * Authored offsets express priority only. There is one opaque depth-writing land
 * surface, so LOD cannot make separate grass/path sheets intersect. Clipping runs
 * once at construction; no image textures, per-frame work or biased decal draws. */
export function composeGroundSurface(terrain:Group, overlays:Group, name:string):Mesh {
  const sources=[...terrain.children,...overlays.children].filter((p):p is Mesh=>p instanceof Mesh&&!p.name.includes('skirt'));
  sources.sort((a,b)=>a.geometry.attributes.position.getY(0)-b.geometry.attributes.position.getY(0));
  const layers=new Map<string,{priority:number;color:Color;kind:number;polygons:MultiPolygon}>();
  for(const source of sources) {
    const color=(source.material as MeshStandardMaterial).color,priority=source.geometry.attributes.position.getY(0),kind=source.userData.groundKind??0,key=`${priority}:${color.getHexString()}:${kind}`;
    let layer=layers.get(key);if(!layer){layer={priority,color,kind,polygons:[]};layers.set(key,layer);}
    layer.polygons.push(...outline(source));
  }
  const ordered=[...layers.values()].sort((a,b)=>b.priority-a.priority);
  let remaining=outline(sources[0]);const landArea=area(remaining),pieces:BufferGeometry[]=[];
  const paintAreas:{color:string;area:number}[]=[];
  for(const layer of ordered) {
    const mask=clipping.union(layer.polygons);let visible=clipping.intersection(remaining,mask);
    remaining=clipping.difference(remaining,mask);paintAreas.push({color:layer.color.getHexString(),area:area(visible)});
    if(!visible.length)continue;
    const vertices:number[]=[];
    // Authored flat terraces have no DEM bends. Preserve their resolved paint
    // outlines and holes while triangulating them just once at the physical level.
    for(const flat of recreationFlatRegions()){
      const planar=clipping.intersection(visible,flat.polygons);if(!planar.length)continue;
      // Bound long, nearly collinear trail contours before triangulation.
      // These 20 m strips are much coarser than the DEM and introduce no height
      // approximation; they also keep hole bridges local to each painted region.
      const zs=planar.flat(2).map(p=>p[1]),size=20,g=ELEVATION_GRID;
      const strips:MultiPolygon=[];
      for(let z=Math.floor(Math.min(...zs)/size)*size;z<Math.max(...zs);z+=size)
        strips.push(...clipping.intersection(planar,[[[g.minX,z],[g.minX+(g.columns-1)*g.stepX,z],[g.minX+(g.columns-1)*g.stepX,z+size],[g.minX,z+size]]]));
      for(const rings of strips){
        const loops=rings.map(r=>{
          const points=r.slice(0,-1).filter((p,i,a)=>Math.hypot(p[0]-a[(i+a.length-1)%a.length][0],p[1]-a[(i+a.length-1)%a.length][1])>1e-8);
          return points.filter((p,i,a)=>{const before=a[(i+a.length-1)%a.length],after=a[(i+1)%a.length];return Math.abs((p[0]-before[0])*(after[1]-p[1])-(p[1]-before[1])*(after[0]-p[0]))>1e-8;}).map(([x,z])=>new Vector2(x,-z));
        });
        const faces=ShapeUtils.triangulateShape(loops[0],loops.slice(1)),points=loops.flat();
        for(const face of faces){
          const tri=face.map(n=>[points[n].x,-points[n].y]),[a,b,c]=tri,cross=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
          if(Math.abs(cross)<1e-8)continue;
          for(const p of cross<0?tri:[a,c,b])vertices.push(p[0],flat.height,p[1]);
        }
      }
      visible=clipping.difference(visible,flat.polygons);
    }
    // Nonflat regions still split on the exact DEM/grade planes. Row strips
    // bound the clipping workload and avoid long diagonals through the whole park.
    const g=ELEVATION_GRID;
    for(let j=0;j<g.rows-1;j++) {
      const z=g.minZ+j*g.stepZ,zz=z+g.stepZ;
      const strip=clipping.intersection(visible,[[[g.minX,z],[g.minX+(g.columns-1)*g.stepX,z],[g.minX+(g.columns-1)*g.stepX,zz],[g.minX,zz]]]);
      if(!strip.length)continue;
      for(let i=0;i<g.columns-1;i++) {
        const x=g.minX+i*g.stepX,xx=x+g.stepX;
        for(const triangle of [[[x,z],[xx,z],[xx,zz]],[[x,z],[xx,zz],[x,zz]]]) {
          const clipped=clipping.intersection(strip,[triangle as [number,number][]]);
          for(const rings of clipped) {
            const loops=rings.map(r=>r.slice(0,-1).map(([x,z])=>new Vector2(x,-z))),points=loops.flat();
            for(const face of ShapeUtils.triangulateShape(loops[0],loops.slice(1))) {
              const tri=face.map(n=>[points[n].x,-points[n].y] as [number,number]);
              for(const patch of splitRecreationSurface(tri))for(let k=1;k<patch.length-1;k++){
                const face=[patch[0],patch[k],patch[k+1]], [a,b,c]=face;
                if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<1e-8)continue;
                for(const p of face)vertices.push(p[0],groundHeight(p[0],p[1]),p[1]);
              }
            }
          }
        }
      }
    }
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
    const colors=new Float32Array(geometry.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3)colors.set([layer.color.r,layer.color.g,layer.color.b],i);
    geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
    geometry.setAttribute('groundKind',new Float32BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(layer.kind),1));pieces.push(geometry);
  }
  const combined=mergeGeometries(pieces)!;pieces.forEach(p=>p.dispose());
  // The composed ground is already reduced at its exact physical/paint bends.
  // Generic planar collapse can fold thin trail markings even at zero height
  // error. Keep this authored topology in the shared LOD/disposal lifecycle;
  // the surrounding scenery still supplies the scene's distance reduction.
  defineGeometryLods(combined,()=>({mid:combined,far:combined}));
  const result=new Mesh(combined,createToonMaterial({vertexColors:true,rim:false,name}));result.name=name;result.receiveShadow=true;
  result.userData={singleGroundSurface:true,sourceParts:sources.map(p=>p.name),planArea:landArea,paintAreas,unpaintedArea:area(remaining)};
  const materials=new Set(sources.map(s=>s.material));sources.forEach(s=>{s.removeFromParent();s.geometry.dispose();});
  materials.forEach(m=>(Array.isArray(m)?m:[m]).forEach(m=>m.dispose()));return result;
}
