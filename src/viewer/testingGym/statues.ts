import { Group, Matrix4, Mesh, Vector3 } from 'three';
import map from '../../data/lovers-point-gym.json';
import { LOVERS_POINT_ARTWORKS } from '../../data/lovers-point-artworks';
import { createSailingBoyStatue } from '../../models/props/loversPointStatues/boy';
import { createButterflyStatue } from '../../models/props/loversPointStatues/butterfly';
import type { GymCollider } from '../avatarController';
import { groundHeight } from './elevation';

/** Same local equirectangular metre frame as the cached OSM park extraction. */
export function artworkLocalPosition(coordinates: readonly [number, number]) {
  const radians = Math.PI / 180, radius = 6371008.8;
  return new Vector3((coordinates[0] - map.origin[0]) * radians * radius * Math.cos(map.origin[1] * radians), 0,
    -(coordinates[1] - map.origin[1]) * radians * radius);
}

/** Static landmark instances retain identity and independent LOD/culling. The
 * optional eastScale converts to Map Study's projection without scaling roots.
 * Call after map terrain reprojection. As with the surrounding map geometry,
 * the tiny latitude correction is baked once into owned geometry.
 * Caller owns style conversion, LOD registration and resource disposal. */
export function addParkStatues(parent: Group, colliders: GymCollider[], eastScale = 1) {
  return LOVERS_POINT_ARTWORKS.map(record => {
    const object = record.id === 'sailing-boy-statue' ? createSailingBoyStatue() : createButterflyStatue();
    const position = artworkLocalPosition(record.coordinates);
    position.y = groundHeight(position.x, position.z) - .025; // tiny contact overlap on sampled terrain
    object.position.set(position.x * eastScale, position.y, position.z);
    object.rotation.y = record.yawRadians;
    if (eastScale !== 1) {
      // R^-1 S R keeps the world-east correction exact with a rotated local mesh.
      const correction = new Matrix4().makeRotationY(-record.yawRadians)
        .multiply(new Matrix4().makeScale(eastScale, 1, 1)).multiply(new Matrix4().makeRotationY(record.yawRadians));
      object.traverse(part => { if (part instanceof Mesh) part.geometry.applyMatrix4(correction); });
    }
    object.name = `${record.title} · ${record.artist}`;
    object.userData.artwork = record;
    object.userData.placement = { frame: 'Lovers Point local metres', anchor: object.position.toArray(), elevation: 'USGS terrain sample; contact overlap 0.025 m' };
    parent.add(object);
    // Broad immutable footprint is independent of rendered LOD and ready for
    // replacement by an engine-owned static collider in a future world.
    const collider: GymCollider = { kind: 'circle', x: object.position.x, z: object.position.z, radius: record.baseRadiusMeters };
    colliders.push(collider);
    return { record, object, collider, position: object.position.clone() };
  });
}
