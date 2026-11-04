import { type BufferGeometry, InstancedMesh, Matrix4, Mesh, Object3D, PerspectiveCamera, Sphere, Vector3 } from 'three';
import { geometryBytes, LOD_LEVELS, prepareGeometryLods, triangles, type GeometryLods, type LodLevel, type LodMode } from './geometry';

export const LOD_POLICY = { nearPixels: 180, farPixels: 55, hysteresis: .15, checkInterval: .12 } as const;
/** A stable band avoids chatter while orbiting around a boundary. CSS pixels deliberately keep
 * phone DPR from forcing expensive meshes. Camera FOV/zoom and real object size are respected. */
export function chooseLod(pixels: number, current: LodLevel = 'near'): LodLevel {
  const { nearPixels: n, farPixels: f, hysteresis: h } = LOD_POLICY;
  if (pixels >= n * (current === 'near' ? 1 - h : 1 + h)) return 'near';
  if (pixels < f * (current === 'far' ? 1 + h : 1 - h)) return 'far';
  return 'mid';
}
interface Entry { mesh: Mesh; levels: GeometryLods; level: LodLevel; sphere: Sphere; pixels: number; release: () => void }

/** Three r180 binds morph textures when compiling a material. A geometry-only swap
 * refreshes vertex buffers but can retain the old morph texture and vertex ordering. */
function setRenderGeometry(mesh: Mesh, geometry: BufferGeometry) {
  if (mesh.geometry === geometry) return;
  const hasMorphs = Object.values(mesh.geometry.morphAttributes).some(targets => targets.length > 0)
    || Object.values(geometry.morphAttributes).some(targets => targets.length > 0);
  mesh.geometry = geometry;
  if (hasMorphs) {
    if (Array.isArray(mesh.material)) for (const material of mesh.material) material.needsUpdate = true;
    else mesh.material.needsUpdate = true;
  }
}

/** Presentation only: does not touch root transforms, visibility/life state, physics, clocks,
 * skeletons or instance slots. Schools keep one draw and use their nearest member conservatively. */
