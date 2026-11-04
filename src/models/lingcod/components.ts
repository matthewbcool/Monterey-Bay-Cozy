import { countershade } from '../shared/fish/paint';
import { Color, ConeGeometry } from 'three';
import type { MeshToonMaterial } from 'three';
import type { ModelAssembly } from '../shared/assembly';
import type { BodyPaint } from '../shared/fish/design';
import { addFishFin } from '../shared/fish/fins';
import { bellyAt, flankAt, skinGeometry, solidColor } from '../shared/fish/geometry';
import { LINGCOD as L } from './definition';

const olive = new Color('#707664'), cream = new Color('#b7baa0'), dark = new Color('#394e48');
const shoulder=dark.clone().lerp(olive,.7);
export const paintLingcod: BodyPaint = (x, h, side, out) => {
  countershade(out,h,dark,shoulder,olive,cream);
  const cloud = Math.sin(x*34 + h*6 + Math.sin(x*13))*Math.cos(h*9 + side*1.7);
  if(h > -.65) out.lerp(dark, Math.max(0,cloud)*.50);
};
export function buildLingcodFins(a: ModelAssembly, material: MeshToonMaterial, length: number) {
  const upper = (x: number) => bellyAt(L.profile,x,0,1)-.012;
  const lower = (x: number,z=0) => bellyAt(L.profile,x,z)+.012;
  const dorsal: [number,number][] = [[-.27,upper(-.27)]];
  for(let i=0;i<9;i++) {
    const x=-.26+i*.03;
    dorsal.push([x,upper(x)+.058],[x+.018,upper(x+.018)+.036]);
  }
  dorsal.push([.025,upper(.025)],[0,upper(0)],[-.10,upper(-.10)],[-.20,upper(-.20)]);
  addFishFin(a,'spiny-dorsal',dorsal,material,'#67755c',length,{dorsalBase:.106});
  addFishFin(a,'soft-dorsal',[[.02,upper(.02)],[.065,.135],[.17,.133],[.28,.104],[.355,.049],[.36,upper(.36)],[.23,upper(.23)],[.12,upper(.12)]],material,'#75836c',length);
  addFishFin(a,'tail',[[.366,.031],[.466,.080],[.494,.062],[.50,.013],[.496,-.039],[.475,-.064],[.366,-.021]],material,'#697d68',length);
  addFishFin(a,'anal',[[.03,lower(.03)],[.10,-.132],[.24,-.109],[.35,lower(.35)],[.22,lower(.22)],[.12,lower(.12)]],material,'#8e9678',length);
  for(const side of [-1,1]) {
    const [x,y]=L.pectoral, z=flankAt(L.profile,x,y,side)-side*.006;
    addFishFin(a,`pectoral-${side}`,[[x-.015,y+.025],[x+.10,y+.006],[x+.20,y-.055],[x+.19,y-.111],[x+.14,y-.144],[x+.07,y-.130],[x,y-.024]],material,'#929976',length,{z,bone:side===1?4:5,depth:.007});
    const pz=side*.040;
    addFishFin(a,`pelvic-${side}`,[[-.26,lower(-.26,pz)],[-.18,-.145],[-.10,-.123],[-.15,lower(-.15,pz)]],material,'#b1b38f',length,{z:pz});
  }
}
/** Four visible fangs suggest the toothy jaw without a separate mesh per tooth at runtime. */
export function buildLingcodTeeth(a: ModelAssembly, material: MeshToonMaterial, length: number) {
  const group=a.addPart('fangs');
  for(const side of [-1,1]) for(const x of [-.475,-.445]) {
    const y=-.013,z=flankAt(L.profile,x,y,side);
    const tooth=new ConeGeometry(.004,.017,4).translate(x,y,z);
    solidColor(tooth,'#dedbc0'); skinGeometry(tooth,0); tooth.scale(length,length,length);
    a.addMesh(group,tooth,material,`fang-${side}-${x}`);
  }
}
