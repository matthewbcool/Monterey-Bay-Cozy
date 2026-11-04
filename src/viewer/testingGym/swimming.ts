import { seafloorHeight } from './seafloor';
import { Vector3 } from 'three';
import { insidePolygon, type GymBounds, type GymPoint } from '../avatarController';
import { accessHeight, ACCESS_SURFACES } from './access';
import { GYM_GROUND_CLEARANCE, GYM_WATER_LEVEL } from './elevation';

/** Movement uses the same surveyed seafloor mesh as rendering; the coastal join is authored. */
export const GYM_SWIMMING = { start: { x: 75, z: -48 } } as const;

export const GYM_SWIM_BOUNDS: GymBounds = { minX: -100, maxX: 320, minZ: -230, maxZ: 130 };

/** The paved east-beach stair and its authored landing supply the dry approach.
 * These waypoints describe an exercise route, not a new navigation system. */
export const GYM_SWIM_APPROACH: readonly GymPoint[] = [[56, -57.5], [72, -57.5], [68.6, -49.8], [73, -48], [75, -48]];

/** Water classification uses mapped land membership, not an elevation threshold:
 * the low beach, pool, court and building footprints never become ocean simply
 * because a terrain value changes. The coast is an internal walking/wading seam.
 * The caller retains static object collision and enforces the finite water bounds. */
export function createGymSwimming({ land }: { coast: readonly GymPoint[]; land: readonly GymPoint[] }) {
  const bounds: GymBounds = { ...GYM_SWIM_BOUNDS };
  function inBounds(x: number, z: number) {
    return Number.isFinite(x) && Number.isFinite(z) && x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
  }
  function surfaceHeight(x: number, z: number): number | undefined {
    return inBounds(x, z) && !insidePolygon(x, z, land) ? GYM_WATER_LEVEL : undefined;
  }
  function swimGroundHeight(x: number, z: number): number {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return NaN;
    if (insidePolygon(x, z, land)) return accessHeight(x, z);
    // Preserve the actual raised concrete pier where it projects over water.
    // Swimming under or through a rendered access slab is not part of this prototype.
    for (const s of ACCESS_SURFACES) {
      const dx = x - s.x, dz = z - s.z;
      if (Math.abs(dx * s.dx + dz * s.dz) <= s.length / 2 + .005 && Math.abs(-dx * s.dz + dz * s.dx) <= s.width / 2)
        return accessHeight(x, z);
    }
    return seafloorHeight(x,z);
  }
  const swimStart = new Vector3(GYM_SWIMMING.start.x, accessHeight(GYM_SWIMMING.start.x, GYM_SWIMMING.start.z) + GYM_GROUND_CLEARANCE, GYM_SWIMMING.start.z);
  const swimDirection = new Vector3(1, 0, 0);
  return { swimming: { surfaceHeight, bounds }, swimGroundHeight, swimStart, swimDirection };
}
