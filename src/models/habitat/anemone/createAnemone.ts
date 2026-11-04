import { BufferGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createToonMaterial } from '../../shared/style';
import { ANEMONES, ANEMONE_BUDGET, ANEMONE_BED_BUDGET, type AnemoneSpecies } from './definition';
import { buildGiantGreenGeometry } from './giantGreenGeometry';

function random(seed: number) { let s = seed >>> 0 || 1; return () => (s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), (s >>> 0) / 4294967296); }

/** One indexed vertex-coloured mesh. Giant green has authored curved-crown LODs; the
 * compact aggregating species retains its original geometry. Metres, base at Y=0. */
export function buildAnemoneGeometry(species: AnemoneSpecies, seed = 1, colony = false) {
  if (species === 'giant-green') return buildGiantGreenGeometry(seed, colony);
  const spec = ANEMONES[species], rand = random(seed), r = spec.discDiameterMeters / 2, h = spec.columnHeightMeters;
  const parts: BufferGeometry[] = [];
  const paint = (g: BufferGeometry, color: string) => {
    const c = new Color(color), n = g.getAttribute('position').count, colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new Float32BufferAttribute(colors, 3)); g.deleteAttribute('uv'); return g;
  };
  // Column flares toward the disc, like a relaxed, open animal. The smooth column and disc carry
  // the detail that distance LOD can reduce; thin tentacles keep their silhouette at every level.
  parts.push(paint(new CylinderGeometry(r * .82, r * .7, h, 16, 3, true).translate(0, h / 2, 0), spec.colors.column));
  parts.push(paint(new CircleGeometry(r * .82, 16).rotateX(-Math.PI / 2).translate(0, h, 0), spec.colors.disc));
  for (const [count, ring, length, tilt, color] of [[18, .78, .62, 1.05, spec.colors.tentacle], [12, .45, .5, .55, spec.colors.tip]] as const) {
    for (let i = 0; i < count; i++) {
      const a = (i + (count === 12 ? .5 : 0)) / count * Math.PI * 2 + (rand() - .5) * .18, len = r * length * (.85 + rand() * .3);
      const cone = new ConeGeometry(r * .085, len, 3, 1, true).translate(0, len / 2, 0);
      cone.rotateZ(-(tilt + (rand() - .5) * .25)); cone.rotateY(-a);
      parts.push(paint(cone.translate(Math.cos(a) * r * ring, h, Math.sin(a) * r * ring), color));
    }
  }
  const merged = mergeGeometries(parts)!; parts.forEach(p => p.dispose());
  const geometry = mergeVertices(merged, 1e-6); merged.dispose(); geometry.computeVertexNormals(); geometry.name = `anemone:${species}`; geometry.userData.seed = seed;
  return geometry;
}

/** One inspectable anemone. The factory owns its geometry and material. */
export function createAnemone({ species = 'giant-green' as AnemoneSpecies, seed = Math.floor(Math.random() * 2 ** 31) } = {}) {
  const spec = ANEMONES[species], root = new Group(); root.name = `Anemone · ${spec.species}`;
  const mesh = new Mesh(buildAnemoneGeometry(species, seed), createToonMaterial({ vertexColors: true, rim: false, name: `${spec.id}-toon` }));
  mesh.name = `${spec.id}-column-disc-tentacles`; root.add(mesh);
  root.userData = { assetId: spec.id, species: spec.species, units: 'metres', seed, discDiameterMeters: spec.discDiameterMeters,
    sourceParts: species === 'giant-green' ? ['column', 'oral-disc', 'mouth', 'outer-tentacles', 'middle-tentacles', 'inner-tentacles'] : ['column', 'oral-disc', 'outer-tentacles', 'inner-tentacles'], source: spec.source, sizeBasis: spec.sizeBasis, budget: ANEMONE_BUDGET,
    contactNormal: [0, 1, 0], contactAnchor: [0, 0, 0] };
  return root;
}

export interface AnemonePlacement { position: Vector3; normal: Vector3; scale?: number; yaw?: number }
/** A static instanced bed: one draw per species, matrices uploaded once. Anemones are sessile here;
 * no per-frame work. Dispose releases the shared geometry and material once. */
export function createAnemoneBed(species: AnemoneSpecies, placements: readonly AnemonePlacement[], seed = 7) {
  const spec = ANEMONES[species], geometry = buildAnemoneGeometry(species, seed, true);
  const material = createToonMaterial({ vertexColors: true, rim: false, name: `${spec.id}-bed-toon` });
  const bed = new InstancedMesh(geometry, material, Math.max(1, placements.length)); bed.count = placements.length;
  bed.name = `${spec.id}-bed`; bed.userData = { assetId: spec.id, species: spec.species, units: 'metres', seed, budget: ANEMONE_BED_BUDGET, sourceParts: geometry.userData.sourceParts ?? geometry.name };
  const up = new Vector3(0, 1, 0), turn = new Quaternion(), tilt = new Quaternion(), matrix = new Matrix4(), scale = new Vector3();
  placements.forEach((p, i) => {
    tilt.setFromUnitVectors(up, p.normal.clone().normalize()); turn.setFromAxisAngle(up, p.yaw ?? 0);
    matrix.compose(p.position, tilt.multiply(turn), scale.setScalar(p.scale ?? 1)); bed.setMatrixAt(i, matrix);
  });
  bed.instanceMatrix.needsUpdate = true; bed.computeBoundingBox(); bed.computeBoundingSphere();
  let disposed = false;
  return { root: bed, dispose() { if (disposed) return; disposed = true; bed.removeFromParent(); bed.dispose(); geometry.dispose(); material.dispose(); } };
}
