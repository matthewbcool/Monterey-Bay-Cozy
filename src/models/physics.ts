import { Quaternion, Vector3 } from 'three';
import type { FishModel } from './types';

const boundFish=new WeakSet<FishModel>();

/** Implement this tiny adapter with the chosen engine; fill the supplied objects. */
export interface FishRigidBody {
  readWorldPose(position: Vector3, rotation: Quaternion): void;
}

/**
 * Rendering bridge only: no solver, gravity, mass, or engine dependency.
 * The host owns/steps/disposes the rigid body. Call sync after the physics step
 * (or provide an interpolated pose). Uniformly scaled parents are supported;
 * the host must scale collider dimensions into the same world units.
 */
export function bindFishPhysics(fish: FishModel, body: FishRigidBody) {
  if(fish.getState().disposed)throw new Error('Cannot bind a disposed fish');
  if(boundFish.has(fish)||fish.getState().motionOwner==='physics')throw new Error('Fish already has a physics owner');
  const position=new Vector3(),rotation=new Quaternion(),parentRotation=new Quaternion();
  let detached=false;
  boundFish.add(fish);fish.setMotionOwner('physics');
  return {
    sync(){
      const state=fish.getState();
      if(detached||state.disposed||state.motionOwner!=='physics')return;
      body.readWorldPose(position,rotation);
      const parent=fish.root.parent;
      if(parent){
        parent.worldToLocal(position);
        parent.getWorldQuaternion(parentRotation).invert();
        rotation.premultiply(parentRotation);
      }
      fish.root.position.copy(position);fish.root.quaternion.copy(rotation);
    },
    /** Leaves placement external; resuming a route is an explicit host choice. */
    detach(){
      if(detached)return;detached=true;boundFish.delete(fish);
      if(fish.getState().motionOwner==='physics')fish.setMotionOwner('external');
    },
  };
}
