import { Group, Vector3 } from 'three';
import { box, mat } from '../../models/props/primitives';
import { finishStaticAsset } from '../../models/shared/staticAsset';
import { touchesFootprint, type GymCollider, type GymPoint } from '../avatarController';
import { segmentCollider } from './parkFurniture';

export const POOL_GATE_SIZE={width:1.65,height:1.15,thickness:.055} as const;
/** A single rigid batch; toggles only move the hinge and its matching collision footprint.
 * Instant motion also respects reduced motion. Closing/opening refuses an occupied sweep. */
export function createPoolGate(hinge:GymPoint,end:GymPoint,y:number){
  const root=new Group(),dark=mat('#334e49'),latch=mat('#b3b8a3'),{width,height,thickness}=POOL_GATE_SIZE;
  for(const x of [.03,width-.03])box(root,'Pool gate · upright',[thickness,height,thickness],dark,[x,height/2,0]);
  for(const yy of [.18,height-.07])box(root,'Pool gate · horizontal rail',[width,.045,thickness],dark,[width/2,yy,0]);
  for(let i=1;i<8;i++)box(root,'Pool gate · picket',[.022,height-.25,.022],dark,[width*i/8,(height+.11)/2,0]);
  box(root,'Pool gate · latch',[.14,.07,.11],latch,[width-.12,.85,.03]);
  finishStaticAsset(root,'lovers-point-pool-gate',[1,1,1],{rim:false});
  root.name='Lovers Point pool · opening gate';root.position.set(hinge[0],y,hinge[1]);
  const closedYaw=-Math.atan2(end[1]-hinge[1],end[0]-hinge[0]);
  let open=false;const angle=(isOpen:boolean)=>closedYaw+(isOpen?Math.PI/2:0);
  function footprint(yaw:number){return segmentCollider(hinge,[hinge[0]+Math.cos(yaw)*width,hinge[1]-Math.sin(yaw)*width],thickness,y+height);}
  const collider:Extract<GymCollider,{kind:'box'}>=footprint(closedYaw);root.rotation.y=closedYaw;
  const center=new Vector3((hinge[0]+end[0])/2,y,(hinge[1]+end[1])/2);
  return {root,collider,center,hinge,width,height,
    get open(){return open;},get label(){return open?'Close pool gate':'Open pool gate';},
    toggle(player:Vector3,radius=.28){
      if(Math.abs(player.y-y)<2)for(let i=0;i<=24;i++){
        const sweep=footprint(closedYaw+Math.PI/2*i/24);
        if(touchesFootprint(player.x,player.z,sweep.footprint!,radius+.06))return {changed:false,message:'Step clear of the gate so it can swing.'};
      }
      open=!open;root.rotation.y=angle(open);Object.assign(collider,footprint(angle(open)));
      return {changed:true,message:open?'Pool gate open. Walk onto the deck; the pool basin is display-only.':'Pool gate closed.'};
    },
  };
}
