import { CircleGeometry, Color, Float32BufferAttribute, Group, Mesh, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createToonMaterial } from '../shared/style';
import { buildBatStarBody, buildBatStarFeet } from './batStarGeometry';

export const BAT_STAR = {
  id: 'bat-star', species: 'Patiria miniata', diameterMeters: .18,
  source: 'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/bat-star',
  sizeBasis: 'Artistic 18 cm across design, below the Aquarium reference maximum of 20 cm; not a measured specimen.',
  budget: { triangles: 850, drawCalls: 1 }, colonyBudget: { triangles: 400, drawCalls: 1 },
  /** Game pacing, not a biological speed claim: 0.12 mm per minute. */
  crawlSpeedMetersPerSecond: .000002,
} as const;
export interface BatStarOptions {
  diameterMeters?: number;
  color?: 'orange' | 'purple';
  /** Oral detail is useful in inspection; attached colonies omit hidden tube feet. */
  detail?: 'near' | 'colony';
  /** Omit for a fresh variation; use a saved seed to reproduce it. */
  seed?: number;
}

export function createBatStar({ diameterMeters = BAT_STAR.diameterMeters, color, detail = 'near', seed = Math.floor(Math.random() * 2 ** 32) }: BatStarOptions = {}) {
  if (!Number.isFinite(diameterMeters) || diameterMeters <= 0) throw new Error('Bat star diameter must be positive metres');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Bat star seed must be a uint32');
  if (color !== undefined && color !== 'orange' && color !== 'purple') throw new Error('Unknown bat star color');
  if (detail !== 'near' && detail !== 'colony') throw new Error('Unknown bat star detail level');
  let state = seed || 1;
  const rand = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 2 ** 32; };
  const variant = color ?? (rand() < .65 ? 'orange' : 'purple');
  const near = detail === 'near', body = buildBatStarBody(diameterMeters, rand, variant, near), contactLift = near ? diameterMeters * .019 : 0;
  // A small pale madreporite is painted into the same draw; no face or cartoon eyes.
  const plate = new CircleGeometry(diameterMeters * .019, 6).rotateX(-Math.PI / 2);
  plate.translate(diameterMeters * .025, contactLift + diameterMeters * .109, diameterMeters * .020); plate.deleteAttribute('uv');
  const pale = new Color('#d6b995'), colors = new Float32Array(plate.attributes.position.count * 3);
  for (let i = 0; i < plate.attributes.position.count; i++) pale.toArray(colors, i * 3);
  plate.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const pieces = [body, plate];
  if (near) {
    const mouth = new CircleGeometry(diameterMeters * .025, 8).rotateX(Math.PI / 2).translate(0, contactLift + diameterMeters * .012, 0); mouth.deleteAttribute('uv');
    const ink = new Color('#5a4737'), colors = new Float32Array(mouth.attributes.position.count * 3);
    for (let i = 0; i < mouth.attributes.position.count; i++) ink.toArray(colors, i * 3); mouth.setAttribute('color', new Float32BufferAttribute(colors, 3));
    pieces.push(mouth, buildBatStarFeet(diameterMeters));
  }
  const geometry = mergeGeometries(pieces)!; pieces.forEach(g => g.dispose());
  geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(new Vector3()), fit = diameterMeters / Math.max(size.x, size.z);
  geometry.scale(fit, 1, fit); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const root = new Group(), mesh = new Mesh(geometry, createToonMaterial({ vertexColors: true, name: 'bat-star-toon', rim: false }));
  root.name = 'Bat star'; mesh.name = 'bat-star-body-and-madreporite'; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  root.userData = { assetId: BAT_STAR.id, species: BAT_STAR.species, units: 'metres', authoring: 'procedural TypeScript', seed, color: variant,
    diameterMeters, sizeBasis: BAT_STAR.sizeBasis, source: BAT_STAR.source,
    sourceParts: near ? ['webbed-body', 'aboral-ridges', 'oral-grooves', 'tube-feet', 'oral-mouth', 'madreporite'] : ['webbed-body', 'aboral-ridges', 'simplified-oral-surface', 'madreporite'],
    detail, tubeFeet: near ? 30 : 0, referenceImages: ['https://www.montereybayaquarium.org/animals/animals-a-to-z/bat-star'],
    contactNormal: [0, 1, 0], contactAnchor: [0, 0, 0], crawlSpeedMetersPerSecond: BAT_STAR.crawlSpeedMetersPerSecond, budget: near ? BAT_STAR.budget : BAT_STAR.colonyBudget,
    physics: { colliders: [{ shape: 'sphere', radius: diameterMeters * .32, center: [0, diameterMeters * .05, 0] }], grip: [0, diameterMeters * .08, 0] } };
  return root;
}
