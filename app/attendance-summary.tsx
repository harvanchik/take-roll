'use client';
import {useEffect,useRef,type CSSProperties} from 'react';
import {useNamePreferences} from './name-preferences';
import {attendanceBreakdown,excuseFor,type Event} from '../lib/model';
import {eventStatuses,unexcusedStatus,activeExcuses,type AttendanceSettings} from '../lib/attendance-settings';
import {colorStyle,gradientStyle} from './attendance-style';
export function attendanceTotals(event:Event,c:AttendanceSettings){
 const people=event.participants.filter(p=>!p.removed),statuses=eventStatuses(c,people),excuses=[...c.excuses.filter(e=>c.excuseTypes&&e.active||people.some(p=>excuseFor(p)===e.id)),...(people.some(p=>excuseFor(p)==='unspecified')?activeExcuses({...c,excuseTypes:false}):[])];
 return {people,statuses,excuses,total:people.length,unmarked:people.filter(p=>!p.status).length,excuseCounts:Object.fromEntries(excuses.map(e=>[e.id,people.filter(p=>excuseFor(p)===e.id).length])),counts:[...statuses.map(s=>people.filter(p=>p.status===s.id).length),people.filter(p=>excuseFor(p)).length,people.filter(p=>unexcusedStatus(p.status,c)&&!excuseFor(p)).length]};
}
export default function AttendanceSummary({event,filter,onToggle,collapsed=false,interactive=true}:{event:Event;filter:string[];onToggle:(id:string)=>void;collapsed?:boolean;interactive?:boolean}){
 const {attendance:c}=useNamePreferences(),v=attendanceTotals(event,c),pct=(n:number)=>v.total?Math.round(n/v.total*100):0;
 const statusScroll=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const node=statusScroll.current;if(!node)return;let frame=0,target=node.scrollLeft;
  const reduced=window.matchMedia('(prefers-reduced-motion:reduce)');
  const animate=()=>{const distance=target-node.scrollLeft;if(Math.abs(distance)<.5){node.scrollLeft=target;frame=0;return;}node.scrollLeft+=distance*.2;frame=requestAnimationFrame(animate);};
  const measure=()=>{node.parentElement?.style.setProperty('--status-scroll-space',(node.offsetHeight-node.clientHeight+6)+'px');};
  const observer=new ResizeObserver(measure);observer.observe(node);measure();
  const wheel=(event:WheelEvent)=>{
   if(!window.matchMedia('(min-width:761px)').matches||node.scrollWidth<=node.clientWidth+1||event.ctrlKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
   if(!frame)target=node.scrollLeft;
   const next=Math.max(0,Math.min(node.scrollWidth-node.clientWidth,target+event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?node.clientWidth:1)));
   if(next===target)return;event.preventDefault();target=next;
   if(reduced.matches){node.scrollLeft=target;}else if(!frame)frame=requestAnimationFrame(animate);
  };
  node.addEventListener('wheel',wheel,{passive:false});return()=>{node.removeEventListener('wheel',wheel);observer.disconnect();cancelAnimationFrame(frame);};
 },[]);
 const Card=interactive?'button':'div';
 const primary=v.statuses.map((s,i)=>({id:s.id,name:s.name,color:s.color,count:v.counts[i],split:s.allowExcuse?attendanceBreakdown(event,s.id):null}));
 const unexcused=primary.filter(s=>s.split),excused=v.counts[v.statuses.length],unexcusedTotal=v.counts[v.statuses.length+1];
 const aggregate=(id:string,name:string,count:number,parts:Array<{name:string;color:string;count:number}>)=><Card {...(interactive?{type:'button' as const,'aria-pressed':filter.includes(id),onClick:()=>onToggle(id)}:{})} key={id} className={'stat breakdown attendance-gradient'+(interactive&&filter.includes(id)?' chosen':'')} style={gradientStyle(parts.map(p=>p.color))}><span className={id==='Unexcused'?'stat-title-red':undefined}>{name}</span><strong>{count}</strong><div className="stat-breakdown">{parts.map((part,i)=><small key={i} className="custom-breakdown-color" style={colorStyle(part.color)}><span>{part.name}</span><b>{part.count} · {pct(part.count)}%</b></small>)}<small className="stat-total"><span>Total</span><b>{count} - {pct(count)}%</b></small></div></Card>;
 return <div style={{'--summary-columns':Math.min(5,primary.length)+2,'--visible-statuses':Math.min(5,primary.length),'--status-gaps':(Math.min(5,primary.length)-1)*9+'px'} as CSSProperties} className={'stats-grid custom-stats pinned-summary'+(collapsed?' mobile-stats-collapsed':'')}><div ref={statusScroll} className="status-stat-scroll" role="region" aria-label="Attendance Status Statistics" tabIndex={0}>{primary.map(s=><Card {...(interactive?{type:'button' as const,'aria-pressed':filter.includes(s.id),onClick:()=>onToggle(s.id)}:{})} key={s.id} className={'stat'+(s.split?' breakdown':'')+(interactive&&filter.includes(s.id)?' chosen':'')} style={colorStyle(s.color)}><span>{s.name}{!c.statuses.find(x=>x.id===s.id)?.active?' (Removed)':''}</span><strong>{s.count}</strong><div className="stat-breakdown">{s.split&&<><small className="excused-line"><span>{c.excusedLabel}</span><b>{s.split.withExcuse} · {s.split.withPercent}%</b></small><small className="unexcused-line"><span>Unexcused</span><b>{s.split.withoutExcuse} · {s.split.withoutPercent}%</b></small></>}<small className="stat-total"><span>Total</span><b>{s.count} - {pct(s.count)}%</b></small></div></Card>)}</div>{aggregate('Excused',c.excusedLabel,excused,[...v.excuses].sort((a,b)=>a.id==='academic'?-1:b.id==='academic'?1:0).map(e=>({name:e.name,color:e.color,count:v.excuseCounts[e.id]})))}{aggregate('Unexcused','Unexcused',unexcusedTotal,unexcused.map(s=>({name:s.name,color:s.color,count:s.split!.withoutExcuse})))}</div>;
}
