'use client';
import {useEffect,useRef,useState} from 'react';
import {scrollbarGeometry,scrollbarPositionToScroll} from '../lib/overlay-scrollbar';

/** The document remains the scroll owner; only its visible desktop scrollbar is overlaid. */
export default function DesktopScrollbar(){
 const [metrics,setMetrics]=useState({max:0,thumb:0,travel:0,offset:0}),track=useRef<HTMLDivElement>(null),drag=useRef<{pointer:number;startY:number;startOffset:number}|null>(null),geometry=useRef(metrics);
 geometry.current=metrics;
 useEffect(()=>{
  const root=document.documentElement,media=window.matchMedia('(min-width: 761px)');let frame=0;
  const refresh=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   if(!media.matches||root.dataset.installedMobile==='true'){delete root.dataset.scrollOverlay;setMetrics(current=>current.max?{max:0,thumb:0,travel:0,offset:0}:current);return;}
   root.dataset.scrollOverlay='active';const scroll=document.scrollingElement??root,next=scrollbarGeometry(root.clientHeight,scroll.scrollHeight,scroll.scrollTop);
   setMetrics(current=>current.max===next.max&&current.thumb===next.thumb&&current.offset===next.offset?current:next);
  });};
  const observer=new ResizeObserver(refresh);observer.observe(document.body);observer.observe(root);
  const attributes=new MutationObserver(refresh);attributes.observe(root,{attributes:true,attributeFilter:['data-installed-mobile']});
  window.addEventListener('scroll',refresh,{passive:true});window.addEventListener('resize',refresh);media.addEventListener('change',refresh);refresh();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();attributes.disconnect();window.removeEventListener('scroll',refresh);window.removeEventListener('resize',refresh);media.removeEventListener('change',refresh);delete root.dataset.scrollOverlay;};
 },[]);
 if(!metrics.max)return null;
 const move=(offset:number)=>window.scrollTo({top:scrollbarPositionToScroll(offset,geometry.current.travel,geometry.current.max),behavior:'instant'});
 return <div ref={track} className="desktop-scrollbar" role="scrollbar" aria-label="Page Scrollbar" aria-controls="workspace-content" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={Math.round(metrics.max)} aria-valuenow={Math.round(metrics.travel?metrics.offset/metrics.travel*metrics.max:0)} tabIndex={0}
  onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();const bounds=event.currentTarget.getBoundingClientRect(),onThumb=(event.target as HTMLElement).closest('.desktop-scrollbar-thumb');if(onThumb){drag.current={pointer:event.pointerId,startY:event.clientY,startOffset:geometry.current.offset};event.currentTarget.setPointerCapture(event.pointerId);}else window.scrollBy({top:event.clientY<bounds.top+geometry.current.offset?-bounds.height:bounds.height,behavior:'instant'});}}
  onPointerMove={event=>{const current=drag.current;if(current?.pointer===event.pointerId)move(current.startOffset+event.clientY-current.startY);}}
  onPointerUp={event=>{if(drag.current?.pointer===event.pointerId)drag.current=null;}}
  onPointerCancel={()=>{drag.current=null;}}
  onKeyDown={event=>{const page=document.documentElement.clientHeight;const delta=event.key==='ArrowDown'?40:event.key==='ArrowUp'?-40:event.key==='PageDown'?page:event.key==='PageUp'?-page:0;if(delta){event.preventDefault();window.scrollBy({top:delta,behavior:'instant'});}else if(event.key==='Home'||event.key==='End'){event.preventDefault();window.scrollTo({top:event.key==='Home'?0:geometry.current.max,behavior:'instant'});}}}>
  <div className="desktop-scrollbar-thumb" style={{height:metrics.thumb,transform:`translateY(${metrics.offset}px)`}}/>
 </div>;
}
