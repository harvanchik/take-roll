'use client';
import {useLayoutEffect,useRef,type ReactNode} from 'react';
/** Give status buttons unused notes space before introducing horizontal scrolling. */
export default function AttendanceTable({children,className=''}:{children:ReactNode;className?:string}){
 const ref=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{const table=ref.current;if(!table)return;let frame=0;
 const measure=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const options=table.querySelector<HTMLElement>('.status-options');if(!options)return;const buttons=[...options.children].filter((child):child is HTMLElement=>child instanceof HTMLElement);const gap=parseFloat(getComputedStyle(options).columnGap)||6;const wanted=Math.ceil(buttons.reduce((sum,b)=>sum+b.getBoundingClientRect().width,0)+Math.max(0,buttons.length-1)*gap+2);const shell=table.closest<HTMLElement>('[data-comments]');const comments=shell?.dataset.comments!=='false',history=shell?.dataset.history!=='false';const base=table.classList.contains('keyboard-entry-table')?430:340;const reserved=28+170+(history?155:0)+(table.classList.contains('removed-table')?80:52)+(comments?140:0)+(3+Number(comments)+Number(history))*10+24;const width=Math.max(base,Math.min(wanted,table.clientWidth-reserved));table.style.setProperty('--attendance-width',width+'px');});};
 const observer=new ResizeObserver(measure);observer.observe(table);const observe=()=>{table.querySelectorAll('.status-options>*').forEach(button=>observer.observe(button));measure();};const mutations=new MutationObserver(observe);mutations.observe(table,{childList:true,subtree:true,characterData:true});observe();return()=>{cancelAnimationFrame(frame);observer.disconnect();mutations.disconnect();};
 },[className]);
 return <div ref={ref} className={'attendance-table-scroll '+className}>{children}</div>;
}
