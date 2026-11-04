import { DoubleSide, Group, Mesh } from 'three';
import { createToonMaterial } from '../../shared/style';
import { MOON_JELLY as J } from './definition';
import { buildJellyGeometry } from './geometry';
import { applyJellyPose } from './motion';
const motion = new WeakMap<Group, { phase: number; meshes: Mesh[] }>();
export function createMoonJelly({ diameterMeters = J.diameterMeters, seed = Math.floor(Math.random() * 2 ** 32) }: {diameterMeters?:number;seed?:number} = {}) {
  if (!Number.isFinite(diameterMeters) || diameterMeters <= 0) throw new Error('Jelly diameter must be positive metres');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Jelly seed must be uint32');
  const root = new Group(); root.name = 'Moon jelly';
  const geometry = buildJellyGeometry(diameterMeters,seed);
  const membrane = createToonMaterial({ vertexColors: true, side: DoubleSide, rim: false, name: 'moon-jelly-bell' });
  membrane.transparent = true; membrane.opacity = .22; membrane.depthWrite = false; membrane.forceSinglePass = true;
  const tissue = createToonMaterial({ vertexColors: true, side: DoubleSide, rim: false, name: 'moon-jelly-tissue' }); tissue.forceSinglePass = true; tissue.transparent = true; tissue.opacity = .72; tissue.depthWrite = false;
  const bell = new Mesh(geometry.bell, membrane), organs = new Mesh(geometry.organs, tissue);
  bell.name = 'moon-jelly-bell'; organs.name = 'moon-jelly-rim-gonads-oral-arms'; bell.renderOrder = 2; organs.renderOrder = 1;
  root.add(organs, bell);
  root.userData = { assetId: J.id, species: J.species, units: 'metres', diameterMeters, seed, budget: J.budget, source: J.source, sizeBasis: J.sizeBasis,
    sourceParts: ['bell', 'four-horseshoe-gonads', 'four-oral-arms', 'short-fringe', 'branched-radial-canals', 'central-mouth'],
    physics: { colliders: [{ shape: 'sphere', radius: diameterMeters / 2, center: [0, 0, 0] }], grip: [0, 0, 0] } };
  motion.set(root, { phase: (seed % 1000) / 1000 * Math.PI * 2, meshes: [bell,organs] });
  updateMoonJelly(root, 0); return root;
}
/** Changes only morph weights, never placement. Hosts own drift and pause; WeakMap owns no resources. */
export function updateMoonJelly(root: Group, dt: number) {
  const state = motion.get(root); if (!state || !Number.isFinite(dt) || dt < 0) return;
  state.phase = (state.phase + dt * J.pulseHz * Math.PI * 2) % (Math.PI * 2);
  applyJellyPose(state.meshes,state.phase);
}
