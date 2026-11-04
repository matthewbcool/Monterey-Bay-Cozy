import { CatmullRomCurve3, Euler, MathUtils, Mesh, Sphere, Vector3, type Object3D } from 'three';
import type { FishModel } from '../models/types';
import { TANK_SIZE } from './swimPath';
import { createSeaOtterRoute } from './seaOtterRoute';

/** Radius around the placement root, using animation-safe culling spheres in metres. */
export function creatureRadius(model:{root:Object3D}){
  let radius=0;model.root.updateMatrixWorld(true);const sphere=new Sphere();
  model.root.traverseVisible(object=>{
    if(!(object instanceof Mesh))return;
    object.geometry.computeBoundingSphere();
    const animated=object as Mesh & {boundingSphere?:Sphere|null};
    sphere.copy(animated.boundingSphere??object.geometry.boundingSphere!).applyMatrix4(object.matrixWorld);
    radius=Math.max(radius,sphere.radius+sphere.center.length());
  });
  return radius+.08;
}
export interface DemoHabitat {
  /** Metres above the tank midpoint; path envelopes are clipped to safe clearance. */
  level:number; wave:number;
  /** Fraction of available half-width/depth; center is also in these fractions. */
  width:number; depth:number; centerX?:number; centerZ?:number;
}

/** An individual, metre-scale loop through the exhibit. The bounding sphere keeps
 * the whole animal (or school), including turns, away from glass/floor/surface. */
export function createDemoRoute(model: Pick<FishModel, 'root'|'getState'|'setMotionOwner'>, options: {
  index: number; radius: number; verticalRadius?:number; habitat:DemoHabitat; start?: number; speed: {readonly slow:number;readonly fast:number};
}) {
  if(model.root.userData.locomotion==='surface-otter')return createSeaOtterRoute(model,{...options,tankSize:TANK_SIZE});
  const {index, radius, speed,habitat}=options;
  // Level schools only yaw and bank: their long horizontal formation need not
  // reserve that same radius above and below. Other routes use a full sphere.
  const floor=model.root.userData.locomotion==='crawl-jet';
  const envelope=new Vector3(radius,floor?model.root.userData.lengthMeters*.12:options.verticalRadius??radius,radius);
  const envelopeCenter=new Vector3(0,floor?envelope.y:0,0);
  const clearance=new Vector3(TANK_SIZE.width/2,TANK_SIZE.height/2,TANK_SIZE.depth/2).sub(envelope).addScalar(-.25);
  if(options.verticalRadius!==undefined&&habitat.wave!==0)throw new Error('A flattened school envelope requires level travel');
  if(!Number.isFinite(radius)||radius<=0||Math.min(clearance.x,clearance.y,clearance.z)<=0)throw new RangeError('Demo creature does not fit inside the tank');
  const phase=index*2.399963229728653,reverse=index%3===1?-1:1;
  const cx=clearance.x*(habitat.centerX??0),cz=clearance.z*(habitat.centerZ??0);
  const rx=(clearance.x-Math.abs(cx))*habitat.width*(.96+.025*Math.sin(phase));
  const rz=(clearance.z-Math.abs(cz))*habitat.depth*(.96+.025*Math.cos(phase));
  const amplitude=Math.min(habitat.wave,clearance.y*.36);
  const level=floor?-TANK_SIZE.height/2+(model.root.userData.floorOffsetMeters??0):MathUtils.clamp(habitat.level,-clearance.y+amplitude+.08,clearance.y-amplitude-.08);
  const points=Array.from({length:16},(_,i)=>{
    const a=i/16*Math.PI*2*reverse;
    return new Vector3(cx+Math.cos(a)*rx,level+Math.sin(a*2+phase)*amplitude,cz+Math.sin(a)*rz);
  });
  const curve=new CatmullRomCurve3(points,true,'centripetal');curve.arcLengthDivisions=512;
  const length=curve.getLength();let distance=MathUtils.euclideanModulo(options.start??(.14+index*.61803398875),1)*length;
  const position=new Vector3(),direction=new Vector3(),ahead=new Vector3(),rotation=new Euler(0,0,0,'YZX');
  function apply(){
    const u=distance/length;
    curve.getPointAt(u,position);curve.getTangentAt(u,direction).normalize();curve.getTangentAt((u+.006)%1,ahead);
    const bank=floor?0:MathUtils.clamp((direction.z*ahead.x-direction.x*ahead.z)*1.8,-.12,.12);
    rotation.set(bank,Math.atan2(direction.z,-direction.x),-Math.asin(MathUtils.clamp(direction.y,-1,1)),'YZX');
    model.root.position.copy(position);model.root.rotation.copy(rotation);
  }
  model.setMotionOwner('path');apply();
  return {curve,length,radius,envelope,envelopeCenter,habitat,update(dt:number,blend:number){
    const state=model.getState();
    if(state.disposed||state.lifeState!=='alive'||state.motionOwner!=='path'||!Number.isFinite(dt)||dt<=0)return;
    distance=MathUtils.euclideanModulo(distance+Math.min(dt,.1)*MathUtils.lerp(speed.slow,speed.fast,blend),length);apply();
  }};
}
