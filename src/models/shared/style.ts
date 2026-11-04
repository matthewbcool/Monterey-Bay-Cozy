import { Color, DataTexture, DataUtils, HalfFloatType, LinearFilter, Material, Mesh, MeshStandardMaterial, MeshToonMaterial, Object3D, RedFormat, Vector3, type Side } from 'three';
import { clone as cloneSkeletons } from 'three/addons/utils/SkeletonUtils.js';

/** Art-direction tokens shared by asset factories, lighting, sky and water.
 * The look: warm key light, cool sky-filled shadows, two broad value bands and
 * a hazy horizon. Inspired by open-world painterly cel shading; colors are ours.
 */
export const STYLE = {
  sun: { color: new Color('#fff0d4'), intensity: 2.35, direction: new Vector3(-10, 18, 12).normalize() },
  // Hemisphere light is the only light in core shadow, so its sky color sets the shadow hue.
  sky: { color: new Color('#a9cde6'), ground: new Color('#8a7f5c'), intensity: 1.55 },
  // Visible sky dome / horizon haze. Water reflections sample the same pair.
  dome: { zenith: new Color('#6fa7cf'), horizon: new Color('#f1e6c8'), below: new Color('#2e6f78') },
  studio: { zenith: new Color('#3d6b70'), horizon: new Color('#a9c1ad'), below: new Color('#24474b') },
  /** dot(N,L) where shadow turns to light, and how soft that edge is (in ramp space). */
  ramp: { terminator: .06, softness: .035, shadow: .28, lit: 1, metalLit: .9, glint: 1.5, glintStart: .9 },
} as const;

const RAMP_SIZE = 64;
const ramps = new Map<'matte' | 'metal', DataTexture>();
/** Shared 64×1 ramp generated at runtime; no download, one texture for every toon material. */
export function toonRamp(kind: 'matte' | 'metal' = 'matte') {
  let ramp = ramps.get(kind);
  if (ramp) return ramp;
  const { terminator, softness, shadow, lit, metalLit, glint, glintStart } = STYLE.ramp;
  const data = new Uint16Array(RAMP_SIZE);
  for (let i = 0; i < RAMP_SIZE; i++) {
    const dotNL = (i + .5) / RAMP_SIZE * 2 - 1;
    const t = Math.min(1, Math.max(0, (dotNL - terminator + softness) / (2 * softness)));
    let value = shadow + ((kind === 'metal' ? metalLit : lit) - shadow) * t * t * (3 - 2 * t);
    if (kind === 'metal' && dotNL > glintStart) value = glint; // hard painted highlight band
    data[i] = DataUtils.toHalfFloat(value);
  }
  ramp = new DataTexture(data, RAMP_SIZE, 1, RedFormat, HalfFloatType);
  ramp.minFilter = ramp.magFilter = LinearFilter;
  ramp.generateMipmaps = false; ramp.name = `toon-ramp-${kind}`; ramp.needsUpdate = true;
  ramps.set(kind, ramp);
  return ramp;
}

/** `rim: false` marks terrain and other broad surfaces that a rim-light layer must skip. */
export interface ToonOptions { color?: string | Color; vertexColors?: boolean; metal?: boolean; side?: Side; name?: string; rim?: boolean }
/** Toon has no flatShading flag: for faceted rocks, use non-indexed geometry with computeVertexNormals().
 * Built-in MeshToonMaterial: works on WebGLRenderer and converts to a node material on WebGPURenderer. */
export function createToonMaterial({ color = '#ffffff', vertexColors = false, metal = false, side, name, rim = true }: ToonOptions = {}) {
  const material = new MeshToonMaterial({ color, vertexColors, gradientMap: toonRamp(metal ? 'metal' : 'matte') });
  if (side !== undefined) material.side = side;
  material.name = name ?? (metal ? 'toon-metal' : 'toon-matte');
  material.userData.toon = metal ? 'metal' : 'matte'; material.userData.rim = rim;
  return material;
}

/** glTF has no toon model. Swap to matching standard materials on a clone for export only. */
export function exportableClone(root: Object3D) {
  // Object3D.clone leaves skinned meshes bound to the original bones, outside the export tree.
  const clone = cloneSkeletons(root), swapped = new Map<Material, MeshStandardMaterial>();
  clone.traverse(object => {
    if (!(object instanceof Mesh) || Array.isArray(object.material)) return;
    const source = object.material instanceof MeshToonMaterial ? object.material : object.material.userData.nodeSource;
    if (!(source instanceof MeshToonMaterial)) return;
    let standard = swapped.get(source);
    if (!standard) {
      const metal = source.userData.toon === 'metal';
      standard = new MeshStandardMaterial({ name: source.name, color: source.color, vertexColors: source.vertexColors, side: source.side, transparent: source.transparent, opacity: source.opacity, depthWrite: source.depthWrite, roughness: metal ? .38 : 1, metalness: metal ? .4 : 0 });
      swapped.set(source, standard);
    }
    object.material = standard;
  });
  return { clone, dispose() { swapped.forEach(m => m.dispose()); } };
}
