import { Group, Vector3 } from 'three';
import habitats from '../../data/deer-habitats.json';
import { createDeer, type DeerModel } from '../../models/habitat/deer/createDeer';
import { createDeerHerd } from './deerBehavior';
import { canStandAt, type GymCollider, type GymPoint } from '../avatarController';

/** Source-backed home patches; grass outlines come from cached OSM. The small
 * roam circles and family counts are authored gameplay, never animal sightings. */
export const DEER_SITES = habitats.sites;
export interface GymDeerWorld {
  floorAt(x:number,z:number):number;
  waterAt(x:number,z:number):number|undefined;
  colliders:readonly GymCollider[];
}
export const DEER_INTEREST = { enterMeters:110, exitMeters:140 } as const;

export function createGymDeer(world:GymDeerWorld) {
  const root=new Group();root.name='Coastal deer families';
  let disposed=false,updates=0;
  const localUp=new Vector3(0,1,0),normal=new Vector3();
  function alignTerrain(model:DeerModel){
    const {x,z}=model.root.position,yaw=model.root.rotation.y,c=Math.cos(yaw)*.5,s=Math.sin(yaw)*.5;
    // One metre central differences in the root's local X/Z directions. Only
    // the visual skin tilts: root heading, feet anchor and collision stay owned
    // by the movement controller. The rigid rotation also preserves LOD bounds.
    const slopeX=world.floorAt(x+c,z-s)-world.floorAt(x-c,z+s);
    const slopeZ=world.floorAt(x+s,z+c)-world.floorAt(x-s,z-c);
    if(Number.isFinite(slopeX)&&Number.isFinite(slopeZ)){
      normal.set(-slopeX,1,-slopeZ).normalize();model.mesh.quaternion.setFromUnitVectors(localUp,normal);
    }
  }
  const groups=DEER_SITES.map((site,index)=>{
    const [hx,hz]=site.home, r=site.roamRadiusM;
    const bounds={minX:hx-r,maxX:hx+r,minZ:hz-r,maxZ:hz+r,walkable:site.boundaryPoints.map(p=>[p[0],p[1]] as GymPoint)};
    // Broad phase once, not a scan of every park collider at every hoof step.
    const colliders=world.colliders.filter(c=>c.kind==='circle'
      ?c.x+c.radius>=bounds.minX&&c.x-c.radius<=bounds.maxX&&c.z+c.radius>=bounds.minZ&&c.z-c.radius<=bounds.maxZ
      :c.maxX>=bounds.minX&&c.minX<=bounds.maxX&&c.maxZ>=bounds.minZ&&c.minZ<=bounds.maxZ);
    const safe=(x:number,z:number,radius:number)=>Math.hypot(x-hx,z-hz)+radius<=r
      &&world.waterAt(x,z)===undefined&&canStandAt(x,z,bounds,colliders,radius);
    // Radius includes the longitudinal body extent even while turning. It is
    // deliberately separate from rendered LOD and the future narrow body capsule.
    const radii=[.92,.58],positions:Vector3[]=[];
    for(let member=0;member<2;member++){
      let found:Vector3|undefined;
      for(let ring=0;ring<=12&&!found;ring++)for(let angle=0;angle<16;angle++){
        const a=angle*Math.PI/8+index, distance=ring*.3;
        const x=hx+Math.sin(a)*distance,z=hz+Math.cos(a)*distance;
        if(safe(x,z,radii[member])&&positions.every(p=>Math.hypot(p.x-x,p.z-z)>1.9)){
          found=new Vector3(x,world.floorAt(x,z),z);break;
        }
      }
      if(!found)throw new Error(`No safe deer family placement at ${site.id}`);
      positions.push(found);
    }
    const herd=createDeerHerd({seed:891+index*97,bounds,world:{heightAt:world.floorAt,canStandAt:safe,isWater:(x,z)=>world.waterAt(x,z)!==undefined},
      members:positions.map((p,i)=>({id:site.id+(i?'-fawn':'-doe'),age:i?'fawn':'adult',x:p.x,z:p.z,yaw:-.65,radius:radii[i]}))});
    const cell=new Group();cell.name=site.name+' · deer';cell.visible=false;root.add(cell);
    const models=herd.members.map((member,i)=>{const model=createDeer({variant:member.age,seed:104+i+index*31,pose:'eat'});model.root.name=member.id;model.root.position.set(member.x,member.y,member.z);model.root.rotation.y=member.yaw;alignTerrain(model);cell.add(model.root);return model;});
    herd.setActive(false);
    return {site,cell,herd,models,bounds,canStandAt:safe};
  });
  function setViewer(x:number,z:number,enabled=true){
    if(disposed)return;
    for(const group of groups){
      const radius=group.herd.active?DEER_INTEREST.exitMeters:DEER_INTEREST.enterMeters;
      const active=enabled&&Number.isFinite(x)&&Number.isFinite(z)&&Math.hypot(x-group.site.home[0],z-group.site.home[1])<radius;
      group.cell.visible=active;group.herd.setActive(active);
    }
  }
  function setPlayer(x:number,y:number,z:number,enabled=true){for(const group of groups)group.herd.setPlayer(x,y,z,enabled);}
  function update(dt:number,motionEnabled=true){
    if(disposed)return;
    for(const group of groups){
      const previousTime=group.herd.elapsed;
      if(!group.herd.update(dt,motionEnabled))continue;
      const elapsed=group.herd.elapsed-previousTime;
      updates++;
      for(let i=0;i<group.models.length;i++){
        const model=group.models[i],member=group.herd.members[i];
        model.root.position.set(member.x,member.y,member.z);model.root.rotation.y=member.yaw;
        alignTerrain(model);
        // A frozen ambient herd returns above. Required avoidance still articulates.
        model.update(elapsed,{pose:member.pose,speed:member.speed,gaitBlend:member.gaitBlend});
      }
    }
  }
  function stats(){return {count:groups.length*2,active:groups.filter(g=>g.herd.active).length*2,updates,
    groups:groups.map(g=>({id:g.site.id,name:g.site.name,active:g.herd.active,phase:g.herd.phase,steps:g.herd.steps,alerts:g.herd.alerts,
      members:g.herd.members.map(m=>({id:m.id,variant:m.age,position:[m.x,m.y,m.z],yaw:m.yaw,pose:m.pose,speed:m.speed}))}))};}
  return {root,groups,setViewer,setPlayer,update,stats,
    dispose(){if(disposed)return;disposed=true;for(const group of groups){group.herd.setActive(false);for(const model of group.models)model.dispose();}root.clear();root.removeFromParent();}};
}
