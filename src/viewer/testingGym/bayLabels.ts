/** DOM labels for the Gym's regional inspection view; no scene meshes or frame timer. */
import { Vector3, type PerspectiveCamera } from 'three';
import type { createGymBayExtension } from './bayExtension';

export function createGymBayLabels(host: HTMLElement, camera: PerspectiveCamera,
  bay: ReturnType<typeof createGymBayExtension>, focus: (id: string) => void) {
  const layer = document.createElement('div');
  layer.className = 'bay-place-labels gym-bay-place-labels';
  layer.setAttribute('aria-label', 'Monterey Bay places');
  layer.hidden = true;
  host.append(layer);
  const labels = bay.places.map(place => {
    const button = document.createElement('button');
    button.className = 'bay-place-label';
    button.textContent = place.name;
    button.title = `View ${place.name}`;
    button.addEventListener('click', () => focus(place.id));
    layer.append(button);
    return { button, point: bay.point(place.longitude, place.latitude) };
  });
  const projected = new Vector3(), occupied: { x: number; y: number; width: number }[] = [];
  let lastCamera = '', lastSize = '';
  return {
    update(show: boolean) {
      if (!show) { layer.hidden = true; return; }
      layer.hidden = false;
      const width = host.clientWidth, height = host.clientHeight;
      const cameraKey = [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements].join(',');
      const sizeKey = `${width}x${height}`;
      if (cameraKey === lastCamera && sizeKey === lastSize) return;
      lastCamera = cameraKey; lastSize = sizeKey; occupied.length = 0;
      for (const { button, point } of labels) {
        projected.copy(point); projected.y += 40; projected.project(camera);
        const x = (projected.x * .5 + .5) * width, y = (-projected.y * .5 + .5) * height;
        const labelWidth = button.textContent!.length * 6.7 + 24;
        const overlap = occupied.some(item => Math.abs(item.x - x) < (item.width + labelWidth) / 2 + 8 && Math.abs(item.y - y) < 32);
        button.hidden = projected.z < -1 || projected.z > 1 || x < labelWidth / 2 + 8 || x > width - labelWidth / 2 - 8 || y < 75 || y > height - 38 || overlap;
        if (!button.hidden) { occupied.push({ x, y, width: labelWidth }); button.style.left = `${x}px`; button.style.top = `${y}px`; }
      }
    },
    dispose() { layer.remove(); },
  };
}
