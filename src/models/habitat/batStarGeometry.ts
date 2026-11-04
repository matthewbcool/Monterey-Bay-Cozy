import { BufferGeometry, Color, Float32BufferAttribute } from 'three';

/** Indexed radial loft: broad triangular arms, rounded webs and longitudinal dorsal ridges. */
export function buildBatStarBody(diameter: number, rand: () => number, color: 'orange' | 'purple', near = false) {
  const n = 50, positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const base = new Color(color === 'orange' ? '#c76c43' : '#916e8f'), pale = new Color('#dba477'), underside = new Color('#c5b08c');
  const paint = new Color(), cavity = new Color('#946344'), armLengths = Array.from({ length: 5 }, () => .97 + rand() * .06), height = diameter * .11;
  const contactLift = near ? diameter * .019 : 0;
  // Ten outline samples per arm; the gaps are deeper than a generic scalloped disc.
  const outline = [1, .98, .77, .60, .54, .52, .54, .60, .77, .98];
  const angles = [0, 4, 16, 27, 32, 36, 40, 45, 56, 68];
  const angleAt = (i: number) => (Math.floor(i / 10) * 72 + angles[i % 10]) * Math.PI / 180;
  function vertex(x: number, y: number, z: number, tint: Color) { positions.push(x, y, z); colors.push(tint.r, tint.g, tint.b); }
  const radiusAt = (i: number) => diameter * .5 * outline[i % 10] * armLengths[Math.round(i / 10) % 5];
  vertex(0, height + contactLift, 0, base);
  for (const [fraction, level] of [[.60, .65], [1, .11]]) for (let i = 0; i < n; i++) {
    const angle = angleAt(i), radius = radiusAt(i) * fraction;
    const ridge = Math.max(0, Math.cos(angle * 5));
    paint.copy(base).lerp(pale, .025 + rand() * .08 + ridge * .13).lerp(cavity, (1 - ridge) * .12);
    vertex(Math.cos(angle) * radius, contactLift + height * level * (.70 + ridge * .30), Math.sin(angle) * radius, paint);
  }
  const bottomRing = positions.length / 3;
  const bottomFractions = near ? [1, .66, .24] : [1];
  for (const fraction of bottomFractions) for (let i = 0; i < n; i++) {
    const a = angleAt(i), r = radiusAt(i) * fraction;
    const groove = Math.pow(Math.max(0, Math.cos(a * 5)), 10) * (1 - fraction);
    paint.copy(underside).lerp(cavity, groove * .77);
    vertex(Math.cos(a) * r, contactLift + (near ? diameter * .022 * groove : 0), Math.sin(a) * r, paint);
  }
  const bottomCenter = positions.length / 3; vertex(0, contactLift + (near ? diameter * .014 : 0), 0, cavity);
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n; indices.push(0, 1 + next, 1 + i);
    for (let ring = 0; ring < 1; ring++) { const a = 1 + ring * n + i, b = 1 + ring * n + next; indices.push(a, b, a + n, b, b + n, a + n); }
    const a = 1 + n + i, b = 1 + n + next;
    indices.push(a, b, bottomRing + i, b, bottomRing + next, bottomRing + i);
    for (let ring = 0; ring < bottomFractions.length - 1; ring++) {
      const a = bottomRing + ring * n + i, b = bottomRing + ring * n + next;
      indices.push(a, b, a + n, b, b + n, a + n);
    }
    const inner = bottomRing + (bottomFractions.length - 1) * n;
    indices.push(bottomCenter, inner + i, inner + next);
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Thirty short feet, two rows per arm. Buried open tops avoid invisible caps; pads meet Y=0. */
export function buildBatStarFeet(diameter: number) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const cream = new Color('#ded0ac'), stem = new Color('#bba984');
  for (let arm = 0; arm < 5; arm++) for (const fraction of [.30, .52, .72]) for (const row of [-1, 1]) {
    const angle = arm * Math.PI * 2 / 5, along = diameter * .5 * fraction, across = row * diameter * (.018 + (1 - fraction) * .014);
    const x = Math.cos(angle) * along - Math.sin(angle) * across, z = Math.sin(angle) * along + Math.cos(angle) * across;
    const first = positions.length / 3;
    for (const top of [false, true]) for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4, r = diameter * (top ? .0045 : .008);
      positions.push(x + Math.cos(a) * r, top ? diameter * .041 : 0, z + Math.sin(a) * r);
      const c = top ? stem : cream; colors.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < 4; i++) { const a = first + i, b = first + (i + 1) % 4; indices.push(a, a + 4, b, b, a + 4, b + 4); }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
