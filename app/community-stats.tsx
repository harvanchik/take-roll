'use client';
import {useEffect,useRef,useState} from 'react';
import {Building2,CalendarDays,ListChecks,Sparkles,UserCheck,type LucideIcon} from 'lucide-react';
import type {PublicStats} from '../lib/public-stats';
import {reducedMotion} from '../lib/motion';
import {statCountAt,STAT_COUNT_DURATION} from '../lib/stat-count';
const rotating=[{key:'absences',label:'Absences Noted',Icon:Sparkles},{key:'tardies',label:'Tardies Recorded',Icon:Sparkles},{key:'present',label:'People Present',Icon:UserCheck}] as const;
function StatNumber({value,animate=true}:{value?:number;animate?:boolean}){
 const element=useRef<HTMLSpanElement>(null),[display,setDisplay]=useState(0);
 useEffect(()=>{
  if(value===undefined)return;
  let frame=0,observer:IntersectionObserver|undefined;
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const finish=()=>{cancelAnimationFrame(frame);setDisplay(value);};
  const start=()=>{observer?.disconnect();if(!animate||reducedMotion()){finish();return;}const started=performance.now();setDisplay(0);
   const tick=(now:number)=>{const elapsed=now-started;setDisplay(statCountAt(value,elapsed));if(elapsed<STAT_COUNT_DURATION)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
  };
  const motionChanged=()=>{if(reducedMotion()){observer?.disconnect();finish();}};
  if(!animate||reducedMotion()||!('IntersectionObserver' in window))start();
  else{observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))start();},{threshold:0.1});if(element.current)observer.observe(element.current);}
  media.addEventListener('change',motionChanged);
  return()=>{observer?.disconnect();cancelAnimationFrame(frame);media.removeEventListener('change',motionChanged);};
 },[value,animate]);
 return <><span className="sr-only">{value===undefined?'Loading':value.toLocaleString('en-US')}</span><span ref={element} aria-hidden="true">{value===undefined?'—':(!animate?value:display).toLocaleString('en-US')}</span></>;
}
function StatContent({Icon,label,value,animate=true}:{Icon:LucideIcon;label:string;value?:number;animate?:boolean}){
 return <div className="community-stat-content"><Icon size={18} aria-hidden="true"/><strong><StatNumber value={value} animate={animate}/></strong><span>{label}</span></div>;
}
export default function CommunityStats(){
 const [stats,setStats]=useState<PublicStats|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{const controller=new AbortController();fetch('/api/stats?v=3',{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();const data=await r.json() as PublicStats;if(!['organizations','events','attendance','absences','tardies','present'].every(key=>Number.isSafeInteger(data[key as keyof PublicStats])&&data[key as keyof PublicStats]>=0))throw Error();setStats(data);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});return()=>controller.abort();},[]);
 return <section className="community-stats auth-card" aria-labelledby="community-stats-title">
  <div className="community-heading"><div><span className="eyebrow">A LITTLE ROLL-CALL CURIOSITY</span><h2 id="community-stats-title">Every Check-In Adds Up.</h2></div></div>
  {failed?<p className="muted">Community stats are taking a break. Check back soon.</p>:<div className="community-grid" aria-busy={!stats}>
   {[{Icon:Building2,label:'Organizations Created',value:stats?.organizations},{Icon:CalendarDays,label:'Events Organized',value:stats?.events},{Icon:ListChecks,label:'Attendance Marks Recorded',value:stats?.attendance}].map(stat=><div className="community-stat" key={stat.label}><StatContent {...stat}/></div>)}
   <div className="community-stat community-stat-rotator">
    {/* Give screen readers all three totals once, without announcing every visual slide. */}
    <span className="sr-only">{rotating.map(stat=>stat.label+': '+(stats?.[stat.key]??'Loading')).join('. ')}</span>
    <div className="community-stat-viewport" aria-hidden="true"><div className={'community-stat-track'+(stats?' is-running':'')}>
     {/* The duplicate first slide makes the end of the loop visually seamless. */}
     {[...rotating,rotating[0]].map((stat,index)=><div className="community-stat-slide" key={index}><StatContent Icon={stat.Icon} label={stat.label} value={stats?.[stat.key]} animate={index===0}/></div>)}
    </div></div>
   </div>
  </div>}
 </section>;
}
