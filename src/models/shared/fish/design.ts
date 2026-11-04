import type { Color } from 'three';

/** Proportions are fractions of total length; builders bake them into metre geometry. */
export type Section = readonly [x: number, y: number, depth: number, width: number];
export type Outline = readonly (readonly [x: number, y: number])[];
export interface FishDesign {
  id: string;
  lengthMeters: number;
  sizeBasis: string;
  source: string;
  profile: readonly Section[];
  segments: readonly [length: number, radial: number];
  eye: readonly [x: number, y: number, radius: number];
  gillX: number;
  pectoral: readonly [x: number, y: number];
  dorsalPivot: readonly [x: number, y: number];
  motion: {
    slowHz: number; fastHz: number;
    slowBend: number; fastBend: number;
    slowTail: number; fastTail: number;
    fastDorsal: number; pectoralOpen: number;
  };
  budget: { triangles: number; drawCalls: number };
}
export interface FishOptions { lengthMeters?: number }
export type BodyPaint = (x: number, height: number, side: number, out: Color) => void;
