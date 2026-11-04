import { DirectionalLight, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { ShadowBaseNode, type NodeFrame } from 'three/webgpu';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { TIER_SETTINGS } from './quality';
import { createShadowCasterCulling } from './shadowCasters';

/** Same coverage on both device tiers; only the map resolution changes. The last
 * cascade fades beyond the local clear-weather fog, instead of ending on visible land. */
export const GYM_SUN_SHADOWS = { splits: [80, 360, 3600], lightMargin: 300, cascades: 3 } as const;

/** Three r180 supplies TSL cascade blending and light-space texel snapping. This small
 * adapter synchronizes changing projection/weather and owns the cloned map resources.
 * No camera-distance geometry or authoritative world state is changed. */
export class GymSunShadowNode extends CSMShadowNode {
  private projection = new Matrix4();
  private released = false;
  readonly casters = createShadowCasterCulling();
  private direction = new Vector3();
  private shadowViews: { camera: DirectionalLight['shadow']['camera']; texel: number }[] = [];
  constructor(readonly sun: DirectionalLight) {
    super(sun, { cascades: GYM_SUN_SHADOWS.cascades, maxFar: GYM_SUN_SHADOWS.splits[2],
      mode: 'custom', lightMargin: GYM_SUN_SHADOWS.lightMargin,
      customSplitsCallback: (_count, _near, far, breaks) => {
        // Keep distinct ordered splits even when an inspection camera shortens its far plane.
        breaks.push(Math.min(80 / far, .25), Math.min(360 / far, .60), 1);
      } });
    this.fade = true;
  }

  override updateBefore(frame: NodeFrame) {
    if (this.released || !this.camera) return;
    // FOV, aspect, zoom and near/far change when walking, diving, flying or resizing.
    // Refit only on those changes; translation/rotation are handled by CSM each render.
    if (!this.projection.equals(this.camera.projectionMatrix)) {
      this.updateFrustums(); this.projection.copy(this.camera.projectionMatrix);
    }
    for (const [i, light] of this.lights.entries()) {
      const shadow = light.shadow!, camera = shadow.camera;
      const width = camera.right - camera.left, texel = width / shadow.mapSize.x;
      const view = this.shadowViews[i] ??= { camera, texel }; view.texel = texel;
      shadow.normalBias = Math.max(.035, texel * 1.5);
      shadow.bias = -.0002;
      shadow.intensity = this.sun.shadow.intensity;
      shadow.autoUpdate = this.sun.shadow.autoUpdate;
      // The old fixed 500 m depth would clip distant casters even with wider XY bounds.
      const far = width + 2 * this.lightMargin;
      if (camera.far !== far) { camera.near = .5; camera.far = far; camera.updateProjectionMatrix(); }
    }
    super.updateBefore(frame);
    if (frame.scene) {
      this.direction.subVectors(this.sun.position, this.sun.target.position).normalize();
      this.casters.update(frame.scene, this.camera as PerspectiveCamera, this.direction, this.breaks, this.maxFar, this.shadowViews);
    }
    // Keep matrices current before child shadow nodes render, including the first frame.
    for (const light of this.lights) { light.updateMatrixWorld(); light.target.updateMatrixWorld(); }
  }

  override dispose() {
    if (this.released) return; this.released = true;
    // r180 CSM.dispose only removes helper objects and assumes they have a parent.
    // Also release each cloned map, and handle disposal before the first render safely.
    for (const light of this.lights) {
      light.shadow?.dispose(); light.removeFromParent(); light.target.removeFromParent();
    }
    this.casters.dispose();
    ShadowBaseNode.prototype.dispose.call(this);
  }
}

export function createSunShadows(sun: DirectionalLight, camera: PerspectiveCamera, tier: 'base' | 'standard') {
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(TIER_SETTINGS[tier].shadowMapSize);
  const node = new GymSunShadowNode(sun);
  sun.shadow.shadowNode = node;
  const origin = new Vector3();
  return {
    node,
    update(direction: Vector3) {
      // Directional lighting only needs a direction. Coverage follows the camera frustum,
      // not a player-centred box or a walking/flying toggle.
      sun.target.position.copy(origin); sun.target.updateMatrixWorld();
      sun.position.copy(direction).multiplyScalar(220); sun.updateMatrixWorld();
    },
    getSnapshot() {
      return { cascades: node.cascades, maxDistance: Math.min(node.maxFar, camera.far), fade: node.fade,
        resolution: sun.shadow.mapSize.x, casters: node.casters.getSnapshot(), splits: node.breaks.map(b => b * Math.min(node.maxFar, camera.far)),
        maps: node.lights.map(light => { const s = light.shadow!; return { width: s.camera.right - s.camera.left,
          far: s.camera.far, normalBias: s.normalBias, intensity: s.intensity, autoUpdate: s.autoUpdate, allocated: !!s.map }; }) };
    },
    dispose() { node.dispose(); if (sun.shadow.shadowNode === node) sun.shadow.shadowNode = undefined; }
  };
}
