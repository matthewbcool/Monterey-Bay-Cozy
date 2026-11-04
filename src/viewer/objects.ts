import { attachToSurface, type SurfaceAttachment } from '../models/shared/surfaceAttachment';
import { Box3, BufferGeometry, CylinderGeometry, GridHelper, Group, InstancedMesh, LineBasicMaterial, LineSegments, Mesh, Vector3 } from 'three';
import { propCollection } from '../models/props/catalogue';
import { disposeObject } from '../models/props/primitives';
import { createToonMaterial } from '../models/shared/style';

export function createObjectPreview(){
  const root=new Group();root.name='Metre-scale object inspection';
  const turntable=new Group();root.add(turntable);
  const pedestal=new Mesh(new CylinderGeometry(1,1.02,.06,32),createToonMaterial({color:'#4f7a72',rim:false}));
  pedestal.position.y=-.035;pedestal.receiveShadow=true;root.add(pedestal);
  const comparison=new Group();comparison.name='True-scale comparison';comparison.visible=false;root.add(comparison);
  const grid=new GridHelper(16,16,'#77978a','#3a615e');grid.position.y=-.01;comparison.add(grid);
  const points=[new Vector3(-6,0,1),new Vector3(-6,1.8,1)];
  for(let y=0;y<=1.8;y+=.1)points.push(new Vector3(-6,y,1),new Vector3(-6+(Math.round(y*10)%5===0?.22:.1),y,1));
  points.push(new Vector3(-6,1.8,1),new Vector3(-5.7,1.8,1));
  const ruler=new LineSegments(new BufferGeometry().setFromPoints(points),new LineBasicMaterial({color:'#e7dfbb'}));ruler.name='1.8 metre height marker';comparison.add(ruler);
  let populated=false,selected:Group|undefined,attachment:SurfaceAttachment|undefined;
  function setCompare(enabled:boolean){
    if(enabled&&!populated){
      const places=[[-4,0,0],[-2,0,0],[.5,0,0],[4.4,0,0],[-4,0,4],[-1.9,0,3.2],[1.6,0,4.2],[3.1,0,4.2],[3.5,0,4.2],[-4,0,-3.3],[-1.8,0,-3.3]];
      let treeIndex=0;
      propCollection.forEach((entry,i)=>{const model=entry.create(),bounds=new Box3().setFromObject(model),place=entry.category==='Trees'?[-16.5+(treeIndex%4)*11,0,-14-Math.floor(treeIndex++/4)*12]:places[i]??[1+(i-places.length)%3*2.4,0,-3.3-Math.floor((i-places.length)/3)*3];model.position.set(place[0],-bounds.min.y,place[2]);comparison.add(model);});
      const center=new Box3().setFromObject(comparison).getCenter(new Vector3());comparison.position.set(-center.x,0,-center.z);populated=true;
    }
    comparison.visible=enabled;turntable.visible=pedestal.visible=!enabled;
  }
  function select(id:string,count=1){
    const entry=propCollection.find(p=>p.id===id);if(!entry)throw new Error('Unknown prop: '+id);
    if(count!==1&&!entry.instances?.counts.includes(count))throw new Error('Unsupported object group size');
    attachment?.detach();attachment=undefined;if(selected)disposeObject(selected);
    selected=count>1?entry.instances!.create(count):entry.create();turntable.add(selected);
    const bounds=new Box3().setFromObject(selected),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
    // Keep actual metre geometry. Fit the camera; never inflate the asset.
    selected.position.set(-center.x,-bounds.min.y,-center.z);
    turntable.rotation.y=selected.userData.inspectionHeadingRadians??0;setCompare(false);
    const radius=Math.max(.22,Math.hypot(size.x,size.z)*.60+.08);pedestal.scale.set(radius,1,radius);
    if(selected.userData.crawlSpeedMetersPerSecond)attachment=attachToSurface(selected,{surface:pedestal,point:new Vector3(0,.03,0),normal:new Vector3(0,1,0)},{speedMetersPerSecond:selected.userData.crawlSpeedMetersPerSecond,maxTravelMeters:.08,offsetMeters:.0001});
    let triangles=0,drawCalls=0;
    selected.traverseVisible(o=>{if(o instanceof Mesh){const instances=o instanceof InstancedMesh?o.count:1;if(instances){drawCalls++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*instances;}}});
    return {entry,height:size.y,size,triangles,drawCalls};
  }
  return {root,turntable,comparison,select,setCompare,update(dt:number){if(selected&&!comparison.visible){attachment?.update(dt);propCollection.find(p=>p.id===selected!.userData.assetId)?.animate?.(selected,dt);}},get selected(){return selected;},dispose(){
    attachment?.detach();grid.geometry.dispose();(grid.material as LineBasicMaterial).dispose();ruler.geometry.dispose();ruler.material.dispose();disposeObject(root);
  }};
}
