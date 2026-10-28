/** Limit gestures only in an installed app on a touch device. Browser zoom stays native. */
export const installedViewportScript=`(()=>{const installed=navigator.maxTouchPoints>0&&(navigator.standalone===true||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches);document.documentElement.dataset.installedMobile=String(installed);if(installed)document.querySelector('meta[name="viewport"]')?.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')})()`;

export function installViewportGuards(win:Window=window,doc:Document=document){
 const standalone=win.matchMedia('(display-mode: standalone)');
 const fullscreen=win.matchMedia('(display-mode: fullscreen)');
 const viewport=doc.querySelector('meta[name="viewport"]');
 const normal='width=device-width, initial-scale=1, viewport-fit=cover';
 const installed=()=>win.navigator.maxTouchPoints>0&&((win.navigator as Navigator&{standalone?:boolean}).standalone===true||standalone.matches||fullscreen.matches);
 const gesture=(event:Event)=>{if(installed()&&event.cancelable)event.preventDefault();};
 const touch=(event:TouchEvent)=>{if(event.touches.length>1)gesture(event);};
 let listening=false;
 const remove=()=>{doc.removeEventListener('gesturestart',gesture);doc.removeEventListener('gesturechange',gesture);doc.removeEventListener('touchstart',touch);listening=false;};
 const sync=()=>{
  const active=installed();doc.documentElement.dataset.installedMobile=String(active);viewport?.setAttribute('content',active?normal+', maximum-scale=1, user-scalable=no':normal);
  if(active&&!listening){doc.addEventListener('gesturestart',gesture,{passive:false});doc.addEventListener('gesturechange',gesture,{passive:false});doc.addEventListener('touchstart',touch,{passive:false});listening=true;}
  else if(!active&&listening)remove();
 };
 sync();standalone.addEventListener('change',sync);fullscreen.addEventListener('change',sync);
 // No touchmove listener: single-finger scrolling stays on the compositor path.
 return()=>{standalone.removeEventListener('change',sync);fullscreen.removeEventListener('change',sync);remove();};
}
