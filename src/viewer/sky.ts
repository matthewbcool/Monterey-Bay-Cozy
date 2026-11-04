import { BackSide, Color, Float32BufferAttribute, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import { STYLE } from '../models/shared/style';

type SkyColors = { zenith: Color; horizon: Color; below: Color };

/** One-draw gradient dome (~550 triangles, no texture). It follows the camera, so it never clips the scene. */
export function createSky(radius = 150) {
  const geometry = new SphereGeometry(radius, 24, 12);
  geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));
  const material = new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false });
  const root = new Mesh(geometry, material);
  root.name = 'Gradient sky dome'; root.renderOrder = -1; root.frustumCulled = false;
  const color = new Color();
  function setColors({ zenith, horizon, below }: SkyColors) {
    const position = geometry.attributes.position, colors = geometry.attributes.color.array as Float32Array;
    for (let i = 0; i < position.count; i++) {
      const h = position.getY(i) / radius;
      // Wide warm band at the horizon, then a clear blue lift toward the zenith.
      if (h >= 0) color.copy(horizon).lerp(zenith, Math.pow(h, .55));
      else color.copy(horizon).lerp(below, Math.min(1, Math.pow(-h * 1.6, .7)));
      color.toArray(colors, i * 3);
    }
    geometry.attributes.color.needsUpdate = true;
  }
  setColors(STYLE.dome);
  return { root, setColors, dispose() { geometry.dispose(); material.dispose(); root.removeFromParent(); } };
}
