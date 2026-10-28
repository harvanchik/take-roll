'use client';
import {useEffect} from 'react';
import {shortcutTooltip} from '../lib/shortcut-hints';
/** Delegated tooltips also work inside native modal dialogs and scrolling panels. */
export default function Tooltips(){
 useEffect(()=>{
  const disabled=(element:HTMLElement)=>!!element.closest(':disabled,[aria-disabled="true"],[data-disabled]');
  let anchor:HTMLElement|null=null,timer:ReturnType<typeof setTimeout>|undefined,tip:HTMLDivElement|null=null,previous:string|null=null;
  const hide=()=>{clearTimeout(timer);tip?.remove();tip=null;if(anchor){if(previous===null)anchor.removeAttribute('aria-describedby');else anchor.setAttribute('aria-describedby',previous);}anchor=null;previous=null;};
  const enter=(event:Event)=>{if((event as PointerEvent).pointerType==='touch'||(event.type==='focusin'&&!window.matchMedia('(any-hover: hover)').matches))return;const target=(event.target as Element)?.closest<HTMLElement>('[data-tooltip]');if(target===anchor&&target&&!disabled(target))return;hide();if(!target?.dataset.tooltip||disabled(target))return;anchor=target;previous=target.getAttribute('aria-describedby');timer=setTimeout(()=>{if(!anchor?.isConnected||disabled(anchor))return;tip=document.createElement('div');tip.id='roll-call-tooltip';tip.className='app-tooltip';tip.role='tooltip';tip.textContent=anchor.dataset.tooltipNote?anchor.dataset.tooltip||'':shortcutTooltip(anchor.dataset.tooltip||'',document.documentElement.dataset.shortcutHints!=='false');if(anchor.dataset.tooltipNote){tip.classList.add('attendance-note-popover');tip.style.setProperty('--note-tone',getComputedStyle(anchor).color);}if(anchor.dataset.tooltipColor){tip.style.background=getComputedStyle(anchor).backgroundColor;tip.style.color='#142336';tip.style.borderColor=tip.style.background;}(anchor.closest<HTMLDialogElement>('dialog')||document.body).appendChild(tip);anchor.setAttribute('aria-describedby',[previous,tip.id].filter(Boolean).join(' '));const r=anchor.getBoundingClientRect(),t=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(innerWidth-t.width-8,r.left+(r.width-t.width)/2))+'px';tip.style.top=Math.max(4,r.top-t.height-10)+'px';},300);};
  const leave=(event:Event)=>{const related=(event as MouseEvent).relatedTarget as Node|null;if(anchor&&related&&anchor.contains(related))return;hide();};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')hide();};
  document.addEventListener('pointerover',enter);document.addEventListener('pointerout',leave);document.addEventListener('focusin',enter);document.addEventListener('focusout',leave);document.addEventListener('pointerdown',hide);document.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);document.addEventListener('keydown',escape);
  return()=>{hide();document.removeEventListener('pointerover',enter);document.removeEventListener('pointerout',leave);document.removeEventListener('focusin',enter);document.removeEventListener('focusout',leave);document.removeEventListener('pointerdown',hide);document.removeEventListener('scroll',hide,true);window.removeEventListener('resize',hide);document.removeEventListener('keydown',escape);};
 },[]);
 return null;
}
