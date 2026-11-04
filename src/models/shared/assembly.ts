import { BufferGeometry, Group, Material, Matrix4, Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Point3 } from '../types';

/** Author named components first; combine compatible geometry after assembly. */
export function createModelAssembly(id: string) {
  const root = new Group();
  root.name = id;
  const visual = new Group();
  visual.name = `${id}-visual`;
  root.add(visual);
  const parts = new Map<string, Group>();

  function addPart(name: string, position: Point3 = [0, 0, 0]) {
    if (parts.has(name)) throw new Error(`Duplicate model component: ${name}`);
    const group = new Group();
    group.name = name;
    group.position.set(...position);
    visual.add(group);
    parts.set(name, group);
    return group;
  }

  function addMesh(part: Group, geometry: BufferGeometry, material: Material, label = 'surface') {
    const mesh = new Mesh(geometry, material);
    mesh.name = `${part.name}:${label}`;
    part.add(mesh);
    return mesh;
  }

  function duplicatePart(source: string, target: string) {
    const original = parts.get(source);
    if (!original) throw new Error(`Missing model component: ${source}`);
    if (parts.has(target)) throw new Error(`Duplicate model component: ${target}`);
    const copy = original.clone();
    copy.name = target;
    // Own the copied geometry; materials remain shared within this model instance.
    copy.traverse(object => {
      if (object instanceof Mesh) object.geometry = object.geometry.clone();
    });
    visual.add(copy);
    parts.set(target, copy);
  }

  /** Bakes component transforms into visual-local geometry, grouped by material. */
  function batchParts(sources: readonly string[], target: string, options: { discardUVs?: boolean } = {}) {
    if (parts.has(target)) throw new Error(`Duplicate model batch: ${target}`);
    const groups = sources.map(name => {
      const part = parts.get(name);
      if (!part) throw new Error(`Missing model component: ${name}`);
      return part;
    });
    visual.updateWorldMatrix(true, true);
    const inverseVisual = visual.matrixWorld.clone().invert();
    const transform = new Matrix4();
    const batches = new Map<Material, BufferGeometry[]>();
    const originals = new Set<BufferGeometry>();
    for (const group of groups) group.traverse(object => {
      if (!(object instanceof Mesh)) return;
      if (Array.isArray(object.material)) throw new Error('Batch component meshes must use a single material');
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      transform.multiplyMatrices(inverseVisual, object.matrixWorld);
      geometry.applyMatrix4(transform);
      // Texture-free species may opt out; preserve UVs by default for other assets.
      if (options.discardUVs) geometry.deleteAttribute('uv');
      const material = object.material as Material;
      if (!batches.has(material)) batches.set(material, []);
      batches.get(material)!.push(geometry);
      originals.add(object.geometry);
    });
    const batch = addPart(target);
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries);
      geometries.forEach(item => item.dispose());
      if (!geometry) throw new Error(`Incompatible vertex attributes in model batch: ${target}`);
      addMesh(batch, geometry, material);
    }
    for (const group of groups) { group.removeFromParent(); parts.delete(group.name); }
    const retained = new Set<BufferGeometry>();
    visual.traverse(object => { if (object instanceof Mesh) retained.add(object.geometry); });
    originals.forEach(geometry => { if (!retained.has(geometry)) geometry.dispose(); });
  }

  return { root, visual, parts, addPart, addMesh, duplicatePart, batchParts };
}

export type ModelAssembly = ReturnType<typeof createModelAssembly>;

/** Each factory owns its resources; sharing between instances needs a future cache/lease. */
export function disposeModelResources(root: Group) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  root.removeFromParent();
}
