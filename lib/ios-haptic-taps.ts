// Safari 26.5+ requires a real tap on a native switch or its label.
// Keep the original button as the sole accessible control and preserve scrolling.
export function installIosHapticTaps(root:HTMLElement,enabled:()=>boolean){
 const attached=new Map<HTMLButtonElement,{label:HTMLLabelElement;originalPosition:string}>();
 const eligible=(button:HTMLButtonElement)=>enabled()&&!button.disabled&&!button.closest('[inert],[data-haptic="off"],[aria-disabled="true"],fieldset:disabled');
 const remove=(button:HTMLButtonElement)=>{const entry=attached.get(button);if(!entry)return;entry.label.remove();button.style.position=entry.originalPosition;attached.delete(button);};
 const sync=()=>{
  for(const [button,entry] of attached)if(!button.isConnected||!button.contains(entry.label)||!eligible(button))remove(button);
  if(!enabled())return;
  for(const button of root.querySelectorAll<HTMLButtonElement>('button')){
   if(attached.has(button)||!eligible(button))continue;
   const originalPosition=button.style.position;
   if(getComputedStyle(button).position==='static')button.style.position='relative';
   const label=document.createElement('label');
   label.className='ios-haptic-tap';label.setAttribute('aria-hidden','true');
   // Mirror the visible hit area; do not extend taps past rounded corners.
   label.style.setProperty('--haptic-radius',getComputedStyle(button).borderRadius);
   const input=document.createElement('input');input.type='checkbox';input.setAttribute('switch','');input.tabIndex=-1;input.setAttribute('aria-hidden','true');
   // A physical touch on the input itself can swallow scrolling in WebKit.
   // A real tap on its enclosing label forwards activation natively instead.
   input.addEventListener('click',event=>event.stopPropagation());
   label.addEventListener('click',event=>{if(!eligible(button))event.preventDefault();});
   label.appendChild(input);button.appendChild(label);attached.set(button,{label,originalPosition});
  }
 };
 const observer=new MutationObserver(sync);
 observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','aria-disabled','inert','data-haptic']});
 const visibility=()=>{if(!document.hidden)sync();};
 window.addEventListener('haptics:change',sync);window.addEventListener('storage',sync);document.addEventListener('visibilitychange',visibility);
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)');motion.addEventListener('change',sync);
 sync();
 return()=>{observer.disconnect();window.removeEventListener('haptics:change',sync);window.removeEventListener('storage',sync);document.removeEventListener('visibilitychange',visibility);motion.removeEventListener('change',sync);for(const button of attached.keys())remove(button);};
}
