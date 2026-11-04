import { BufferGeometry, CircleGeometry, CylinderGeometry, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { solidColor } from '../../shared/fish/geometry';

/** Seeded density and hues, with buried spine roots. +Y faces away from the attachment surface. */
export function buildUrchinGeometry(diameter: number, seed: number) {
  let state = seed || 1;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 2 ** 32; };
  const radius = diameter / 2, center = radius * .69, pieces: BufferGeometry[] = [];
  function add(geometry: BufferGeometry, color: string) { geometry.deleteAttribute('uv'); solidColor(geometry, color); pieces.push(geometry); }
  add(new SphereGeometry(radius, 16, 8).scale(1, .64, 1).translate(0, center, 0), '#45324f');
  const axis = new Vector3(0, 1, 0), direction = new Vector3(), start = new Vector3(), rotation = new Quaternion();
  const count = 144;
  for (let i = 0; i < count; i++) {
    const y = -.30 + 1.30 * (i + .5) / count, a = i * 2.3999632297 + (random() - .5) * .18;
    const horizontal = Math.sqrt(1 - y * y);
    start.set(Math.cos(a) * horizontal * radius * .97, center + y * radius * .64 * .97, Math.sin(a) * horizontal * radius * .97);
    direction.set(Math.cos(a) * horizontal, y / .64, Math.sin(a) * horizontal).normalize();
    const length = radius * (.40 + random() * .22), baseRadius = radius * (.045 + random() * .012);
    // Tapered, blunt tips from the photos; no needle-sharp starburst or specular glints.
    const spine = new CylinderGeometry(baseRadius * .42, baseRadius, length, 4, 1, true);
    rotation.setFromUnitVectors(axis, direction); spine.applyQuaternion(rotation);
    spine.translate(start.x + direction.x * length / 2, start.y + direction.y * length / 2, start.z + direction.z * length / 2);
    add(spine, ['#77528d', '#89609e', '#69417d', '#a485b5'][i % 4]);
  }
  // Sparse visible tube feet; thousands of microstructures are deliberately omitted.
  for (let i = 0; i < 20; i++) {
    const a = i * Math.PI * 2 / 20, r = radius * .78;
    const foot = new CylinderGeometry(radius * .010, radius * .014, radius * .31, 3, 1);
    foot.translate(Math.cos(a) * r, radius * .155, Math.sin(a) * r); add(foot, '#a68d85');
  }
  for (let i = 0; i < 16; i++) {
    const a = i * 2.3999632297, y = .1 + random() * .65;
    direction.set(Math.cos(a), y, Math.sin(a)).normalize();
    start.set(direction.x * radius * .96, center + direction.y * radius * .61, direction.z * radius * .96);
    const length = radius * .60, foot = new CylinderGeometry(radius * .008, radius * .012, length, 3, 1);
    foot.applyQuaternion(rotation.setFromUnitVectors(axis, direction)); foot.translate(start.x + direction.x * length / 2, start.y + direction.y * length / 2, start.z + direction.z * length / 2); add(foot, '#a18b87');
  }
  add(new CircleGeometry(radius * .20, 10).rotateX(Math.PI / 2).translate(0, radius * .045, 0), '#32283d');
  const geometry = mergeGeometries(pieces)!; pieces.forEach(g => g.dispose()); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
