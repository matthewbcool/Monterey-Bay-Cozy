import {PHOTO_PIER,PIER_LENGTH,PIER_DIRECTION,pierPoint} from './photoPier';
import { BufferGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, Path, Shape, Vector2, Vector3 } from 'three';
import clipping from 'polygon-clipping';
import features from '../../data/lovers-point-features.json';
import { mat, mesh } from '../../models/props/primitives';
import { groundHeight, drapeGeometry } from './elevation';
import { surface } from './geometry';
import type { GymCollider } from '../avatarController';
import { segmentCollider } from './parkFurniture';
import { pathStyle } from './pathStyle';

interface Landing { x:number; z:number; dx:number; dz:number; length:number; width:number; startWidth:number; endWidth:number; height:number; bottom:number; kind:'step'|'pier'|'landing'; sourceId:string }

/** The source supplies alignment, not surveyed tread/riser dimensions. Small
 * horizontal slabs follow the DEM rise. Their exact top planes are also used by
 * the walker, so a change of camera/LOD cannot change footing. */
export const ACCESS_SURFACES: Landing[] = features.paths.flatMap(route => {
  const pier = route.id === 'way/633871951';
  // This mapped footway crosses the east-beach stair cut visible in the user's photos.
  const photoSteps = route.id === 'way/633871947';
  if (route.highway !== 'steps' && !photoSteps && !pier) return [];
  const surfaces: Landing[] = [];
  const points=route.points.map(p=>[...p]);
  // The coarse DEM blends the foot of this stair into the wall. Extend a
  // clearly authored 4 m landing onto the sand so its top never ends in midair.
  if(photoSteps) {
    const a=points[points.length-2],b=points[points.length-1],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    points.push([b[0]+4*(b[0]-a[0])/length,b[1]+4*(b[1]-a[1])/length]);
  }
  for (let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],distance=Math.hypot(dx,dz);
    const count=Math.max(1,Math.ceil(distance/(pier?1:.20))),length=distance/count,ux=dx/distance,uz=dz/distance;
    for(let j=0;j<count;j++) {
      const t=(j+.5)/count,x=a[0]+dx*t,z=a[1]+dz*t;
      // The authored beach connection narrows to the original 1.5 m exit,
      // avoiding an unsupported wide tread across the coarse wall/beach slope.
      const taper=photoSteps&&i===points.length-1,
        startWidth=taper?2.1-.6*j/count:pathStyle(route).width,
        endWidth=taper?2.1-.6*(j+1)/count:pathStyle(route).width,width=(startWidth+endWidth)/2;
      const outline=([[-1,-1],[1,-1],[1,1],[-1,1]] as const).map(([s,v])=>[x+ux*length*s/2-uz*(s<0?startWidth:endWidth)*v/2,z+uz*length*s/2+ux*(s<0?startWidth:endWidth)*v/2] as const);
      const terrain=drapeGeometry(surface(outline)),positions=terrain.attributes.position;
      const corners=Array.from({length:positions.count},(_,k)=>positions.getY(k));terrain.dispose();
      surfaces.push({x,z,dx:ux,dz:uz,length,width,startWidth,endWidth,height:Math.max(groundHeight(x,z),...corners)+.035,bottom:pier?.4:Math.min(...corners)-.08,kind:pier?'pier':photoSteps&&i===2?'landing':'step',sourceId:route.id});
    }
  }
  if(pier){
    for(const s of surfaces)if((s.x-PHOTO_PIER.start[0])*PIER_DIRECTION[0]+(s.z-PHOTO_PIER.start[1])*PIER_DIRECTION[1]>=0)s.height=PHOTO_PIER.upper;
    return surfaces;
  }
  // DEM samples describe a bank, not individual treads. Use a monotone 15 cm
  // stair rhythm above that bank, and a level turning/foot landing on the east
  // access. Counts, widths and handrail dimensions remain photo-informed estimates.
  const landing=surfaces.filter(s=>s.kind==='landing');
  if(landing.length){const y=Math.max(...landing.map(s=>s.height));landing.forEach(s=>s.height=y);}
  const downhill=surfaces[0].height>=surfaces[surfaces.length-1].height;
  const flight=downhill?surfaces:[...surfaces].reverse(),base=flight[flight.length-1].height,riser=.15;
  const levels=flight.map(s=>Math.ceil((s.height-base-1e-7)/riser));
  for(let i=levels.length-2;i>=0;i--)levels[i]=Math.max(levels[i],levels[i+1]);
  for(let i=1;i<levels.length;i++)levels[i]=Math.max(levels[i],levels[i-1]-1);
  flight.forEach((s,i)=>s.height=base+levels[i]*riser);
  return surfaces;
});

