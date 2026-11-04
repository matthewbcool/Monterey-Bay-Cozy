import { BufferAttribute, BufferGeometry, type TypedArray } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

export const LOD_LEVELS = ['near', 'mid', 'far'] as const;
export type LodLevel = typeof LOD_LEVELS[number];
export type LodMode = 'auto' | LodLevel;
export const LOD_TARGETS = { mid: { ratio: .5, error: .008 }, far: { ratio: .2, error: .035 } } as const;
export interface GeometryLods { near: BufferGeometry; mid: BufferGeometry; far: BufferGeometry }
const cache = new WeakMap<BufferGeometry, Promise<GeometryLods>>();
const authored = new WeakMap<BufferGeometry, () => Pick<GeometryLods, 'mid' | 'far'>>();
/** Optional procedural variants for paint partitions that generic collapse cannot preserve.
 * Build once on registration; the same family owns disposal, bounds and controller selection. */
export function defineGeometryLods(source: BufferGeometry, build: () => Pick<GeometryLods, 'mid' | 'far'>) {
  if (cache.has(source) || authored.has(source)) throw new Error('LOD variants must be defined once, before registration');
  authored.set(source, build);
  source.addEventListener('dispose', () => authored.delete(source));
}
export const triangles = (g: BufferGeometry) => (g.index?.count ?? g.attributes.position.count) / 3;
export function geometryBytes(g: BufferGeometry) {
  return (g.index?.array.byteLength ?? 0) + Object.values(g.attributes).reduce((n, a) => n + a.array.byteLength, 0)
    + Object.values(g.morphAttributes).flat().reduce((n, a) => n + a.array.byteLength, 0);
}

/** Copy whole vertex records: no interpolated joint IDs, lost paint, or detached morph targets.
 * Index-only simplification retains exact authored values at surviving vertices. */
function compact(source: BufferGeometry, indices: Uint32Array) {
  const [remap, count] = MeshoptSimplifier.compactMesh(indices), result = new BufferGeometry();
  const copy = (a: BufferAttribute) => {
    const ArrayType = a.array.constructor as { new(length: number): TypedArray };
    const data = new ArrayType(count * a.itemSize);
    for (let i = 0; i < remap.length; i++) if (remap[i] !== 0xffffffff)
      for (let j = 0; j < a.itemSize; j++) data[remap[i] * a.itemSize + j] = a.array[i * a.itemSize + j];
    const attribute = new BufferAttribute(data, a.itemSize, a.normalized); attribute.name = a.name;
    return attribute;
  };
  for (const [name, a] of Object.entries(source.attributes)) result.setAttribute(name, copy(a as BufferAttribute));
  for (const [name, targets] of Object.entries(source.morphAttributes)) result.morphAttributes[name as 'position'] = targets.map(a => copy(a as BufferAttribute));
  result.morphTargetsRelative = source.morphTargetsRelative;
  result.setIndex(new BufferAttribute(count < 65536 ? new Uint16Array(indices) : indices, 1));
  // Authored conservative motion bounds survive simplification, including GPU-only tuna bending.
  result.boundingBox = source.boundingBox?.clone() ?? null;
  result.boundingSphere = source.boundingSphere?.clone() ?? null;
  return result;
}

