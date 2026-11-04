import { Bone, MathUtils, Skeleton, Vector3 } from 'three';
import { OCTOPUS as O,armRadius } from './definition';
import { restPoint } from './arms';
import { crawlCycle,mantlePulse,smooth } from './motion';

/** Integrate a changing tangent, rather than shortening a rigid radial spoke.
 * Bone frames deform fixed buffers; scratch vectors are allocated once. */
export function createOctopusRig(span:number,seed:number){
 const body=new Bone();body.name='head';const mantle=new Bone();mantle.name='mantle';mantle.position.set(-.09,.108,0).multiplyScalar(span);body.add(mantle);
 const count=O.bonesPerArm;
 const arms=O.angles.map((_,i)=>Array.from({length:count},(_,j)=>{const b=new Bone();b.name=`arm-${i+1}-${j}`;restPoint(i,j/(count-1),span,b.position);body.add(b);return b;}));
 const skeleton=new Skeleton([body,mantle,...arms.flat()]);
 const restDirections=arms.map((_,i)=>Array.from({length:count},(_,j)=>{
  const u=j/(count-1);return restPoint(i,Math.min(1,u+.001),span).sub(restPoint(i,Math.max(0,u-.001),span)).normalize();
 }));
 const direction=new Vector3(),points=Array.from({length:count},()=>new Vector3());
 const cycle={reach:0,lift:0,curl:0};
 const seedPhase=(seed%4096)/4096;
 function pose(phase:number,blend:number,caught:boolean){
  const b=caught?0:blend,pulse=caught?0:mantlePulse(phase);
  mantle.scale.set(1+pulse*b*.045,1-pulse*(.018+b*.11),1-pulse*(.018+b*.10));
  for(let arm=0;arm<8;arm++){
   const angle=O.angles[arm],hand=angle<0?-1:1;
   crawlCycle(caught?0:phase,arm,seedPhase,cycle);const curl=caught?.65:cycle.curl;
   let x=O.headX+Math.cos(angle)*O.armBase,z=Math.sin(angle)*O.armBase;
   // The bend moves distally during a reach; other arms retain their own coils.
   const bendStart=.26+(caught?.1:.17*cycle.reach),turn=hand*(.75+4.1*curl);
   for(let j=0;j<count;j++){
    const u=j/(count-1);
    if(j){
     const du=1/(count-1)/4;
     // Midpoint quadrature approximates constant arm length along the curl.
     for(let k=0;k<4;k++){
      const s=(j-1)/(count-1)+(k+.5)*du;
      const yaw=angle+turn*smooth((s-bendStart)/(1-bendStart));
      x+=Math.cos(yaw)*O.armLength*du;z+=Math.sin(yaw)*O.armLength*du;
     }
    }
    const reach=caught?0:(cycle.reach-.5)*.075*smooth((u-.2)/.8);
    const sy=armRadius(u)+.013+(caught?0:cycle.lift*.055*Math.sin(Math.PI*u*.9)**2);
    // A soft trailing bundle, curved at its roots and with delayed terminal hooks.
    const rootX=O.headX+Math.cos(angle)*O.armBase,rootZ=Math.sin(angle)*O.armBase;
    const hook=smooth((u-.7)/.3),delay=phase-u*2.2+arm*.61;
    const jx=rootX+O.armLength*u-.035*hook*(.5+.5*Math.sin(delay));
    const jz=rootZ*Math.exp(-u*2)+Math.sin(angle)*.052*u+.014*Math.sin(delay)*u*u;
    const jy=.050+armRadius(u)*.4+.018*Math.sin(angle*2)*u+.022*Math.sin(delay)*u*u+.025*hook;
    points[j].set(MathUtils.lerp(x+reach,jx,b),MathUtils.lerp(sy,jy,b),MathUtils.lerp(z,jz,b)).multiplyScalar(span);
   }
   for(let j=0;j<count;j++){
    const bone=arms[arm][j];bone.position.copy(points[j]);
    direction.subVectors(points[Math.min(count-1,j+1)],points[Math.max(0,j-1)]).normalize();
    bone.quaternion.setFromUnitVectors(restDirections[arm][j],direction);
   }
  }
 }
 return {body,skeleton,arms,mantle,pose};
}
