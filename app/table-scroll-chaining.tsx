'use client';
import {useEffect} from 'react';
import {reducedMotion} from '../lib/motion';
const tables='.attendance-table-scroll,.comparison-table-scroll,.roster-rows-scroll,.person-attendance-table-scroll';
/** Smoothly hand wheel movement at a table boundary to the page, without trapping it. */
export default function TableScrollChaining(){
 useEffect(()=>{
  let frame=0,motion:{node:HTMLElement;to:number;direction:number;last:number}|null=null;
  const stop=()=>{cancelAnimationFrame(frame);frame=0;motion=null;};
  const tick=(now:number)=>{if(!motion)return;const {node,to,last}=motion,gap=to-node.scrollTop;const step=Math.abs(gap)<.5?gap:gap*(1-Math.exp(-Math.min(40,Math.max(1,now-last))/65));const before=node.scrollTop;node.scrollTo({top:before+step,behavior:'instant'});motion.last=now;if(Math.abs(to-node.scrollTop)<.5||node.scrollTop===before){node.scrollTo({top:to,behavior:'instant'});stop();return;}frame=requestAnimationFrame(tick);};
  const wheel=(event:WheelEvent)=>{
   if(event.ctrlKey||event.shiftKey||!event.deltaY||Math.abs(event.deltaX)>Math.abs(event.deltaY)||event.defaultPrevented){stop();return;}
   const target=event.target instanceof Element?event.target:null,table=target?.closest<HTMLElement>(tables);
   if(!table||target?.closest('dialog,[role="dialog"],[role="listbox"],[role="menu"]')){stop();return;}
   // Keep native scrolling while an inner field or the table can move.
   for(let node=target;node;node=node.parentElement){const style=getComputedStyle(node),max=node.scrollHeight-node.clientHeight;if(/auto|scroll/.test(style.overflowY)&&max>1&&(event.deltaY<0?node.scrollTop>1:node.scrollTop<max-1)){stop();return;}if(node===table)break;}
   const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?table.clientHeight:1),direction=Math.sign(delta);
   let destination:HTMLElement|null=null;
   for(let node=table.parentElement;node;node=node.parentElement){const max=node.scrollHeight-node.clientHeight;if((node===document.scrollingElement||/auto|scroll/.test(getComputedStyle(node).overflowY))&&max>1&&(direction<0?node.scrollTop>1:node.scrollTop<max-1)){destination=node;break;}}
   if(!destination){stop();return;}event.preventDefault();
   const max=destination.scrollHeight-destination.clientHeight;
   if(reducedMotion()){stop();destination.scrollTo({top:Math.max(0,Math.min(max,destination.scrollTop+delta)),behavior:'instant'});return;}
   if(!motion||motion.node!==destination){stop();motion={node:destination,to:destination.scrollTop,direction,last:performance.now()};}
   if(motion.direction!==direction)motion.to=destination.scrollTop;
   motion.direction=direction;motion.to=Math.max(0,Math.min(max,motion.to+delta));
   if(!frame)frame=requestAnimationFrame(tick);
  };
  document.addEventListener('wheel',wheel,{passive:false});document.addEventListener('pointerdown',stop,{passive:true});document.addEventListener('keydown',stop);
  return()=>{stop();document.removeEventListener('wheel',wheel);document.removeEventListener('pointerdown',stop);document.removeEventListener('keydown',stop);};
 },[]);
 return null;
}
