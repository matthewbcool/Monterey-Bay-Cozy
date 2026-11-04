import { caledoniaFootprint, inCaledonia } from '../mapStudy/caledonia';
/** The coarse bay map is a separate Gym owner so park construction and physics stay local. */
import { createBayRegion, BAY_REGION, sampleRegionalGrid } from '../mapStudy/bayRegion';
import { loversPointFootprint } from '../mapStudy/loversPoint';
import { waterfrontFootprint } from '../mapStudy/waterfront';
import { GYM_GEOGRAPHY, type createTestingGym } from '../testingGym';

const RADIANS_PER_METRE = 180 / (Math.PI * 6371008.8);
const REGIONAL_WATER_LEVEL = -.3;

export function createGymBayExtension(gym: ReturnType<typeof createTestingGym>) {
  const origin = GYM_GEOGRAPHY.origin;
  const region = createBayRegion(origin, [loversPointFootprint(origin), waterfrontFootprint(origin), caledoniaFootprint(origin)]);
  region.root.name = 'Testing Gym · Monterey Bay regional map';
  const local = gym.flightBounds;
  const inLocalStudy = (x: number, z: number) => inCaledonia(x,z) || (x >= -140 && x <= local.maxX && z >= local.minZ && z <= local.maxZ);
  const sourcePoint = (x: number, z: number): [number, number] => [
    origin[0] + x * RADIANS_PER_METRE / Math.cos(origin[1] * Math.PI / 180),
    origin[1] - z * RADIANS_PER_METRE,
  ];
  const floorAt = (x: number, z: number) => {
    if (inLocalStudy(x, z)) return gym.flightFloor(x, z);
    if (region.isLand(x, z)) return region.heightAt(x, z);
    return Math.min(-1, sampleRegionalGrid(BAY_REGION.bathy, ...sourcePoint(x, z)));
  };
  const waterAt = (x: number, z: number) => inLocalStudy(x, z)
    ? gym.flightWater(x, z)
    : region.isLand(x, z) ? undefined : REGIONAL_WATER_LEVEL;
  // Only the detailed local study owns a walking controller and dry-land collisions.
  const canLandAt = (x: number, z: number) => inLocalStudy(x, z);
  const bounds = {
    minX: region.bounds.min.x, maxX: region.bounds.max.x,
    minZ: region.bounds.min.z, maxZ: region.bounds.max.z,
  };
  return { ...region, flightBounds: bounds, floorAt, waterAt, canLandAt };
}