function reduce(source: BufferGeometry, ratio: number, error: number) {
  // Welding respects all vertex attributes and morph targets; material groups are simplified separately.
  const inputGeometry = source.clone();
  // Three's mergeVertices hashes ordinary attributes only. Include morph records in that hash
  // so coincident vertices with different animation trajectories never get welded together.
  const temporary: string[] = [];
  for (const [name, targets] of Object.entries(source.morphAttributes)) targets.forEach((a, i) => {
    const key = `lodMorph_${name}_${i}`; inputGeometry.setAttribute(key, a); temporary.push(key);
  });
  const welded = mergeVertices(inputGeometry, 1e-6); inputGeometry.dispose();
  for (const key of temporary) welded.deleteAttribute(key);
  const position = welded.getAttribute('position');
  const positions = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) positions.set([position.getX(i), position.getY(i), position.getZ(i)], i * 3);
  const channels = ['normal', 'color', 'skinIndex', 'skinWeight', 'tunaJoint', 'fishMatte']
    .filter(name => welded.hasAttribute(name)).map(name => ({ attribute: welded.getAttribute(name), weight: name === 'tunaJoint' ? 10 : name === 'skinIndex' ? 1 : name === 'normal' ? .05 : .3 }));
  const morphs = welded.morphAttributes.position;
  if (morphs?.length) for (const i of new Set([0, morphs.length - 1])) channels.push({ attribute: morphs[i], weight: .3 / Math.max(.001, MeshoptSimplifier.getScale(positions, 3)) });
  const stride = channels.reduce((n, c) => n + c.attribute.itemSize, 0), weights = channels.flatMap(c => Array(c.attribute.itemSize).fill(c.weight));
  const attributes = new Float32Array(position.count * stride);
  for (let i = 0; i < position.count; i++) { let offset = i * stride;
    for (const { attribute: a } of channels) for (let j = 0; j < a.itemSize; j++) attributes[offset++] = a.getComponent(i, j);
  }
  const index = welded.index!, groups = source.groups.length ? source.groups : [{ start: 0, count: index.count, materialIndex: 0 }];
  const indices: number[] = [], reducedGroups: { start: number; count: number; materialIndex: number }[] = [];
  // Architectural surfaces can request a metre-based error budget. A relative
  // percentage of a 300 m terrain batch otherwise permits metre-scale folds.
  // Creature defaults stay unchanged; no geometry is exempted from registration.
  const metreLimit=source.userData.lodMaxErrorMetres;
  const bounded=Number.isFinite(metreLimit)&&metreLimit>0;
  const allowedError=bounded?Math.min(error,metreLimit/Math.max(1e-6,MeshoptSimplifier.getScale(positions,3))):error;
  for (const group of groups) {
    const input = Uint32Array.from(index.array.slice(group.start, group.start + group.count));
    const [reduced, actualError] = MeshoptSimplifier.simplifyWithAttributes(input, positions, 3, attributes, stride, weights, null,
      Math.min(input.length, Math.max(12, Math.floor(input.length * ratio / 3) * 3)), allowedError, bounded ? ['LockBorder'] : ['Permissive']);
    reducedGroups.push({ start: indices.length, count: reduced.length, materialIndex: group.materialIndex ?? 0 });
    indices.push(...reduced);
    welded.userData.lodError = Math.max(welded.userData.lodError ?? 0, actualError);
  }
  const result = compact(welded, Uint32Array.from(indices));
  if (source.groups.length) for (const group of reducedGroups) result.addGroup(group.start, group.count, group.materialIndex);
  result.userData = { ...source.userData, lodError: welded.userData.lodError ?? 0 };
  welded.dispose();
  if (triangles(result) >= triangles(source)) { result.dispose(); return source; }
  return result;
}

/** Built once per owned source geometry, never per frame. Small primitives already at their
 * useful silhouette stay unchanged. Disposing any level releases the whole geometry family. */
export function prepareGeometryLods(source: BufferGeometry): Promise<GeometryLods> {
  const existing = cache.get(source); if (existing) return existing;
  let disposed = false;
  const pendingDispose = () => { disposed = true; }; source.addEventListener('dispose', pendingDispose);
  const promise = (async () => {
    await MeshoptSimplifier.ready;
    if (disposed) throw new Error('LOD source disposed during preparation');
    if (!source.boundingBox) source.computeBoundingBox();
    if (!source.boundingSphere) source.computeBoundingSphere();
    const levels: GeometryLods = { near: source, mid: source, far: source };
    const build = authored.get(source);
    if (build) {
      Object.assign(levels, build()); authored.delete(source);
      for (const g of [levels.mid, levels.far]) {
        // Keep the canonical animation envelope; the authored variant may have fewer details.
        g.boundingBox = source.boundingBox!.clone(); g.boundingSphere = source.boundingSphere!.clone();
      }
    } else if (triangles(source) >= 24 && source.drawRange.start === 0 && source.drawRange.count === Infinity) {
      levels.mid = reduce(source, LOD_TARGETS.mid.ratio, LOD_TARGETS.mid.error);
      levels.far = reduce(source, LOD_TARGETS.far.ratio, LOD_TARGETS.far.error);
      if (triangles(levels.far) > triangles(levels.mid)) { if (levels.far !== source) levels.far.dispose(); levels.far = levels.mid; }
    }
    const all = new Set(Object.values(levels)); let releasing = false;
    const release = (event: { target?: unknown }) => { if (releasing) return; releasing = true; cache.delete(source);
      for (const g of all) g.removeEventListener('dispose', release);
      for (const g of all) if (g !== event.target) g.dispose();
    };
    source.removeEventListener('dispose', pendingDispose);
    for (const g of all) g.addEventListener('dispose', release);
    return levels;
  })();
  cache.set(source, promise); return promise;
}
