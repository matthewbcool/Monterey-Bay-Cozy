import type { Group } from 'three';

export type SwimMode = 'slow' | 'fast';
export type FishLifeState = 'alive' | 'caught';
/** Exactly one controller may place the rigid root at a time. */
export type FishMotionOwner = 'external' | 'path' | 'physics';
export type Point3 = readonly [number, number, number];
export interface FishPhysicsDescriptor {
  /** Dimensions and offsets are metres in rigid-root space, before any caller-applied scaling. */
  readonly colliders: readonly {
    readonly shape: 'capsule'; readonly axis: 'x';
    readonly center: Point3; readonly radius: number;
    /** Half the straight segment; total capsule length = 2 * (halfLength + radius). */
    readonly halfLength: number;
  }[];
  readonly centerOfMass: Point3;
  readonly anchors: Readonly<{ mouth: Point3; grip: Point3 }>;
}
export interface FishState {
  mode: SwimMode;
  lifeState: FishLifeState;
  motionOwner: FishMotionOwner;
  disposed: boolean;
  blend: number;
  phase: number;
  frequency: number;
  finExtension: number;
}
export interface FishModel {
  /** Rigid placement root. Visual animation never changes this transform. */
  root: Group;
  visual: Group;
  parts: Map<string, Group>;
  physics: FishPhysicsDescriptor;
  update(deltaSeconds: number): void;
  setSwimMode(mode: SwimMode, immediate?: boolean): void;
  setLifeState(state: FishLifeState): void;
  setMotionOwner(owner: FishMotionOwner): void;
  /** Returns a snapshot, safe for callers to retain. */
  getState(): FishState;
  dispose(): void;
}
export const FISH_BUDGET = { maxTriangles: 5000, maxDrawCalls: 2 } as const;
