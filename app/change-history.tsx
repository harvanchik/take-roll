'use client';
import {useDisplayDates} from './personal-preferences';
import HorizontalScrollText from './horizontal-scroll-text';
import {historyKindLabel,historyOperation} from '../lib/history-kind';
import {useNamePreferences} from './name-preferences';
import {choiceColor,tone,type AttendanceSettings} from '../lib/attendance-settings';
import type {CSSProperties} from 'react';
import {useState,useLayoutEffect,useRef} from 'react';
import {Clock3,Undo2,Redo2} from 'lucide-react';
import type {Change} from '../lib/model';
export function historyTone(entry:Change){
 const kind=entry.kind.replace(/^(Undo|Redo) · /,'');
 if(kind==='Note')return 'note';
 if(kind==='Flag')return 'flagged';
 if(kind!=='Status'&&kind!=='Excuse')return 'neutral';
 if(entry.to.startsWith('Present'))return 'present';
 if(entry.to.startsWith('Bit Late'))return 'bit-late';
 if(entry.to.startsWith('Tardy'))return 'tardy';
 if(entry.to.startsWith('Absent'))return 'absent';
 if(entry.to.includes('Academic')||entry.to.includes('(A)'))return 'academic';
 if(entry.to.includes('Other')||entry.to.includes('(O)'))return 'other';
 if(entry.to.includes('Work')||entry.to.includes('work')||entry.to.includes('(W)'))return 'work';
 return 'neutral';
}
export function historyStyle(h:Change,c:AttendanceSettings):CSSProperties{
 const kind=h.kind.replace(/^(Undo|Redo) · /,'');
 // Audit badges identify the change type, independently of the resulting flag color.
 if(kind==='Flag')return {'--tone':'#bd2637',backgroundColor:'#bd2637',color:'#fff'} as CSSProperties;
 const id=h.statusId??c.statuses.find(s=>h.to===s.id||h.to.startsWith(s.id+' ·')||h.to===s.name||h.to.startsWith(s.name+' ·'))?.id;
 const reason=h.excuseId??c.excuses.find(e=>h.to.includes('('+e.code+')')||h.to.includes('('+e.name+')')||h.to.includes('('+e.id+')'))?.id;
 return {'--tone':id?choiceColor(id,c):reason?tone(c.excuses.find(e=>e.id===reason)?.color):undefined} as CSSProperties;
}
/** Only attendance values get status ink; notes, flags and unmarked values stay neutral. */
export function historyValueStyle(entry:Change,side:'from'|'to',config:AttendanceSettings):CSSProperties|undefined{
 const kind=entry.kind.replace(/^(Undo|Redo) · /,''),value=entry[side];
 if(!['Status','Excuse'].includes(kind)||!value||value==='Unmarked')return;
 const style=historyStyle({...entry,to:value,statusId:side==='to'?entry.statusId:undefined,excuseId:side==='to'?entry.excuseId:undefined},config) as CSSProperties&{'--tone'?:string};
 return style['--tone']?style:undefined;
}
/** Shared badge presentation for person history and the event-wide table. */
export function HistoryBadges({entry,config}:{entry:Change;config:AttendanceSettings}){
 const operation=historyOperation(entry.kind);
 return <span className="history-badges">{operation&&<b className="history-kind history-operation">{operation==='Undo'?<Undo2 size="1em" aria-hidden="true"/>:<Redo2 size="1em" aria-hidden="true"/>}{operation}</b>}<b className={'history-kind '+historyTone(entry)} style={historyStyle(entry,config)}>{historyKindLabel(entry.kind)}</b></span>;
}
export default function ChangeHistory({entries,name,visibleEntries=4}:{entries:Change[];name:string;visibleEntries?:number}){
 const {formatDay,formatTimestamp}=useDisplayDates();
 const {attendance:config}=useNamePreferences();
 const ref=useRef<HTMLDivElement>(null),[height,setHeight]=useState(168);
 useLayoutEffect(()=>{const list=ref.current;if(!list)return;const first=Array.from(list.children).slice(0,visibleEntries) as HTMLElement[];const measure=()=>{if(first.length)setHeight(Math.ceil(first.reduce((sum,item)=>sum+item.getBoundingClientRect().height,0)));};measure();const observer=new ResizeObserver(measure);first.forEach(item=>observer.observe(item));return ()=>observer.disconnect();},[entries,visibleEntries]);
 return <div className="history"><div className="history-heading"><h4><Clock3 size={14}/>Change History <span>{entries.length}</span></h4></div>{!entries.length?<p className="muted">No changes yet.</p>:<div className="history-scroll" ref={ref} style={{maxHeight:height}} tabIndex={0} aria-label={`Change History for ${name}, scroll for older entries`}>{entries.slice().reverse().map(h=><div className="history-entry" key={h.id}><HorizontalScrollText className="history-change" label="Scroll change details horizontally"><HistoryBadges entry={h} config={config}/><span><span className={historyValueStyle(h,'from',config)?'history-attendance-value':undefined} style={historyValueStyle(h,'from',config)}>{h.from||'(empty)'}</span> <span className="arrow">→</span> <span className={historyValueStyle(h,'to',config)?'history-attendance-value':undefined} style={historyValueStyle(h,'to',config)}>{h.to||'(empty)'}</span></span></HorizontalScrollText><span className="history-meta"><span>by {h.actor?.name?.trim()||h.actor?.email||'Unknown'}</span><time dateTime={h.at}>{formatTimestamp(h.at)}</time></span></div>)}</div>}</div>;
}
