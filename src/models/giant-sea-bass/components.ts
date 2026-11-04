import { Color, MathUtils, Mesh } from 'three';
import type { MeshToonMaterial } from 'three';
import type { ModelAssembly } from '../shared/assembly';
import type { BodyPaint, FishDesign, Outline } from '../shared/fish/design';
import { addFishFin } from '../shared/fish/fins';
import { bellyAt, flankAt } from '../shared/fish/geometry';
import { countershade } from '../shared/fish/paint';

/** Seeded soft pigment patches are baked into body colors, with zero overlay geometry. */
export function seaBassPaint(random:()=>number):BodyPaint{
  const back=new Color('#4a5d60'),shoulder=new Color('#6c7e7f'),flank=new Color('#9aaba5'),belly=new Color('#c8c8b3');
  const warm=new Color('#909386'),spotColor=new Color('#3c4d4f'),pigment=random();
  const layout=[[-.22,.48],[-.14,-.18],[-.06,.69],[.025,.25],[.085,-.38],[.16,.57],[.22,-.02],[.29,.31]];
  const spots=[-1,1].flatMap(side=>layout.map(([x,h])=>({side,x:x+(random()-.5)*.05,h:h+(random()-.5)*.25,rx:.035+random()*.021,rh:.21+random()*.17})));
  return (x,h,side,out)=>{
    countershade(out,h,back,shoulder,flank,belly);out.lerp(warm,.04+pigment*.06);
    out.multiplyScalar(1+.025*Math.sin(x*43+h*13+side*2)*Math.sin(x*23-h*7));
    let ink=0;
    for(const spot of spots)if(Math.sign(side)===spot.side){
      const radius=((x-spot.x)/spot.rx)**2+((h-spot.h)/spot.rh)**2;
      ink=Math.max(ink,1-MathUtils.smoothstep(radius,.18,1.45));
    }
    out.lerp(spotColor,ink*.45);
  };
}

export function buildSeaBassFins(a:ModelAssembly,d:FishDesign,material:MeshToonMaterial,length:number){
  const upper=(x:number)=>bellyAt(d.profile,x,0,1)-.01;
  const lower=(x:number,z=0)=>bellyAt(d.profile,x,z)+.012;
  const spines:[number,number][]=[[-.255,upper(-.255)]];
  for(let i=0;i<7;i++){
    const x=-.245+i*.038,tip=.009+Math.sin((i+1)/8*Math.PI)*.016;
    spines.push([x,upper(x)+tip],[x+.022,upper(x+.022)+.012]);
  }
  spines.push([.025,upper(.025)],[-.07,upper(-.07)],[-.16,upper(-.16)]);
  addFishFin(a,'spiny-dorsal',spines,material,'#626b63',length,{dorsalBase:.17});
  addFishFin(a,'soft-dorsal',[[.025,upper(.025)],[.13,.218],[.20,.22],[.25,.202],[.30,.135],[.34,upper(.34)],[.24,upper(.24)],[.13,upper(.13)]],material,'#526361',length);
  addFishFin(a,'tail',[[.37,.030],[.43,.091],[.493,.137],[.50,.118],[.466,-.005],[.50,-.126],[.483,-.143],[.43,-.094],[.37,-.041]],material,'#526360',length,{depth:.006});
  addFishFin(a,'anal',[[.10,lower(.10)],[.16,-.152],[.27,-.18],[.295,-.12],[.32,lower(.32)],[.23,lower(.23)],[.16,lower(.16)]],material,'#5c6c67',length);
  for(const side of [-1,1]){
    const [x,y]=d.pectoral,z=flankAt(d.profile,x,y,side)-side*.009;
    const outline:Outline=[[x-.012,y+.018],[x+.075,y+.045],[x+.17,y+.041],[x+.195,y+.014],[x+.17,y-.029],[x+.08,y-.057],[x+.012,y-.025],[x-.01,y-.020]];
    addFishFin(a,`pectoral-${side}`,outline,material,'#596b65',length,{z,depth:.006,bone:side===1?4:5});
    // Leave the buried root on the body, feathering into the fan's hinge.
    const geometry=(a.parts.get(`pectoral-${side}`)!.children[0] as Mesh).geometry;
    const p=geometry.attributes.position,indices=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;
    for(let i=0;i<p.count;i++){
      const t=MathUtils.smoothstep(Math.hypot(p.getX(i)/length-x,p.getY(i)/length-y),.028,.09);
      indices.setXYZW(i,0,side===1?4:5,0,0);weights.setXYZW(i,1-t,t,0,0);
    }
    const pz=side*.049;
    addFishFin(a,`pelvic-${side}`,[[-.20,lower(-.20,pz)],[-.17,-.188],[-.10,-.197],[-.06,-.16],[-.07,lower(-.07,pz)],[-.14,lower(-.14,pz)]],material,'#78877a',length,{z:pz});
  }
}
