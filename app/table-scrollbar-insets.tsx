'use client';
import {useEffect} from 'react';
/** Keep native table scrollbar tracks below the measured header, including wrapped headings. */
export default function TableScrollbarInsets(){useEffect(()=>{
 const headers=new Map<HTMLElement,HTMLElement>();let frame=0;
 const measure=(header:HTMLElement,scroller:HTMLElement)=>{scroller.dataset.tableHeaderScroll='true';scroller.style.setProperty('--table-header-scroll-inset',Math.ceil(header.getBoundingClientRect().height)+'px');};
 const resize=new ResizeObserver(entries=>entries.forEach(({target})=>{const header=target as HTMLElement,scroller=headers.get(header);if(scroller)measure(header,scroller);}));
 const scan=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
  for(const header of document.querySelectorAll<HTMLElement>('.table-label,.roster-table-head,.csv-preview-head,table thead')){
   if(header.closest('.app-calendar'))continue;
   let scroller=header.parentElement;while(scroller&&scroller!==document.body&&!/auto|scroll/.test(getComputedStyle(scroller).overflowY))scroller=scroller.parentElement;
   if(!scroller||scroller===document.body||scroller===document.documentElement)continue;
   if(headers.get(header)!==scroller){resize.unobserve(header);headers.set(header,scroller);resize.observe(header);}measure(header,scroller);
  }
  for(const [header,scroller] of headers)if(!header.isConnected||!scroller.isConnected){resize.unobserve(header);headers.delete(header);if(![...headers.values()].includes(scroller)){delete scroller.dataset.tableHeaderScroll;scroller.style.removeProperty('--table-header-scroll-inset');}}
 });};
 const observer=new MutationObserver(scan);observer.observe(document.body,{subtree:true,childList:true});scan();
 return()=>{observer.disconnect();resize.disconnect();cancelAnimationFrame(frame);for(const scroller of headers.values()){delete scroller.dataset.tableHeaderScroll;scroller.style.removeProperty('--table-header-scroll-inset');}};
},[]);return null;}
