'use client';
import {useEffect} from 'react';
import {moveColumnStart} from '../lib/table-column-widths';
const storageKey='take-roll.table-widths.v1';
type Widths=Record<string,Record<string,number>>;
/** Shared browser-only sizing for both CSS-grid and semantic tables. */
export default function TableColumnResizing(){useEffect(()=>{
 let widths:Widths={};try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');if(saved&&typeof saved==='object')widths=saved;}catch{}
 let frame=0;const cleanups:(()=>void)[]=[],known=new WeakSet<Element>(),signatures=new WeakMap<Element,string>();
 const scan=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
 document.querySelectorAll<HTMLElement>('.table-label,.roster-table-head,.csv-preview-head,table thead tr').forEach(header=>{
  if(header.closest('.settings-attendance-preview,.app-calendar,[role="grid"]'))return;
  const native=header.tagName==='TR',table= native?header.closest('table')!:header.parentElement!;
  const cells=[...header.children].filter((n):n is HTMLElement=>n instanceof HTMLElement&&getComputedStyle(n).display!=='none');
  const labels=cells.map(n=>(n.textContent||'').trim().replace(/\s+/g,' '));
  const kind=native?(table.closest('.comparison-table-scroll')?'overview':table.closest('.compare-table-scroll')?'compare':table.closest('.person-attendance-table-scroll')?'record':'table'):header.matches('.roster-table-head')?'roster':'roll-call';
  const key=(header.matches('.csv-preview-head')?'csv':kind)+':'+labels.join('|');if(signatures.has(header)&&signatures.get(header)!==key){cells.forEach(cell=>{cell.querySelector('.column-resize-handle')?.remove();known.delete(cell);});if(!native)table.querySelectorAll<HTMLElement>('.table-label,.row-main,.roster-table-head,.roster-person-main,.csv-preview-row').forEach(row=>{row.style.removeProperty('grid-template-columns');row.style.removeProperty('min-width');});}signatures.set(header,key);const saved=widths[key];
  const apply=(values:number[])=>{
   if(native){table.dataset.columnsResized='true';table.style.tableLayout='fixed';table.style.width=values.reduce((a,b)=>a+b,0)+'px';table.style.minWidth='100%';let group=table.querySelector<HTMLTableColElement>('colgroup[data-resize-columns]');if(!group){group=document.createElement('colgroup');group.dataset.resizeColumns='true';table.insertBefore(group,table.firstChild);}while(group.children.length<values.length)group.appendChild(document.createElement('col'));[...group.children].forEach((col,i)=>(col as HTMLElement).style.width=values[i]+'px');}
   else{const tracks=values.map(v=>v+'px').join(' '),style=getComputedStyle(header),gap=parseFloat(style.columnGap)||0,padding=(parseFloat(style.paddingLeft)||0)+(parseFloat(style.paddingRight)||0);table.querySelectorAll<HTMLElement>(header.matches('.csv-preview-head')?'.csv-preview-row':header.matches('.roster-table-head')?'.roster-table-head,.roster-person-main':'.table-label,.row-main').forEach(row=>{row.style.setProperty('grid-template-columns',tracks,'important');if(table.classList.contains('removed-roster-table'))[...row.children].filter(child=>getComputedStyle(child).display!=='none').forEach((child,i)=>{const el=child as HTMLElement;el.style.setProperty('grid-column',String(i+1),'important');el.style.setProperty('grid-row','1','important');el.style.setProperty('margin-right','0','important');el.style.setProperty('width','auto','important');});row.style.setProperty('min-width',values.reduce((a,b)=>a+b,0)+gap*(values.length-1)+padding+'px','important');});}
  };
  if(saved){const values=cells.map((cell,i)=>{const v=saved[labels[i]+'|'+i];return typeof v==='number'&&Number.isFinite(v)&&v>=24&&v<=1600?v:cell.getBoundingClientRect().width;});apply(values);}
  cells.forEach((cell,index)=>{
   if(index===0||!labels[index]||!labels[index-1]||/^(flag|actions?)$/i.test(labels[index])||/^(flag|actions?)$/i.test(labels[index-1])||known.has(cell))return;
   known.add(cell);cell.classList.add('resizable-column-heading');const handle=document.createElement('span');handle.className='column-resize-handle';handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-label','Resize '+labels[index]+' column');handle.tabIndex=0;handle.setAttribute('aria-valuemin',labels[index]==='#'?'28':'60');handle.setAttribute('aria-valuemax',String(Math.round(cell.getBoundingClientRect().width+cells[index-1].getBoundingClientRect().width-60)));handle.setAttribute('aria-valuenow',String(Math.round(cell.getBoundingClientRect().width)));cell.appendChild(handle);
   const commit=(values:number[])=>{widths[key]=Object.fromEntries(values.map((value,i)=>[labels[i]+'|'+i,Math.round(value)]));try{localStorage.setItem(storageKey,JSON.stringify(widths));}catch{}};
   const minimum=60,previousMinimum=labels[index-1]==='#'?24:60;
   const showGuide=()=>{const scroller=native?table.parentElement!:table,top=handle.getBoundingClientRect().top,bottom=scroller.getBoundingClientRect().bottom;handle.style.setProperty('--column-resize-guide-height',Math.max(handle.clientHeight,bottom-top-1)+'px');};handle.addEventListener('pointerenter',showGuide);handle.addEventListener('focus',showGuide);
   const resize=(event:PointerEvent)=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();let values=cells.map(n=>n.getBoundingClientRect().width);const initial=[...values],start=event.clientX;let changed=false;showGuide();handle.dataset.dragging='true';handle.setPointerCapture(event.pointerId);document.documentElement.classList.add('resizing-table-column');
    const move=(e:PointerEvent)=>{values=moveColumnStart(initial,index,e.clientX-start,previousMinimum,minimum);changed=true;apply(values);handle.setAttribute('aria-valuenow',String(Math.round(values[index])));};
    const end=()=>{delete handle.dataset.dragging;handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);document.documentElement.classList.remove('resizing-table-column');if(changed)commit(values);};
    handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
   };
   const keyboard=(e:KeyboardEvent)=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();e.stopPropagation();const values=moveColumnStart(cells.map(n=>n.getBoundingClientRect().width),index,e.key==='ArrowRight'?10:-10,previousMinimum,minimum);apply(values);commit(values);};
   handle.addEventListener('pointerdown',resize);handle.addEventListener('keydown',keyboard);handle.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});cleanups.push(()=>{handle.removeEventListener('pointerenter',showGuide);handle.removeEventListener('focus',showGuide);handle.removeEventListener('pointerdown',resize);handle.removeEventListener('keydown',keyboard);handle.remove();});
  });
 });
 });};
 const observer=new MutationObserver(scan);observer.observe(document.body,{childList:true,subtree:true});scan();window.addEventListener('resize',scan);
 return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',scan);cleanups.forEach(fn=>fn());document.documentElement.classList.remove('resizing-table-column');};
},[]);return null;}
