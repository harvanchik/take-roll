'use client';
import {useEffect} from 'react';

const tables='.attendance-table-scroll,.comparison-table-scroll,.roster-rows-scroll,.person-attendance-table-scroll';
/** Explicitly pass wheel movement beyond a table to its scrollable ancestors. */
export default function TableScrollChaining(){
 useEffect(()=>{
  const wheel=(event:WheelEvent)=>{
   if(event.ctrlKey||event.shiftKey||!event.deltaY||Math.abs(event.deltaX)>Math.abs(event.deltaY)||event.defaultPrevented)return;
   const target=event.target instanceof Element?event.target:null,table=target?.closest<HTMLElement>(tables);
   if(!table||target?.closest('dialog,[role="dialog"],[role="listbox"],[role="menu"]'))return;
   // Keep native scrolling while any inner field or the table can move.
   for(let node=target;node;node=node.parentElement){
    const style=getComputedStyle(node),max=node.scrollHeight-node.clientHeight;
    if(/auto|scroll/.test(style.overflowY)&&max>1&&(event.deltaY<0?node.scrollTop>1:node.scrollTop<max-1))return;
    if(node===table)break;
   }
   event.preventDefault();
   let delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?table.clientHeight:1);
   for(let node=table.parentElement;node;node=node.parentElement){
    if(node===document.scrollingElement)break;
    const max=node.scrollHeight-node.clientHeight;
    if(!/auto|scroll/.test(getComputedStyle(node).overflowY)||max<=0)continue;
    const before=node.scrollTop;node.scrollTop=Math.max(0,Math.min(max,before+delta));delta-=node.scrollTop-before;
    if(Math.abs(delta)<1){event.preventDefault();return;}
   }
   const page=document.scrollingElement;if(page){const before=page.scrollTop;window.scrollBy({top:delta,behavior:'instant'});if(page.scrollTop!==before)event.preventDefault();}
  };
  document.addEventListener('wheel',wheel,{passive:false});return()=>document.removeEventListener('wheel',wheel);
 },[]);
 return null;
}
