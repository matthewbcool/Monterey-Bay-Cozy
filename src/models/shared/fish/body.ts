import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import type { MeshToonMaterial } from 'three';
import type { ModelAssembly } from '../assembly';
import type { BodyPaint, FishDesign } from './design';
import { sectionAt, skinGeometry } from './geometry';

export function buildFishBody(assembly: ModelAssembly, design: Pick<FishDesign, 'segments' | 'profile'>, material: MeshToonMaterial, paint: BodyPaint, length: number, bone?: number) {
  const [rings, sides] = design.segments;
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const color = new Color(), start = design.profile[0][0], end = design.profile.at(-1)![0];
  for (let i = 0; i <= rings; i++) {
    const x = start + (end - start) * i / rings, p = sectionAt(design.profile, x);
    for (let j = 0; j <= sides; j++) {
      const theta = j / sides * Math.PI * 2, height = Math.cos(theta), side = Math.sin(theta);
      positions.push(x, p.y + p.depth * height, p.width * side);
      paint(x, height, side, color); colors.push(color.r, color.g, color.b);
      if (i < rings && j < sides) {
        const a = i * (sides + 1) + j, b = a + sides + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  // Close the body at both ends so oblique/rear views never expose an open tube.
  for (const ring of [0, rings]) {
    const x = ring === 0 ? start : end, p = sectionAt(design.profile, x), center = positions.length / 3;
    positions.push(x, p.y, 0); paint(x, 0, 0, color); colors.push(color.r, color.g, color.b);
    for (let j = 0; j < sides; j++) {
      const base = ring * (sides + 1) + j;
      if (ring === 0) indices.push(center, base + 1, base); else indices.push(center, base, base + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const normals=geometry.attributes.normal;
  for(let i=0;i<=rings;i++){
    const first=i*(sides+1),last=first+sides;
    const x=normals.getX(first)+normals.getX(last),y=normals.getY(first)+normals.getY(last),z=normals.getZ(first)+normals.getZ(last),m=Math.hypot(x,y,z)||1;
    normals.setXYZ(first,x/m,y/m,z/m);normals.setXYZ(last,x/m,y/m,z/m);
  }
  skinGeometry(geometry, bone); geometry.scale(length, length, length);
  assembly.addMesh(assembly.addPart('body'), geometry, material);
}