export function createLodController() {
  const entries = new Map<Mesh, Entry>(), pending = new Map<Mesh, Promise<void>>();
  const center = new Vector3(), scale = new Vector3(), matrix = new Matrix4();
  let disposed = false, elapsed = Infinity, mode: LodMode = 'auto';
  function register(root: Object3D) {
    if (disposed) return Promise.resolve([]);
    const work: Promise<void>[] = [];
    root.traverse(object => {
      if (!(object instanceof Mesh) || entries.has(object)) return;
      const mesh = object, source = mesh.geometry;
      if (pending.has(mesh)) { work.push(pending.get(mesh)!); return; }
      let cancelled = false;
      const cancel = () => { cancelled = true; }; source.addEventListener('dispose', cancel);
      const task = prepareGeometryLods(source).then(levels => {
        if (disposed || cancelled || mesh.geometry !== source) return;
        if (!source.boundingSphere) source.computeBoundingSphere();
        const sphere = source.boundingSphere!.clone();
        // Skinned/GPU/morph movement can extend beyond the rest pose; err toward more detail.
        if ('skeleton' in mesh || Object.keys(source.morphAttributes).length || mesh.material && !Array.isArray(mesh.material) && mesh.material.userData.styleBase) sphere.radius *= 1.4;
        // Picking and surface-crawl probes use canonical geometry, independent of camera LOD.
        const originalRaycast = mesh.raycast;
        const raycast: Mesh['raycast'] = function(this: Mesh, ray, hits) {
          const active = this.geometry; this.geometry = source;
          try { originalRaycast.call(this, ray, hits); } finally { this.geometry = active; }
        };
        mesh.raycast = raycast;
        const release = () => { setRenderGeometry(mesh, source); if (mesh.raycast === raycast) mesh.raycast = originalRaycast;
          entries.delete(mesh); source.removeEventListener('dispose', release); };
        source.addEventListener('dispose', release);
        entries.set(mesh, { mesh, levels, sphere, level: 'near', pixels: Infinity, release }); elapsed = Infinity;
      }).catch(error => { if (!disposed && !cancelled) throw error; }).finally(() => { pending.delete(mesh); source.removeEventListener('dispose', cancel); });
      pending.set(mesh, task); work.push(task);
    });
    return Promise.all(work);
  }
  function update(camera: PerspectiveCamera, viewportHeight: number, dt = .12, force = false) {
    elapsed += dt; if (!force && elapsed < LOD_POLICY.checkInterval) return false; elapsed = 0;
    camera.updateWorldMatrix(true, false);
    const focal = viewportHeight * camera.projectionMatrix.elements[5] / 2; let changed = false;
    for (const e of entries.values()) {
      let visible = true; for (let p: Object3D | null = e.mesh; p; p = p.parent) if (!p.visible) { visible = false; break; }
      if (!visible) continue;
      e.mesh.updateWorldMatrix(true, false);
      // Find the largest projected individual, not the total school's bounding sphere.
      let pixels = 0;
      const measure = (world: Matrix4) => {
        center.copy(e.sphere.center).applyMatrix4(world); scale.setFromMatrixScale(world);
        const radius = e.sphere.radius * Math.max(scale.x, scale.y, scale.z);
        // Distance to the front of a conservative sphere avoids undersampling close oblique views.
        center.applyMatrix4(camera.matrixWorldInverse);
        const distance = Math.max(camera.near, -center.z - radius);
        pixels = Math.max(pixels, radius * 2 * focal / distance);
      };
      if (e.mesh instanceof InstancedMesh) for (let i = 0; i < e.mesh.count; i++) { e.mesh.getMatrixAt(i, matrix); matrix.premultiply(e.mesh.matrixWorld); measure(matrix); }
      else measure(e.mesh.matrixWorld);
      e.pixels = pixels;
      const next = mode === 'auto' ? chooseLod(pixels, e.level) : mode;
      if (next !== e.level) { setRenderGeometry(e.mesh, e.levels[next]); e.level = next; changed = true; }
    }
    return changed;
  }
  function stats(root: Object3D) {
    const counts = { near: { triangles: 0, draws: 0 }, mid: { triangles: 0, draws: 0 }, far: { triangles: 0, draws: 0 } };
    let bytes = 0, meshes = 0; const geometries = new Set<unknown>();
    // Memory includes inactive caught/alive batches, unlike visible draw/triangle counters.
    root.traverse(o => { if (!(o instanceof Mesh)) return;
      for (const g of Object.values(entries.get(o)?.levels ?? { near: o.geometry }))
        if (!geometries.has(g)) { geometries.add(g); bytes += geometryBytes(g); }
    });
    root.traverseVisible(o => { if (!(o instanceof Mesh)) return;
      const entry = entries.get(o), instances = o instanceof InstancedMesh ? o.count : 1; if (!instances) return; meshes++;
      for (const level of LOD_LEVELS) { const g = entry?.levels[level] ?? o.geometry;
        counts[level].triangles += triangles(g) * instances;
        counts[level].draws += Array.isArray(o.material) ? g.groups.length : 1;
      }
    });
    return { ...counts, bytes, meshes, ready: pending.size === 0 };
  }
  return { register, update, stats, get mode() { return mode; }, setMode(value: LodMode) { mode = value; elapsed = Infinity; },
    get size() { return entries.size; }, async ready() { await Promise.all(pending.values()); },
    inspect(root: Object3D) { const rows: { name: string; level: LodLevel; pixels: number }[] = []; root.traverseVisible(o => { const e = entries.get(o as Mesh); if (e) rows.push({ name: o.name, level: e.level, pixels: e.pixels }); }); return rows; },
    dispose() { disposed = true; for (const e of [...entries.values()]) e.release(); entries.clear(); },
  };
}
