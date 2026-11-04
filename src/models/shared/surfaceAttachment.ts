import { InstancedMesh, Matrix3, Matrix4, Mesh, Object3D, Quaternion, Raycaster, Vector3, type Intersection } from 'three';

/** Point, normal and heading are in the surface geometry's local coordinates (including instance space). */
export interface SurfaceAnchor {
  surface: Mesh;
  point: Vector3;
  normal: Vector3;
  heading?: Vector3;
  instanceId?: number;
}
export interface SurfaceCrawlOptions {
  speedMetersPerSecond?: number;
  maxTravelMeters?: number;
  offsetMeters?: number;
  /** Ray reach for tiny crawl steps; never crosses to another mesh or instance. */
  probeMeters?: number;
}
const placements = new WeakSet<Object3D>();

function surfaceMatrix(anchor: SurfaceAnchor, out: Matrix4, instance: Matrix4) {
  anchor.surface.updateWorldMatrix(true, false); out.copy(anchor.surface.matrixWorld);
  if (anchor.surface instanceof InstancedMesh) {
    const id = anchor.instanceId;
    if (id === undefined || !Number.isInteger(id) || id < 0 || id >= anchor.surface.count) throw new Error('Surface instance ID required');
    anchor.surface.getMatrixAt(id, instance); out.multiply(instance);
  } else if (anchor.instanceId !== undefined) throw new Error('Instance ID supplied for a non-instanced surface');
  if (Math.abs(out.determinant()) < 1e-12) throw new Error('Surface transform must be invertible');
  return out;
}

/** Turn a Three.js raycast hit into a persistent local anchor; never retain its world point as placement. */
export function surfaceAnchorFromHit(hit: Intersection): SurfaceAnchor {
  if (!(hit.object instanceof Mesh) || !hit.face) throw new Error('A mesh surface hit with a face is required');
  const anchor: SurfaceAnchor = { surface: hit.object, point: hit.point.clone(), normal: hit.face.normal.clone(), instanceId: hit.instanceId };
  const matrix = surfaceMatrix(anchor, new Matrix4(), new Matrix4()); anchor.point.applyMatrix4(matrix.invert());
  return anchor;
}

/** Separate placement owner for attached fauna. Mesh data stays static; only the rigid root moves.
 * Targets may rotate and scale nonuniformly; normals use the inverse transpose. Placement parents
 * must have positive uniform scale. detach() releases ownership without moving or disposing the asset.
 */
