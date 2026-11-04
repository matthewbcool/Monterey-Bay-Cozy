import { Color, ExtrudeGeometry, Float32BufferAttribute, MathUtils, Shape } from 'three';
import type { MeshToonMaterial } from 'three';
import type { ModelAssembly } from '../assembly';
import type { Outline } from './design';
import { skinGeometry, solidColor } from './geometry';

/** Shapes are authored in full-fish coordinates so their seams can follow the body. */
export function addFishFin(assembly: ModelAssembly, name: string, outline: Outline, material: MeshToonMaterial, color: string, length: number, options: { z?: number; bone?: number; dorsalBase?: number; depth?: number } = {}) {
  const shape = new Shape();
  // Round broad membrane corners, retaining roots, length extrema, pointed tips and dorsal spines.
  const painted=material.userData.paintedFish===true;
  const rounded=painted&&(name.startsWith('pectoral')||name==='tail'||name==='anal'||name==='soft-dorsal');
  const minX=Math.min(...outline.map(p=>p[0])),maxX=Math.max(...outline.map(p=>p[0]));
  shape.moveTo(...outline[0]);
  for(let i=1;i<outline.length;i++){
    const p=outline[i],a=outline[i-1],b=outline[(i+1)%outline.length];
    const ax=p[0]-a[0],ay=p[1]-a[1],bx=b[0]-p[0],by=b[1]-p[1];
    const turn=(ax*bx+ay*by)/(Math.hypot(ax,ay)*Math.hypot(bx,by)||1);
    if(!rounded||i===outline.length-1||p[0]===minX||p[0]===maxX||turn<-.3){shape.lineTo(...p);continue;}
    const k=.16;
    shape.lineTo(p[0]-ax*k,p[1]-ay*k);shape.quadraticCurveTo(...p,p[0]+bx*k,p[1]+by*k);
  }
  shape.closePath();
  const depth = options.depth ?? .004;
  const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 2 }).translate(0, 0, (options.z ?? 0) - depth / 2);
  solidColor(geometry, color);
  const positions=geometry.attributes.position,colors=geometry.attributes.color;
  const root=outline[0],span=Math.max(...outline.map(p=>Math.hypot(p[0]-root[0],p[1]-root[1])));
  const base=new Color(color),edge=base.clone().lerp(new Color('#b8ccc0'),.22),paint=new Color();
  for(let i=0;painted&&i<positions.count;i++){
    const reach=MathUtils.clamp(Math.hypot(positions.getX(i)-root[0],positions.getY(i)-root[1])/(span||1),0,1);
    paint.copy(base).lerp(edge,reach*reach);colors.setXYZ(i,paint.r,paint.g,paint.b);
  }
  geometry.setAttribute('fishMatte',new Float32BufferAttribute(new Float32Array(positions.count).fill(painted?1:0),1));
  skinGeometry(geometry, options.bone, options.dorsalBase);
  geometry.scale(length, length, length);
  assembly.addMesh(assembly.addPart(name), geometry, material);
}
