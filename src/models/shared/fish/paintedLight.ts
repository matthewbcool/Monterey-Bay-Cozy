import { Color } from 'three';
import type { Node } from 'three/webgpu';
import { abs, dot, float, fwidth, max, mix, nodeObject, normalize, smoothstep, uniform, vec3 } from 'three/tsl';
import { STYLE } from '../style';

/** Tuna's painted bands, shared by the viewer and tuna. Fin response is a vertex mask, not a draw. */
export function paintedFishLight(base: Node, normal: Node, matte: Node,
  direction = uniform(STYLE.sun.direction.clone()), shadow = uniform(new Color('#638b9b'))) {
  const paint = nodeObject(base);
  const light = dot(normalize(normal), direction);
  const aa = max(fwidth(light), .035);
  const middle = smoothstep(float(.02).sub(aa), float(.02).add(aa), light);
  const bright = smoothstep(float(.62).sub(aa), float(.62).add(aa), light);
  const body = mix(paint.mul(mix(shadow.mul(.78), vec3(.9), middle)), paint.mul(1.1), bright);
  const fin = paint.mul(float(.86).add(abs(light).mul(.12)));
  return mix(body, fin, matte);
}
