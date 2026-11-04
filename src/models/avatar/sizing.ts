import { Vector3 } from 'three';
import { AVATAR_SIZE_LIMITS, type AvatarDesign } from './design';

/** Metre measurements shared by the rig and its caller. Height is nominal: hair adds variation. */
export interface AvatarDimensions {
  readonly heightMeters: number;
  readonly heightScale: number;
  readonly bodyBuild: number;
  readonly controllerRadius: number;
  readonly swimDepth: number;
  readonly swimImmersion: number;
  readonly seatedHipHeight: number;
  /** Artistic seat support anchor, accounting for thigh thickness; not a physics contact solve. */
  readonly seatedContactHeight: number;
  readonly cameraTargetHeight: number;
}

export function getAvatarDimensions(design: AvatarDesign): Readonly<AvatarDimensions> {
  const heightScale = design.heightMeters / AVATAR_SIZE_LIMITS.heightMeters.default;
  return Object.freeze({
    heightMeters: design.heightMeters, heightScale, bodyBuild: design.bodyBuild,
    controllerRadius: .28 * heightScale * Math.max(1, design.bodyBuild),
    swimDepth: .85 * heightScale, swimImmersion: .78 * heightScale,
    seatedHipHeight: .36 * heightScale, seatedContactHeight: (.36 - .09 * design.bodyBuild) * heightScale,
    cameraTargetHeight: .78 * heightScale,
  });
}

/** Build changes fade through the upper neck; head/face/hair parts bypass build entirely. */
export function avatarWidthAtHeight(y: number, build: number) {
  const t = Math.max(0, Math.min(1, (y - .90) / .14));
  return 1 + (build - 1) * (1 - t * t * (3 - 2 * t));
}
export function avatarWidthSlope(y: number, build: number) {
  if (y <= .90 || y >= 1.04) return 0;
  const t = (y - .90) / .14;
  return -(build - 1) * 6 * t * (1 - t) / .14;
}

/** Construction-time transform only. Geometry and absolute joint positions share this map. */
export function sizeAvatarPoint(point: Vector3, dimensions: AvatarDimensions, head = false) {
  const width = head ? 1 : avatarWidthAtHeight(point.y, dimensions.bodyBuild);
  point.x *= width * dimensions.heightScale;
  point.y *= dimensions.heightScale;
  point.z *= width * dimensions.heightScale;
  return point;
}
