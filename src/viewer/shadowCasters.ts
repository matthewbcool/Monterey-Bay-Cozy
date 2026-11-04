import { Box3, Frustum, InstancedMesh, Matrix4, Mesh, PerspectiveCamera, Scene, SkinnedMesh, Vector3 } from 'three';

// Reserved by the Gym only; layer zero remains the ordinary color/studio view.
const CASCADE_LAYERS = [1, 2, 3] as const;
const CASCADE_MASK = CASCADE_LAYERS.reduce((mask, layer) => mask | (1 << layer), 0);

/** Conservative swept-box/frustum test. An offscreen caster is retained when its
 * shadow can enter the receiver frustum. Plain camera culling would drop it. */
export function shadowCanReach(box: Box3, direction: Vector3, length: number, frustum: Frustum) {
  let enter = 0, exit = length;
  for (const plane of frustum.planes) {
    const n = plane.normal;
    // Maximum plane distance over the box (support vertex), without allocating.
    const distance = n.x * (n.x >= 0 ? box.max.x : box.min.x)
      + n.y * (n.y >= 0 ? box.max.y : box.min.y)
      + n.z * (n.z >= 0 ? box.max.z : box.min.z) + plane.constant;
    const speed = n.dot(direction);
    if (Math.abs(speed) < 1e-9) { if (distance < 0) return false; }
    else if (speed > 0) enter = Math.max(enter, -distance / speed);
    else exit = Math.min(exit, -distance / speed);
    if (enter > exit) return false;
  }
  return true;
}

/** Cull shadow submissions, never color visibility, animal simulation or geometry.
 * The receiver floor comes from visible receiving geometry, not a guessed sea level.
 * Three still applies each shadow camera's ordinary frustum culling afterward. */
export function createShadowCasterCulling() {
  const frustums = CASCADE_LAYERS.map(() => new Frustum()), projection = new Matrix4();
  const entries = new Map<Mesh, { box: Box3; originalLayers: number }>();
  const bounds = new Box3(), direction = new Vector3();
  let candidates = 0, receiverFloor = 0;
  const kept = [0, 0, 0];
  function worldBounds(mesh: Mesh, out: Box3) {
    if (mesh instanceof InstancedMesh) {
      if (!mesh.boundingBox) mesh.computeBoundingBox();
      out.copy(mesh.boundingBox!);
    } else if (mesh instanceof SkinnedMesh) {
      // Use the same conservative animated bounds as Three's view culling.
      if (!mesh.boundingSphere) mesh.computeBoundingSphere();
      const sphere = mesh.boundingSphere!;
      out.min.copy(sphere.center).addScalar(-sphere.radius);
      out.max.copy(sphere.center).addScalar(sphere.radius);
    } else {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      out.copy(mesh.geometry.boundingBox!);
    }
    return out.applyMatrix4(mesh.matrixWorld);
  }
  return {
    update(scene: Scene, camera: PerspectiveCamera, sunDirection: Vector3, breaks: readonly number[], maxFar: number,
      shadowCameras: readonly { camera: { layers: { set(layer: number): void }; far: number }; texel: number }[]) {
      const far = Math.min(maxFar, camera.far);
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      for (let i = 0; i < frustums.length; i++) {
        const from = i ? breaks[i - 1] : 0, to = breaks[i];
        // Match CSM's overlap plus a filter/bias guard. This deliberately overestimates.
        const near = Math.max(camera.near, from * far - .125 * from * from * far);
        const end = to * far + (i < 2 ? .125 * to * to * far : 0);
        const frustum = frustums[i].setFromProjectionMatrix(projection, camera.coordinateSystem);
        frustum.planes[5].constant -= near - camera.near;
        frustum.planes[4].constant += end - camera.far;
        const guard = 1 + shadowCameras[i].texel * 3;
        for (const plane of frustum.planes) plane.constant += guard;
        shadowCameras[i].camera.layers.set(CASCADE_LAYERS[i]);
        kept[i] = 0;
      }
      candidates = 0; receiverFloor = Infinity;
      // All receiving geometry contributes, including off-camera seabed and sloping ground.
      scene.traverseVisible(object => {
        if (!(object instanceof Mesh) || (!object.receiveShadow && !object.castShadow)) return;
        worldBounds(object, bounds);
        if (object.receiveShadow) receiverFloor = Math.min(receiverFloor, bounds.min.y - 2);
        if (object.castShadow) {
          let entry = entries.get(object);
          if (!entry) { entry = { box: new Box3(), originalLayers: object.layers.mask & CASCADE_MASK }; entries.set(object, entry); }
          entry.box.copy(bounds); candidates++;
        }
      });
      // Replaced avatars/dynamic props must not be retained by the cache.
      for (const [mesh, entry] of entries) {
        let ancestor = mesh.parent;
        while (ancestor && ancestor !== scene) ancestor = ancestor.parent;
        if (!ancestor) { mesh.layers.mask = (mesh.layers.mask & ~CASCADE_MASK) | entry.originalLayers; entries.delete(mesh); }
      }
      direction.copy(sunDirection).negate();
      scene.traverseVisible(object => {
        if (!(object instanceof Mesh) || !object.castShadow) return;
        const box = entries.get(object)!.box;
        const length = direction.y < -1e-5 && Number.isFinite(receiverFloor)
          ? Math.max(0, (box.max.y - receiverFloor) / -direction.y) : Infinity;
        for (let i = 0; i < frustums.length; i++) {
          const contributes = shadowCanReach(box, direction, Math.min(length, shadowCameras[i].camera.far), frustums[i]);
          if (contributes) { object.layers.enable(CASCADE_LAYERS[i]); kept[i]++; }
          else object.layers.disable(CASCADE_LAYERS[i]);
        }
      });
    },
    getSnapshot() { return { candidates, kept: [...kept], receiverFloor }; },
    dispose() { for (const [mesh, entry] of entries) mesh.layers.mask = (mesh.layers.mask & ~CASCADE_MASK) | entry.originalLayers; entries.clear(); },
  };
}
