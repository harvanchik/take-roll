'use client';
import {useEffect} from 'react';
import {menuPlacement} from '../lib/menu-placement';
/** Native top-layer placement keeps legacy details menus out of clipped scrolling parents. */
export default function ViewportMenus(){
 useEffect(()=>{
  const open=new Map<HTMLDetailsElement,{menu:HTMLElement;original:string|null;popover:string|null;observer:ResizeObserver;width?:number}>();let frame=0;
  const position=(details:HTMLDetailsElement,menu:HTMLElement)=>{
   const anchor=details.querySelector('summary');if(!anchor||!details.open)return;
   const visual=window.visualViewport,viewport={left:visual?.offsetLeft??0,top:visual?.offsetTop??0,width:visual?.width??window.innerWidth,height:visual?.height??window.innerHeight};
   const size=menu.getBoundingClientRect(),entry=open.get(details);if(entry&&!entry.width)entry.width=size.width;const placement=menuPlacement(anchor.getBoundingClientRect(),{width:entry?.width??size.width,height:menu.scrollHeight+menu.offsetHeight-menu.clientHeight},viewport);
   Object.assign(menu.style,{position:'fixed',inset:'auto',margin:'0',left:placement.left+'px',top:placement.top+'px',width:placement.width+'px',minWidth:'0',maxWidth:Math.max(0,viewport.width-16)+'px',maxHeight:placement.maxHeight+'px',overflowY:'auto',overscrollBehavior:'contain',boxSizing:'border-box',zIndex:'400'});
  };
  const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>open.forEach(({menu},details)=>{if(!details.isConnected)release(details);else position(details,menu);}));};
  const release=(details:HTMLDetailsElement)=>{const entry=open.get(details);if(!entry)return;entry.observer.disconnect();try{entry.menu.hidePopover?.();}catch{}if(entry.original===null)entry.menu.removeAttribute('style');else entry.menu.setAttribute('style',entry.original);if(entry.popover===null)entry.menu.removeAttribute('popover');else entry.menu.setAttribute('popover',entry.popover);open.delete(details);};
  const toggle=(event:Event)=>{
   const details=event.target;if(!(details instanceof HTMLDetailsElement))return;
   const menu=details.querySelector<HTMLElement>(':scope > .mark-menu,:scope > .attendance-color-options');if(!menu)return;
   if(!details.open){release(details);return;}if(open.has(details)){update();return;}
   for(const other of open.keys())if(!other.contains(details)){other.open=false;release(other);}
   const original=menu.getAttribute('style'),popover=menu.getAttribute('popover'),observer=new ResizeObserver(update);open.set(details,{menu,original,popover,observer});
   if(menu.showPopover){menu.setAttribute('popover','manual');try{menu.showPopover();}catch{}}
   position(details,menu);observer.observe(menu);observer.observe(details.querySelector('summary')!);
  };
  const outside=(event:PointerEvent)=>{for(const details of open.keys())if(!details.contains(event.target as Node)){details.open=false;release(details);}};
  const escape=(event:KeyboardEvent)=>{if(event.key!=='Escape'||!open.size)return;event.preventDefault();event.stopImmediatePropagation();for(const details of open.keys()){details.open=false;release(details);details.querySelector('summary')?.focus();}};
  const mutations=new MutationObserver(()=>{for(const details of open.keys())if(!details.isConnected)release(details);});mutations.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('toggle',toggle,true);document.addEventListener('pointerdown',outside,true);window.addEventListener('keydown',escape,true);window.addEventListener('resize',update);document.addEventListener('scroll',update,true);window.visualViewport?.addEventListener('resize',update);window.visualViewport?.addEventListener('scroll',update);
  return()=>{mutations.disconnect();cancelAnimationFrame(frame);document.removeEventListener('toggle',toggle,true);document.removeEventListener('pointerdown',outside,true);window.removeEventListener('keydown',escape,true);window.removeEventListener('resize',update);document.removeEventListener('scroll',update,true);window.visualViewport?.removeEventListener('resize',update);window.visualViewport?.removeEventListener('scroll',update);for(const details of open.keys())release(details);};
 },[]);
 return null;
}
