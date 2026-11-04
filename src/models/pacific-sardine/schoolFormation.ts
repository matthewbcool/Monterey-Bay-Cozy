import { Euler, Matrix4, Quaternion, Vector3 } from 'three';

/** A staggered shoal, not an O(n²) flock simulation. Coordinates are in metres. */
export function createSchoolFormation(capacity: number, length: number) {
  const offsets = new Float32Array(capacity * 3), phases = new Float32Array(capacity);
  const position = new Vector3(), rotation = new Euler(0, 0, 0, 'YZX');
  const quaternion = new Quaternion(), scale = new Vector3(1, 1, 1);
  const matrix = new Matrix4();
  function reset(count: number) {
    const columns = Math.max(1, Math.ceil(Math.cbrt(count) * 1.6));
    const layers = Math.max(1, Math.round(Math.cbrt(count) * .55));
    const rows = Math.max(1, Math.ceil(count / (columns * layers)));
    for (let i = 0; i < count; i++) {
      const phase = i * 2.399963229728653;
      phases[i] = phase % (Math.PI * 2);
      offsets[i * 3] = ((i % columns - (columns - 1) / 2) * 1.36 + Math.sin(phase) * .15) * length;
      offsets[i * 3 + 1] = ((Math.floor(i / columns) % layers - (layers - 1) / 2) * .43 + Math.sin(phase * 1.7) * .06) * length;
      offsets[i * 3 + 2] = ((Math.floor(i / (columns * layers)) - (rows - 1) / 2) * .64 + Math.cos(phase) * .1) * length;
    }
    if (count === 1) offsets.fill(0, 0, 3);
  }
  function pose(index: number, time: number, caught: boolean) {
    const phase = phases[index], sway = caught ? 0 : Math.sin(time * .7 + phase);
    position.fromArray(offsets, index * 3);
    position.y += sway * length * .04;
    position.z += Math.sin(time * .45 + phase) * length * .025 * Number(!caught);
    rotation.set(0, sway * .035, Math.sin(time * .6 + phase) * .015 * Number(!caught));
    quaternion.setFromEuler(rotation);
    return matrix.compose(position, quaternion, scale);
  }
  function remove(index: number, last: number) {
    offsets.copyWithin(index * 3, last * 3, last * 3 + 3); phases[index] = phases[last];
  }
  return { offsets, phases, reset, pose, remove };
}
