import { BoxGeometry, CatmullRomCurve3, Group, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import type { ModelAssembly } from '../../shared/assembly';
import type { TunaMaterials } from '../materials';
import { faceSurface } from '../profile';

/** Small face variants share the body: normal eyes or surface-fitted X marks. */
export function buildTunaFace(assembly: ModelAssembly, materials: TunaMaterials) {
  const { addPart, addMesh } = assembly;
  const eyes = addPart('eyes');
  for (const side of [-1, 1]) {
    const name = side === 1 ? 'near' : 'far';
    const rim = addMesh(eyes, new SphereGeometry(.113, 10, 8), materials.eyeRim, `${name}-rim`);
    rim.position.set(-2.27, -.02, side * .434);
    rim.scale.set(1, .96, .45);
    const eye = addMesh(eyes, new SphereGeometry(.102, 10, 8), materials.dark, `${name}-eye`);
    eye.position.set(-2.27, -.02, side * .443);
    eye.scale.set(.79, .79, .60);
    const glint = addMesh(eyes, new SphereGeometry(.024, 6, 4), materials.eyeRim, `${name}-glint`);
    glint.position.set(-2.293, .01, side * .492);
    glint.scale.z = .38;
  }

  const caughtEyes = addPart('eyes-caught');
  for (const side of [-1, 1]) for (const angle of [-Math.PI / 4, Math.PI / 4]) {
    const geometry = new BoxGeometry(.37, .055, .022).rotateZ(angle).translate(-2.27, -.02, 0);
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const surface = faceSurface(positions.getX(i), positions.getY(i), side);
      positions.setZ(i, side * (Math.abs(surface.z) + .009 + positions.getZ(i)));
    }
    if (side < 0) {
      // Reflection reverses winding: restore outward-facing triangles on the far eye.
      const index = geometry.getIndex()!;
      for (let i = 0; i < index.count; i += 3) {
        const first = index.getX(i);
        index.setX(i, index.getX(i + 2));
        index.setX(i + 2, first);
      }
    }
    geometry.computeVertexNormals();
    addMesh(caughtEyes, geometry, materials.dark, 'cross');
  }

  function contour(part: Group, points: Vector3[], radius: number) {
    const curve = new CatmullRomCurve3(points);
    const sampled = curve.getPoints(64).map(point => faceSurface(point.x, point.y, Math.sign(point.z)));
    addMesh(part, new TubeGeometry(new CatmullRomCurve3(sampled), 20, radius, 3, false), materials.dark);
  }
  const gills = addPart('gills');
  const mouth = addPart('mouth');
  for (const side of [-1, 1]) {
    contour(gills, [faceSurface(-1.66, .68, side), faceSurface(-1.53, .39, side), faceSurface(-1.37, -.03, side), faceSurface(-1.48, -.38, side), faceSurface(-1.80, -.67, side)], .011);
    contour(mouth, [faceSurface(-3.14, -.048, side), faceSurface(-2.94, -.093, side), faceSurface(-2.73, -.135, side), faceSurface(-2.60, -.13, side)], .013);
  }
  assembly.duplicatePart('gills', 'caught-gills');
  assembly.duplicatePart('mouth', 'caught-mouth');
}
