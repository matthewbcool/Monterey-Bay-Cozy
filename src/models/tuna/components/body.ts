import { Color, Float32BufferAttribute, LatheGeometry, MathUtils, Vector2 } from 'three';
import type { ModelAssembly } from '../../shared/assembly';
import { TUNA_GEOMETRY } from '../definition';
import { PALETTE, type TunaMaterials } from '../materials';
import { profileAt } from '../profile';

/** Continuous low-poly body, with blue/silver countershading stored in vertex colors. */
export function buildTunaBody(assembly: ModelAssembly, materials: TunaMaterials) {
  const { longitudinalSegments, radialSegments } = TUNA_GEOMETRY.body;
  const points: Vector2[] = [];
  for (let i = 0; i <= longitudinalSegments; i++) {
    const x = MathUtils.lerp(-3.15, 2.88, i / longitudinalSegments);
    points.push(new Vector2(i === 0 || i === longitudinalSegments ? 0 : profileAt(x).ry, x));
  }
  const geometry = new LatheGeometry(points, radialSegments).rotateZ(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  const colors: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const profile = profileAt(positions.getX(i));
    positions.setY(i, positions.getY(i) + profile.y);
    positions.setZ(i, positions.getZ(i) * profile.rz / profile.ry);
    const height = (positions.getY(i) - profile.y) / profile.ry;
    const color = new Color();
    if (height > .55) color.copy(PALETTE.back).lerp(PALETTE.shoulder, Math.max(0, (1 - height) / .45));
    else if (height > .03) color.copy(PALETTE.shoulder).lerp(PALETTE.flank, (.55 - height) / .52);
    else color.copy(PALETTE.flank).lerp(PALETTE.belly, Math.min(1, -height / .68));
    colors.push(color.r, color.g, color.b);
  }
  geometry.computeVertexNormals();
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  assembly.addMesh(assembly.addPart('body'), geometry, materials.skin);
}
