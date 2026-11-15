'use client';
import {reducedMotion} from '../lib/motion';
import {useEffect} from 'react';
const selector='.roster-person-link,.attendance-person-link>strong,.roster-pronunciations,.pronunciation,.person-attendance-page .page-heading h1,.person-record-meta>span,.person-identity-name>strong,.report-person-line>span,.comparison-table-scroll tbody th a,.mobile-card-name h3,.mobile-card-name p,.csv-preview-row:not(.csv-preview-head)>span,a[href*="/person/"]:not(.attendance-person-link)';
export default function PersonTextMarquee(){
 useEffect(()=>{
  const entries=new Map<HTMLElement,{start:number;distance:number}>(),nodes=new Set<HTMLElement>(),reduce=window.matchMedia('(prefers-reduced-motion: reduce)');let frame=0,scanFrame=0;
  const measure=(node:HTMLElement)=>{const distance=node.scrollWidth-node.clientWidth;if(distance>2){if(!entries.has(node))entries.set(node,{start:performance.now(),distance});else entries.get(node)!.distance=distance;}else{entries.delete(node);node.scrollLeft=0;}};
  const resize=new ResizeObserver(values=>values.forEach(value=>measure(value.target as HTMLElement)));
  const scan=()=>{cancelAnimationFrame(scanFrame);scanFrame=requestAnimationFrame(()=>{for(const node of document.querySelectorAll<HTMLElement>(selector)){if(!(node.textContent||'').trim())continue;if(!nodes.has(node)){nodes.add(node);node.classList.add('person-marquee');resize.observe(node);}const text=node.matches('.roster-pronunciations')?Array.from(node.children).map(child=>(child.textContent||'').trim()).filter(Boolean).join(' · '):(node.textContent||'').trim().replace(/\s+/g,' ');node.dataset.tooltip=text;measure(node);}for(const node of nodes)if(!node.isConnected){resize.unobserve(node);nodes.delete(node);entries.delete(node);}});};
  const tick=(now:number)=>{if(!reduce.matches&&!reducedMotion())for(const [node,state] of entries){const rect=node.getBoundingClientRect();if(rect.bottom<0||rect.top>window.innerHeight)continue;const duration=state.distance/25*1000,elapsed=(now-state.start)%(duration+2800),returnAt=duration+2400;if(elapsed<1200)node.scrollLeft=0;else if(elapsed<returnAt)node.scrollLeft=Math.min(state.distance,(elapsed-1200)/1000*25);else{const progress=Math.min(1,(elapsed-returnAt)/400);node.scrollLeft=state.distance*Math.pow(1-progress,3);}}frame=requestAnimationFrame(tick);};
  const observer=new MutationObserver(scan);observer.observe(document.body,{childList:true,subtree:true,characterData:true});scan();frame=requestAnimationFrame(tick);document.fonts.ready.then(scan);
  return()=>{observer.disconnect();resize.disconnect();cancelAnimationFrame(frame);cancelAnimationFrame(scanFrame);};
 },[]);
 return null;
}
