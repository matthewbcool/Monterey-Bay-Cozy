import { BoxGeometry, CatmullRomCurve3, CircleGeometry, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import type { BufferGeometry, MeshToonMaterial } from 'three';
import type { ModelAssembly } from '../assembly';
import type { FishDesign } from './design';
import { flankAt, sectionAt, skinGeometry, solidColor } from './geometry';

export function buildFishEyes(assembly: ModelAssembly, design: Pick<FishDesign, 'eye' | 'profile'>, material: MeshToonMaterial, length: number, rim: string) {
  const live = assembly.addPart('eyes'), caught = assembly.addPart('eyes-caught');
  const [eyeX, eyeY, radius] = design.eye, ink = '#10262f';
  function add(group: typeof live, geometry: BufferGeometry, color: string, label: string) {
    solidColor(geometry, color); skinGeometry(geometry, 0); geometry.scale(length, length, length);
    assembly.addMesh(group, geometry, material, label);
  }
  for (const side of [-1, 1]) {
    const name = side === 1 ? 'near' : 'far', z = flankAt(design.profile, eyeX, eyeY, side);
    add(live, new SphereGeometry(1, 10, material.userData.paintedFish ? 5 : 6).scale(radius, radius, radius * .4).translate(eyeX, eyeY, z), rim, name + '-eye');
    add(live, new SphereGeometry(1, 8, material.userData.paintedFish ? 3 : 4).scale(radius * .72, radius * .72, radius * .2).translate(eyeX, eyeY, z + side * radius * .31), ink, name + '-pupil');
    add(live, new CircleGeometry(radius * .22, 6).rotateY(side < 0 ? Math.PI : 0).translate(eyeX - radius * .21, eyeY + radius * .27, z + side * radius * .54), '#e9f1dc', name + '-glint');
    for (const sign of [-1, 1]) add(caught, new BoxGeometry(radius * 2.25, radius * .32, radius * .24).rotateZ(sign * Math.PI / 4).translate(eyeX, eyeY, z + side * radius * .32), ink, `${name}-x-${sign}`);
  }
}

export function buildFishFace(assembly: ModelAssembly, design: FishDesign, material: MeshToonMaterial, length: number, rim: string) {
  buildFishEyes(assembly, design, material, length, rim);
  const marks = assembly.addPart('face-marks'), ink = '#10262f';
  function add(geometry: BufferGeometry, label: string) {
    solidColor(geometry, ink); skinGeometry(geometry, 0); geometry.scale(length, length, length);
    assembly.addMesh(marks, geometry, material, label);
  }
  for (const side of [-1, 1]) {
    const name = side === 1 ? 'near' : 'far';
    const gx = design.gillX, p = sectionAt(design.profile, gx);
    const line = [[gx - .035, p.y + p.depth * .69], [gx + .005, p.y + p.depth * .20], [gx + .018, p.y - p.depth * .24], [gx - .03, p.y - p.depth * .69]];
    const curve = new CatmullRomCurve3(line.map(([x, y]) => new Vector3(x, y, flankAt(design.profile, x, y, side))));
    add(new TubeGeometry(curve, 10, .0013, 3, false), name + '-gill');
    const mouth = [[-.496, -.004], [-.467, -.012], [-.424, -.008]].map(([x, y]) => new Vector3(x, y, flankAt(design.profile, x, y, side)));
    add(new TubeGeometry(new CatmullRomCurve3(mouth), 5, .0015, 3, false), name + '-mouth');
  }
}
