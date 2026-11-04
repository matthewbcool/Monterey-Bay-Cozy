import { Box3, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import type { SeaOtterModel } from '../habitat/sea-otter/createSeaOtter';
import { buildSeaOtterGeometry } from '../habitat/sea-otter/geometry';
import { defineGeometryLods, type LodLevel } from '../shared/lod/geometry';
import { createToonMaterial } from '../shared/style';

/** Two eight-vertex X marks follow the existing head joint. Their placement is
 * sampled from the actual authored skull, so revisions cannot leave them behind. */
export function createCaughtOtterEyes(otter: SeaOtterModel) {
  function build(source: BufferGeometry) {
  const position = source.attributes.position, index = source.index!;
  const ranges = source.userData.partRanges as { name: string; start: number; count: number }[];
  const head = ranges.find(part => part.name === 'continuous-head-neck-chest-belly-rump');
  const eyes = ranges.filter(part => part.name === 'small-dark-eye');
  if (!head || eyes.length !== 2) throw new Error('Sea otter face components are missing');
  const surfaceGeometry = new BufferGeometry();
  surfaceGeometry.setAttribute('position', position);
  surfaceGeometry.setIndex(Array.from(index.array.slice(head.start, head.start + head.count)));
  const surfaceMaterial = new MeshBasicMaterial({ side: DoubleSide }), surface = new Mesh(surfaceGeometry, surfaceMaterial);
  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0)), vertices: number[] = [], indices: number[] = [];
  const s = otter.dimensions.scale, pivot = otter.rig.pivots[3];
  try {
    for (const eye of eyes) {
      const box = new Box3(), point = new Vector3();
      for (let i = eye.start; i < eye.start + eye.count; i++) box.expandByPoint(point.fromBufferAttribute(position, index.getX(i)));
      const center = box.getCenter(new Vector3());
      for (const slope of [-1, 1]) {
        const along = new Vector3(1, 0, slope).normalize().multiplyScalar(.022 * s);
        const across = new Vector3(-slope, 0, 1).normalize().multiplyScalar(.0032 * s);
        const start = vertices.length / 3;
        for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          point.copy(center).addScaledVector(along, a).addScaledVector(across, b);
          ray.ray.origin.set(point.x, 2 * s, point.z);
          const hit = ray.intersectObject(surface, false)[0];
          if (!hit) throw new Error('Caught sea otter eye misses the skull');
          point.y = hit.point.y + .012 * s;
          point.sub(pivot); vertices.push(point.x, point.y, point.z);
        }
        indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
      }
    }
  } finally { surfaceGeometry.dispose(); surfaceMaterial.dispose(); }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
  }
  const geometry = build(otter.mesh.geometry);
  const variant = (level: LodLevel) => {
    const body = buildSeaOtterGeometry(otter.dimensions.lengthMeters, otter.root.userData.seed, level);
    try { return build(body); } finally { body.dispose(); }
  };
  defineGeometryLods(geometry, () => ({ mid: variant('mid'), far: variant('far') }));
  const mesh = new Mesh(geometry, createToonMaterial({ color: '#181b19', rim: false, name: 'sea-otter-caught-eyes' }));
  mesh.name = 'sea-otter-X-eyes';
  const group = new Group(); group.name = 'caught-details'; group.visible = false; group.add(mesh); otter.rig.bones[3].add(group);
  return group;
}
