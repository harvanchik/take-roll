// Let Safari's trusted click at pointer release activate the native switch.
// No script-generated click, vibration timer, or global input interception.
export function createIosSwipeHaptic(card:HTMLElement,enabled:()=>boolean){
 const label=document.createElement('label');label.className='ios-swipe-haptic';label.setAttribute('aria-hidden','true');
 const input=document.createElement('input');input.type='checkbox';input.setAttribute('switch','');input.tabIndex=-1;input.setAttribute('aria-hidden','true');
 label.appendChild(input);card.appendChild(label);
 let committed=false,pointer:number|null=null;
 input.addEventListener('click',event=>event.stopPropagation());
 label.addEventListener('click',event=>{if(!committed||!enabled())event.preventDefault();committed=false;label.dataset.active='false';});
 return {
  capture(id:number){if(!enabled())return;committed=false;pointer=id;label.dataset.active='true';label.setPointerCapture(id);},
  owns(id:number){return label.hasPointerCapture(id);},
  commit(){committed=enabled();},
  cancel(){committed=false;label.dataset.active='false';if(pointer!==null&&label.hasPointerCapture(pointer))label.releasePointerCapture(pointer);pointer=null;},
  destroy(){label.remove();},
 };
}