// Lower landing and its stair flight are part of the same physical surface table.
const landingCentre=pierPoint(PIER_LENGTH/2,2.9);
ACCESS_SURFACES.push({x:landingCentre[0],z:landingCentre[1],dx:PIER_DIRECTION[0],dz:PIER_DIRECTION[1],length:PIER_LENGTH,width:2.6,startWidth:2.6,endWidth:2.6,height:PHOTO_PIER.lower,bottom:.4,kind:'landing',sourceId:'photo-pier-lower'});
for(let i=0;i<16;i++){
 const length=PHOTO_PIER.stairLength/16,[x,z]=pierPoint((i+.5)*length,2.35);
 ACCESS_SURFACES.push({x,z,dx:PIER_DIRECTION[0],dz:PIER_DIRECTION[1],length,width:1.5,startWidth:1.5,endWidth:1.5,height:PHOTO_PIER.upper-(i+1)*(PHOTO_PIER.upper-PHOTO_PIER.lower)/16,bottom:PHOTO_PIER.lower-.05,kind:'step',sourceId:'photo-pier-stairs'});
}

export function accessHeight(x:number,z:number):number {
  let height=groundHeight(x,z);
  for(const s of ACCESS_SURFACES) {
    const dx=x-s.x,dz=z-s.z,along=dx*s.dx+dz*s.dz;
    const t=Math.max(0,Math.min(1,along/s.length+.5)),width=s.startWidth+(s.endWidth-s.startWidth)*t;
    if(Math.abs(along)<=s.length/2+.005 && Math.abs(-dx*s.dz+dz*s.dx)<=width/2)
      height=Math.max(height,s.height);
  }
  return height;
}

/** Treads share the same public footprint as accessHeight(). Union tops of equal
 * elevation before extruding: bends/landings cannot stack coplanar slabs or flicker. */
export function accessOutline(s:Landing):[number,number][]{return ([[-1,-1],[1,-1],[1,1],[-1,1]] as const).map(([u,v])=>[Math.round((s.x+s.dx*s.length*u/2-s.dz*(u<0?s.startWidth:s.endWidth)*v/2)*1e6)/1e6,Math.round((s.z+s.dz*s.length*u/2+s.dx*(u<0?s.startWidth:s.endWidth)*v/2)*1e6)/1e6]);}

/** Non-pier bottoms sit below every sampled terrain plane. Keep all visible
 * tops/sides verbatim; the pier retains its complete underwater silhouette. */
function withoutBuriedBottom(source:BufferGeometry,bottom:number):BufferGeometry {
  const position=source.getAttribute('position'),index=source.index,kept:number[]=[];
  for(let i=0;i<(index?.count??position.count);i+=3){
    const ids=[0,1,2].map(n=>index?index.getX(i+n):i+n);
    if(ids.every(id=>Math.abs(position.getY(id)-bottom)<1e-5))continue;
    kept.push(...ids);
  }
  const result=new BufferGeometry();
  for(const [name,attribute] of Object.entries(source.attributes)){
    const values=new Float32Array(kept.length*attribute.itemSize);
    kept.forEach((id,i)=>{for(let c=0;c<attribute.itemSize;c++)values[i*attribute.itemSize+c]=attribute.array[id*attribute.itemSize+c];});
    result.setAttribute(name,new Float32BufferAttribute(values,attribute.itemSize,attribute.normalized));
  }
  result.setIndex(kept.map((_,i)=>i));source.dispose();return result;
}