export function attachToSurface(root: Object3D, initial: SurfaceAnchor, {
  speedMetersPerSecond = .000002, maxTravelMeters = .02, offsetMeters = .0008, probeMeters = .02,
}: SurfaceCrawlOptions = {}) {
  if (placements.has(root)) throw new Error('Asset already has a surface placement owner');
  for (const value of [speedMetersPerSecond, maxTravelMeters, offsetMeters, probeMeters]) if (!Number.isFinite(value) || value < 0) throw new Error('Surface crawl options must be finite and nonnegative');
  if (probeMeters <= 0) throw new Error('Surface probe must be positive');
  const matrix = new Matrix4(), instance = new Matrix4(), inverse = new Matrix4(), normalMatrix = new Matrix3(), frame = new Matrix4();
  const position = new Vector3(), normal = new Vector3(), heading = new Vector3(), side = new Vector3(), scale = new Vector3();
  const wanted = new Vector3(), origin = new Vector3(), rayDirection = new Vector3(), parentQuaternion = new Quaternion(), rotation = new Quaternion();
  const previous = new Matrix4(), ray = new Raycaster(), hits: Intersection[] = [];
  let anchor: SurfaceAnchor, attached = true, travel = 0, pending = 0;
  function setAnchor(next: SurfaceAnchor) {
    for (let node: Object3D | null = next.surface; node; node = node.parent) if (node === root) throw new Error('Cannot attach an asset to its own subtree');
    if (![...next.point.toArray(), ...next.normal.toArray(), ...(next.heading?.toArray() ?? [])].every(Number.isFinite) || next.normal.lengthSq() < 1e-12) throw new Error('Invalid surface anchor');
    surfaceMatrix(next, matrix, instance);
    const n = next.normal.clone().normalize(), tangent = (next.heading?.clone() ?? new Vector3(1, 0, 0));
    tangent.addScaledVector(n, -tangent.dot(n));
    if (tangent.lengthSq() < 1e-12) { tangent.set(0, Math.abs(n.z) > .9 ? 1 : 0, Math.abs(n.z) > .9 ? 0 : 1); tangent.addScaledVector(n, -tangent.dot(n)); }
    if (tangent.lengthSq() < 1e-12) throw new Error('Surface heading must define a tangent');
    anchor = { ...next, point: next.point.clone(), normal: n, heading: tangent.normalize() };
  }
  function worldFrame() {
    surfaceMatrix(anchor, matrix, instance);
    normalMatrix.getNormalMatrix(matrix); normal.copy(anchor.normal).applyMatrix3(normalMatrix).normalize();
    heading.copy(anchor.heading!).transformDirection(matrix).addScaledVector(normal, -heading.dot(normal)).normalize();
    side.crossVectors(heading, normal).normalize(); heading.crossVectors(normal, side).normalize();
    position.copy(anchor.point).applyMatrix4(matrix);
  }
  function sync() {
    worldFrame(); root.updateMatrix(); previous.copy(root.matrix);
    frame.makeBasis(heading, normal, side); rotation.setFromRotationMatrix(frame);
    position.addScaledVector(normal, offsetMeters);
    if (root.parent) {
      root.parent.updateWorldMatrix(true, false); root.parent.matrixWorld.decompose(wanted, parentQuaternion, scale);
      if (Math.min(scale.x, scale.y, scale.z) <= 0 || Math.max(scale.x, scale.y, scale.z) - Math.min(scale.x, scale.y, scale.z) > 1e-6) throw new Error('Placement parent must have positive uniform scale');
      position.applyMatrix4(inverse.copy(root.parent.matrixWorld).invert()); rotation.premultiply(parentQuaternion.invert()); root.scale.setScalar(1 / scale.x);
    } else root.scale.setScalar(1);
    root.position.copy(position); root.quaternion.copy(rotation); root.updateMatrix();
    return !root.matrix.equals(previous);
  }
  setAnchor(initial); sync(); placements.add(root);
  return {
    /** Returns true only when placement changed, so instanced hosts can skip unchanged uploads. */
    update(deltaSeconds = 0) {
      if (!attached) return false;
      if (Number.isFinite(deltaSeconds) && deltaSeconds > 0 && travel < maxTravelMeters && speedMetersPerSecond > 0) pending += deltaSeconds;
      if (pending >= 1) {
        worldFrame(); const step = Math.min(speedMetersPerSecond * pending, maxTravelMeters - travel); pending = 0;
        wanted.copy(position).addScaledVector(heading, step);
        origin.copy(wanted).addScaledVector(normal, probeMeters); rayDirection.copy(normal).negate();
        ray.set(origin, rayDirection); ray.near = 0; ray.far = probeMeters * 2; hits.length = 0;
        ray.intersectObject(anchor.surface, false, hits);
        const hit = hits.find(hit => hit.instanceId === anchor.instanceId && hit.face);
        // Freeze at an edge or a sharp corner instead of drifting into water or jumping surfaces.
        if (hit?.face) {
          const candidate = surfaceAnchorFromHit(hit);
          const worldNormal = candidate.normal.clone().applyMatrix3(normalMatrix).normalize();
          if (worldNormal.dot(normal) > .7 && hit.point.distanceTo(wanted) < probeMeters * .5) {
            candidate.heading = anchor.heading; anchor = candidate; travel += step;
          }
        }
      }
      return sync();
    },
    getState: () => ({ attached, travelMeters: travel, speedMetersPerSecond, maxTravelMeters, instanceId: anchor.instanceId, point: anchor.point.clone(), normal: anchor.normal.clone() }),
    detach() { if (!attached) return; attached = false; placements.delete(root); },
  };
}
export type SurfaceAttachment = ReturnType<typeof attachToSurface>;
