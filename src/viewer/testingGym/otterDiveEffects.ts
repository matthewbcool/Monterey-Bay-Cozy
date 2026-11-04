import { DynamicDrawUsage, InstancedMesh, Matrix4, SphereGeometry, Quaternion, Vector3 } from 'three';
import type { createAvatarModel } from '../../models/avatar';
import { OTTER_JETS } from '../../models/avatar/geometry';
import { createToonMaterial } from '../../models/shared/style';
import { applyNodeStyle, type NodeStyleEnvironment } from '../nodeStyle';

/** A fixed pool: one instanced draw, 864 triangles, no image texture, no particle allocation. */
export const OTTER_BUBBLES={count:24,triangles:864,draws:1,seed:6256} as const;
export function createOtterDiveEffects(environment:NodeStyleEnvironment){
  const geometry=new SphereGeometry(1,6,4),material=createToonMaterial({color:'#b5e3de',name:'otter:bubbles',rim:true});
  const mesh=new InstancedMesh(geometry,material,OTTER_BUBBLES.count);mesh.name='Otter Man · underwater booster bubbles';
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);mesh.frustumCulled=false;mesh.visible=false;
  applyNodeStyle(mesh,true,environment);
  const positions=Array.from({length:OTTER_BUBBLES.count},()=>new Vector3()),ages=new Float32Array(OTTER_BUBBLES.count).fill(99);
  const matrix=new Matrix4(),rotation=new Quaternion(),scale=new Vector3(),point=new Vector3();
  const joints=Object.values(OTTER_JETS);let next=0,clock=0,visible=0;
  function update(dt:number,avatar:ReturnType<typeof createAvatarModel>,equipped:boolean,submerged:boolean,boosting:boolean,reduced:boolean,water:number){
    const lamp=environment.headlamp;lamp.strength.value=equipped&&submerged?1.8:0;
    if(equipped){
      avatar.root.updateMatrixWorld(true);
      const head=avatar.anchors.head;
      head.localToWorld(point.set(0,.30*avatar.dimensions.heightScale,.25*avatar.dimensions.heightScale));lamp.position.value.copy(point);
      lamp.direction.value.set(0,-.22,1).transformDirection(head.matrixWorld);
    }
    if(!equipped){ages.fill(99);mesh.visible=false;visible=0;clock=0;return;}
    if(submerged){clock+=dt;const interval=reduced?.25:boosting?.035:.075;
      while(clock>=interval){clock-=interval;const joint=avatar.bones[joints[next%4]];
        positions[next].setFromMatrixPosition(joint.matrixWorld);ages[next]=0;next=(next+1)%ages.length;
      }
    }else clock=0;
    visible=0;
    for(let i=0;i<ages.length;i++){
      ages[i]+=dt;const p=positions[i];
      if(ages[i]<1.8&&p.y<water-.025){
        if(!reduced){p.y+=dt*(.65+(i%3)*.12);p.x+=Math.sin(i*2.4+OTTER_BUBBLES.seed)*dt*.08;p.z+=Math.cos(i*1.7+OTTER_BUBBLES.seed)*dt*.08;}
        const size=(.025+(i%4)*.007)*(1+ages[i]*.7);scale.setScalar(size);matrix.compose(p,rotation,scale);mesh.setMatrixAt(visible++,matrix);
      }
    }
    mesh.count=visible;mesh.visible=visible>0;mesh.instanceMatrix.needsUpdate=true;
  }
  return {mesh,update,getState:()=>({activeBubbles:visible,headlamp:environment.headlamp.strength.value>0,budget:OTTER_BUBBLES}),
    dispose(){environment.headlamp.strength.value=0;mesh.removeFromParent();mesh.dispose();geometry.dispose();if(!Array.isArray(mesh.material))mesh.material.dispose();}};
}