export function addBeachAccess(scenery:Group,colliders:GymCollider[] = []) {
  const stone=mat('#c8c4b1'),concrete=mat('#c3c3b6'),railMaterial=mat('#607567');
  const groups=new Map<string,Landing[]>();
  for(const s of ACCESS_SURFACES){const key=s.sourceId+':'+s.height.toFixed(6);const list=groups.get(key)??[];list.push(s);groups.set(key,list);}
  for(const slabs of groups.values()){
    // Collapse collinear equal-height samples before polygon union. Sampling is for
    // the physical profile; it should not leave hundreds of invisible top edges.
    const runs:Landing[]=[];
    for(const s of slabs){
      const p=runs[runs.length-1];
      if(p&&Math.abs(p.dx-s.dx)+Math.abs(p.dz-s.dz)<1e-7&&Math.abs(p.endWidth-s.startWidth)<1e-7&&Math.abs((p.endWidth-p.startWidth)/p.length-(s.endWidth-s.startWidth)/s.length)<1e-7&&Math.hypot(s.x-p.x-p.dx*(p.length+s.length)/2,s.z-p.z-p.dz*(p.length+s.length)/2)<1e-6){
        p.x+=p.dx*s.length/2;p.z+=p.dz*s.length/2;p.length+=s.length;p.endWidth=s.endWidth;p.width=(p.startWidth+p.endWidth)/2;p.bottom=Math.min(p.bottom,s.bottom);
      }else runs.push({...s});
    }
    const first=slabs[0],bottom=Math.min(...slabs.map(s=>s.bottom)),polygons=clipping.union([accessOutline(runs[0])],...runs.slice(1).map(s=>[accessOutline(s)]));
    for(const rings of polygons){
      const shape=new Shape(rings[0].slice(0,-1).map(([x,z])=>new Vector2(x,-z)));
      shape.holes=rings.slice(1).map(r=>new Path(r.slice(0,-1).map(([x,z])=>new Vector2(x,-z))));
      let geometry:BufferGeometry=new ExtrudeGeometry(shape,{depth:first.height-bottom,bevelEnabled:false,steps:1,curveSegments:1});geometry.rotateX(-Math.PI/2);geometry.translate(0,bottom,0);
      if(first.kind!=='pier')geometry=withoutBuriedBottom(geometry,bottom);
      const slab=mesh(scenery,`${first.kind==='pier'?'Lovers Point concrete pier':'Mapped beach access tread'} · ${first.sourceId} · estimated profile`,geometry,first.kind==='pier'?concrete:stone);slab.userData.elevationPlaced=true;
    }
  }
  // The reference shows dark rails along the concrete pier. Follow the same
  // physical slab heights, leaving the terminal open for the existing boat access.
  const pier=ACCESS_SURFACES.filter(s=>s.kind==='pier');
  const darkRail=mat('#354b4b');
  for(const side of [-1,1]){
    let previous:Vector3|undefined,distance=0;
    for(let i=0;i<pier.length;i++){
      const s=pier[i];distance+=s.length;
      if(i!==0&&i!==pier.length-1&&distance<3)continue;
      distance=0;
      const along=(s.x-PHOTO_PIER.start[0])*PIER_DIRECTION[0]+(s.z-PHOTO_PIER.start[1])*PIER_DIRECTION[1];
      if(side===1&&along>=-.5&&along<PHOTO_PIER.stairLength){previous=undefined;continue;}
      const x=s.x-s.dz*(s.width/2-.08)*side,z=s.z+s.dx*(s.width/2-.08)*side;
      const base=new Vector3(x,s.height,z),top=base.clone().add(new Vector3(0,1,0));
      bar(base,top,'Concrete pier · dark railing post',darkRail);
      if(previous){
        bar(previous,top,'Concrete pier · continuous top rail',darkRail);
        bar(previous.clone().add(new Vector3(0,-.5,0)),top.clone().add(new Vector3(0,-.5,0)),'Concrete pier · middle rail',darkRail);
        colliders.push(segmentCollider([previous.x,previous.z],[x,z],.07,Math.max(previous.y,top.y)));
      }
      previous=top;
    }
  }
  // Main beach accesses have simple slender rails in the supplied photographs.
  // These remain visual details; the existing masonry proxies own solid collision.
  function bar(a:Vector3,b:Vector3,name:string,material=railMaterial){
    const delta=b.clone().sub(a),g=new CylinderGeometry(.035,.035,delta.length(),4,1,true),part=mesh(scenery,name,g,material);
    part.position.copy(a).add(b).multiplyScalar(.5);part.quaternion.setFromUnitVectors(new Vector3(0,1,0),delta.normalize());part.userData.elevationPlaced=true;
  }
  for(const id of ['way/633871947','way/633871934','photo-pier-stairs']){
    const route=ACCESS_SURFACES.filter(s=>s.sourceId===id);
    for(const side of [-1,1]){
      let previous:Vector3|undefined,distance=0;
      for(let i=0;i<route.length;i++){
        const s=route[i];distance+=s.length;
        if(i!==0&&i!==route.length-1&&distance<2)continue;
        distance=0;const x=s.x-s.dz*(s.width/2+.06)*side,z=s.z+s.dx*(s.width/2+.06)*side;
        const base=new Vector3(x,s.height,z),top=base.clone().add(new Vector3(0,.92,0));
        bar(base,top,`Beach access handrail post · ${id}`);if(previous)bar(previous,top,`Beach access handrail · ${id}`);previous=top;
      }
    }
  }
}
