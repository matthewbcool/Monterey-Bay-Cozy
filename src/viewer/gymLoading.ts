/** Shared by the lightweight tab bootstrap and the lazy Gym owner. No scene dependencies. */
export function setGymLoading(host:HTMLElement,message:string,state:'loading'|'error'|'ready'='loading'){
 let overlay=host.querySelector<HTMLElement>('.gym-loading');
 const layout=host.querySelector<HTMLElement>('.gym-layout');
 host.setAttribute('aria-busy',String(state==='loading'));if(layout)layout.inert=state!=='ready';
 host.dataset.gymLoad=state;
 if(state==='ready'){overlay?.remove();return;}
 if(!overlay){
  overlay=document.createElement('div');overlay.className='gym-loading';
  overlay.innerHTML='<div class="gym-loading-card"><span class="gym-loading-wave" aria-hidden="true">≈</span><h2>Loading Testing Gym</h2><p class="gym-loading-message" role="status" aria-live="polite"></p><progress aria-label="Preparing the Testing Gym"></progress><small>Your character will be ready to explore when the scene appears.</small><button type="button" hidden>Reload page</button></div>';
  overlay.querySelector('button')!.onclick=()=>location.reload();host.append(overlay);
 }
 overlay.dataset.state=state;overlay.querySelector('h2')!.textContent=state==='error'?'The Gym couldn’t load':'Loading Testing Gym';
 overlay.querySelector('.gym-loading-message')!.textContent=message;
 overlay.querySelector('progress')!.hidden=state==='error';overlay.querySelector('small')!.hidden=state==='error';overlay.querySelector('button')!.hidden=state!=='error';
}
/** Give the loading message a paint opportunity before synchronous procedural construction. */
export const paintLoadingStage=()=>new Promise<void>(resolve=>setTimeout(resolve,40));
