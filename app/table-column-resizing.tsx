'use client';
import {useEffect} from 'react';
import {moveColumnStart} from '../lib/table-column-widths';
const storageKey='take-roll.table-widths.v1';
type Widths=Record<string,Record<string,number>>;
/** Shared browser-only sizing for both CSS-grid and semantic tables. */
export default function TableColumnResizing(){useEffect(()=>{
 let widths:Widths={};try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');if(saved&&typeof saved==='object')widths=saved;}catch{}
 let frame=0;const cleanups:(()=>void)[]=[],known=new WeakSet<Element>(),signatures=new WeakMap<Element,string>();
 const resets=new Map<HTMLElement,{key:string;reset:()=>void}>();
 const scan=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
 for(const header of resets.keys())if(!header.isConnected)resets.delete(header);
 document.querySelectorAll<HTMLElement>('.table-label,.roster-table-head,.csv-preview-head,table thead tr').forEach(header=>{
  if(header.closest('.settings-attendance-preview,.app-calendar,[role="grid"]'))return;
  const native=header.tagName==='TR',table= native?header.closest('table')!:header.parentElement!;
  const cells=[...header.children].filter((n):n is HTMLElement=>n instanceof HTMLElement&&getComputedStyle(n).display!=='none');
  const labels=cells.map(n=>(n.textContent||'').trim().replace(/\s+/g,' '));
  const kind=native?(table.closest('.comparison-table-scroll')?'overview':table.closest('.compare-table-scroll')?'compare':table.closest('.person-attendance-table-scroll')?'record':'table'):header.matches('.roster-table-head')?'roster':'roll-call';
  const rollCall=header.matches('.table-label')&&table.matches('.attendance-table-scroll');
  const key=(rollCall?'roll-call-v2':header.matches('.csv-preview-head')?'csv':kind)+':'+labels.join('|');if(signatures.has(header)&&signatures.get(header)!==key){cells.forEach(cell=>{cell.querySelector('.column-resize-handle')?.remove();known.delete(cell);});if(!native)table.querySelectorAll<HTMLElement>('.table-label,.row-main,.roster-table-head,.roster-person-main,.csv-preview-row').forEach(row=>{row.style.removeProperty('grid-template-columns');row.style.removeProperty('min-width');});}signatures.set(header,key);const saved=widths[key];
  const maximum=(column:number)=>{
   if(/^Last Changed$/i.test(labels[column]))return 155;
   if(/^(Sessions|Attended|Unexcused Absences|Excused|Attendance Rate)$/i.test(labels[column]))return 120;
   return Infinity;
  };
  const compactWidths=(values:number[])=>{
   const next=[...values];
   const notes=labels.indexOf('Notes');
   const textColumn=labels.findIndex(label=>label==='Pronunciation');
   const fallback=labels.findIndex(label=>/^(Full Name|Event|Note)$/i.test(label));
   for(let i=1;i<next.length;i++){
    const surplus=next[i]-maximum(i);
    if(surplus<=0)continue;
    const destination=textColumn>=0&&labels[i]!=='Last Changed'?textColumn:notes>=0?notes:fallback;
    if(destination>=0)next[destination]+=surplus;
    next[i]-=surplus;
   }
   return next;
  };
  resets.set(header,{key,reset:()=>{
   if(native){
    table.querySelector('colgroup[data-resize-columns]')?.remove();
    delete table.dataset.columnsResized;
    for(const property of ['table-layout','width','min-width'])table.style.removeProperty(property);
   }else{
    table.querySelectorAll<HTMLElement>('.table-label,.row-main,.roster-table-head,.roster-person-main,.csv-preview-row').forEach(row=>{
     row.style.removeProperty('grid-template-columns');
     row.style.removeProperty('min-width');
     if(table.classList.contains('removed-roster-table'))for(const child of row.children){
      if(!(child instanceof HTMLElement))continue;
      for(const property of ['grid-column','grid-row','margin-right','width'])child.style.removeProperty(property);
     }
    });
   }
  }});
  const apply=(values:number[])=>{
   values=compactWidths(values);
   if(native){table.dataset.columnsResized='true';table.style.tableLayout='fixed';table.style.width=values.reduce((a,b)=>a+b,0)+'px';table.style.minWidth='100%';let group=table.querySelector<HTMLTableColElement>('colgroup[data-resize-columns]');if(!group){group=document.createElement('colgroup');group.dataset.resizeColumns='true';table.insertBefore(group,table.firstChild);}while(group.children.length<values.length)group.appendChild(document.createElement('col'));[...group.children].forEach((col,i)=>(col as HTMLElement).style.width=values[i]+'px');}
   else{const tracks=values.map(v=>v+'px').join(' '),style=getComputedStyle(header),gap=parseFloat(style.columnGap)||0,padding=(parseFloat(style.paddingLeft)||0)+(parseFloat(style.paddingRight)||0);table.querySelectorAll<HTMLElement>(header.matches('.csv-preview-head')?'.csv-preview-row':header.matches('.roster-table-head')?'.roster-table-head,.roster-person-main':'.table-label,.row-main').forEach(row=>{row.style.setProperty('grid-template-columns',tracks,'important');if(table.classList.contains('removed-roster-table'))[...row.children].filter(child=>getComputedStyle(child).display!=='none').forEach((child,i)=>{const el=child as HTMLElement;el.style.setProperty('grid-column',String(i+1),'important');el.style.setProperty('grid-row','1','important');el.style.setProperty('margin-right','0','important');el.style.setProperty('width','auto','important');});row.style.setProperty('min-width',values.reduce((a,b)=>a+b,0)+gap*(values.length-1)+padding+'px','important');});}
  };
  if(saved){const values=cells.map((cell,i)=>{const v=saved[labels[i]+'|'+i];return typeof v==='number'&&Number.isFinite(v)&&v>=24&&v<=1600?v:cell.getBoundingClientRect().width;});apply(values);}
  cells.forEach((cell,index)=>{const bounds=header.getBoundingClientRect(),cellBounds=cell.getBoundingClientRect();cell.style.setProperty('--column-header-height',bounds.height+'px');cell.style.setProperty('--column-header-offset',(bounds.top-cellBounds.top)+'px');
   if(index===0||!labels[index]||!labels[index-1]||/^(flag|actions?)$/i.test(labels[index])||/^(#|no\.?|rank|number|flag|actions?)$/i.test(labels[index-1])||known.has(cell))return;
   known.add(cell);cell.classList.add('resizable-column-heading');const handle=document.createElement('span');handle.className='column-resize-handle';handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-label','Resize '+labels[index]+' column');handle.tabIndex=0;handle.setAttribute('aria-valuemin',labels[index]==='#'?'28':'60');handle.setAttribute('aria-valuemax',String(Math.round(cell.getBoundingClientRect().width+cells[index-1].getBoundingClientRect().width-60)));handle.setAttribute('aria-valuenow',String(Math.round(cell.getBoundingClientRect().width)));cell.appendChild(handle);
   const commit=(values:number[])=>{values=compactWidths(values);widths[key]=Object.fromEntries(values.map((value,i)=>[labels[i]+'|'+i,Math.round(value)]));try{localStorage.setItem(storageKey,JSON.stringify(widths));}catch{}};
   const limits=(values:number[])=>{
    const minimumFor=(column:number)=>{
     if(!rollCall)return 60;
     if(labels[column]==='Last Changed')return 132;
     if(labels[column]!=='Attendance')return 60;
     let width=60;
     for(const group of table.querySelectorAll<HTMLElement>('.row-main > .status-options')){
      const buttons=[...group.children];
      const gap=parseFloat(getComputedStyle(group).columnGap)||0;
      const content=buttons.reduce((sum,button)=>sum+button.getBoundingClientRect().width,0)+gap*Math.max(0,buttons.length-1);
      width=Math.max(width,Math.ceil(content));
     }
     return width;
    };
    const pairWidth=values[index-1]+values[index];
    return [
     Math.min(values[index-1],Math.max(minimumFor(index-1),pairWidth-maximum(index))),
     Math.min(values[index],Math.max(minimumFor(index),pairWidth-maximum(index-1))),
    ] as const;
   };
   const resize=(event:PointerEvent)=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();let values=cells.map(n=>n.getBoundingClientRect().width);const initial=[...values],start=event.clientX,minimums=limits(initial);let changed=false;handle.dataset.dragging='true';handle.setPointerCapture(event.pointerId);document.documentElement.classList.add('resizing-table-column');
    const move=(e:PointerEvent)=>{values=moveColumnStart(initial,index,e.clientX-start,...minimums);changed=true;apply(values);handle.setAttribute('aria-valuenow',String(Math.round(values[index])));};
    const end=()=>{delete handle.dataset.dragging;handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);document.documentElement.classList.remove('resizing-table-column');if(changed)commit(values);};
    handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
   };
   const keyboard=(e:KeyboardEvent)=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();e.stopPropagation();const initial=cells.map(n=>n.getBoundingClientRect().width);const values=moveColumnStart(initial,index,e.key==='ArrowRight'?10:-10,...limits(initial));apply(values);commit(values);};
   handle.addEventListener('pointerdown',resize);handle.addEventListener('keydown',keyboard);handle.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});cleanups.push(()=>{handle.removeEventListener('pointerdown',resize);handle.removeEventListener('keydown',keyboard);handle.remove();});
  });
 });
 });};
 const resetVisible=(event:KeyboardEvent)=>{
  if(!(event.ctrlKey||event.metaKey)||!event.shiftKey||event.altKey||event.code!=='KeyM')return;
  const visible=[...resets].filter(([header])=>{
   if(!header.isConnected)return false;
   const box=header.getBoundingClientRect();
   return box.width>0&&box.height>0&&box.bottom>0&&box.top<window.innerHeight;
  });
  if(!visible.length)return;
  event.preventDefault();
  for(const [,entry] of visible){delete widths[entry.key];entry.reset();}
  try{localStorage.setItem(storageKey,JSON.stringify(widths));}catch{}
  scan();
 };
 window.addEventListener('keydown',resetVisible);
 const observer=new MutationObserver(scan);observer.observe(document.body,{childList:true,subtree:true});scan();window.addEventListener('resize',scan);
 return()=>{window.removeEventListener('keydown',resetVisible);observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',scan);cleanups.forEach(fn=>fn());document.documentElement.classList.remove('resizing-table-column');};
},[]);return null;}
