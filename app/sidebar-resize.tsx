'use client';
import {useEffect,useRef,useState} from 'react';
import {PanelLeftOpen} from 'lucide-react';
const MIN=180,MAX=360,SNAP=120;
export default function SidebarResize({hidden,onHidden}:{hidden:boolean;onHidden:(hidden:boolean)=>void}){
 const drag=useRef<{start:number;hidden:boolean}|null>(null),lastWidth=useRef(238);
 const [width,setWidth]=useState(238);
 const root=()=>document.documentElement;
 const actualWidth=()=>document.getElementById('workspace-sidebar')?.getBoundingClientRect().width||lastWidth.current;
 useEffect(()=>{const current=actualWidth();lastWidth.current=current;setWidth(current);},[]);
 const paint=(value:number)=>{root().dataset.sidebar=value<SNAP?'hidden':'visible';if(value>=SNAP)root().style.setProperty('--sidebar-width',`${Math.max(MIN,Math.min(MAX,value))}px`);};
 const commit=(value:number)=>{const closed=value<SNAP;const next=Math.max(MIN,Math.min(MAX,value));if(!closed){lastWidth.current=next;setWidth(next);root().style.setProperty('--sidebar-width',`${next}px`);}root().dataset.sidebar=closed?'hidden':'visible';onHidden(closed);try{localStorage.setItem('roll-call-sidebar',closed?'hidden':'visible');if(!closed)localStorage.setItem('roll-call-sidebar-width',String(next));}catch{}};
 const finish=(cancel=false)=>{const session=drag.current;if(!session)return;const closed=root().dataset.sidebar==='hidden',next=closed?0:actualWidth();delete root().dataset.sidebarResizing;drag.current=null;commit(cancel?(session.hidden?0:session.start):next);};
 return <>{hidden&&<button className="sidebar-reopen" aria-label="Open Sidebar" data-tooltip="Open Sidebar" onClick={()=>{let saved=lastWidth.current;try{saved=Number(localStorage.getItem('roll-call-sidebar-width'))||saved;}catch{}commit(saved);}}><PanelLeftOpen size={21}/></button>}<div className="sidebar-resizer" data-tooltip="Resize Sidebar" role="separator" tabIndex={hidden?-1:0} aria-label="Resize Sidebar. Left Arrow Narrows, Right Arrow Widens, Home Closes." aria-controls="workspace-sidebar" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={MAX} aria-valuenow={hidden?0:width} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();const start=actualWidth();drag.current={start,hidden};lastWidth.current=start;root().dataset.sidebarResizing='true';e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(drag.current)paint(e.clientX);}} onPointerUp={()=>finish()} onPointerCancel={()=>finish(true)} onLostPointerCapture={()=>finish()} onKeyDown={e=>{if(e.key==='Escape'&&drag.current){e.preventDefault();finish(true);}else if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const current=actualWidth();commit(e.key==='Home'?0:e.key==='End'?MAX:e.key==='ArrowLeft'?(current<=MIN?0:current-20):current+20);}}}/></>;
}
