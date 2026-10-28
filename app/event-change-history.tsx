'use client';
import {useDisplayDates} from './personal-preferences';
import HorizontalScrollText from './horizontal-scroll-text';
import {useMemo,useState,useRef,type CSSProperties} from 'react';
import {History,ChevronLeft,ChevronRight,ArrowDownUp} from 'lucide-react';
import {eventHistoryRows} from '../lib/event-history';
import {displayName as formatName,type Data,type Event} from '../lib/model';
import {useNamePreferences} from './name-preferences';
import {HistoryBadges,historyValueStyle} from './change-history';
import {useTableSort,sortedRows,SortHeading} from './table-sort';
import {historyKindLabel} from '../lib/history-kind';

export function EventHistoryButton({onClick}:{onClick:()=>void}){return <button type="button" className="small event-history-button" aria-label="View Event Change History" data-tooltip="Event Change History" onClick={onClick}><History size={16} aria-hidden="true"/></button>;}

function HistoryValue({value,label,style}:{value:string;label:string;style?:CSSProperties}){
 return <div className="event-history-value"><span className="event-history-value-label">{label}</span><HorizontalScrollText className={style?'history-attendance-value':undefined} style={style} label={'Scroll '+label+' value horizontally'}>{value||'(empty)'}</HorizontalScrollText></div>;
}

export default function EventChangeHistory({data,event}:{data:Data;event:Event}){
 const {formatDay,formatTimestamp}=useDisplayDates();
 const {settings,attendance:config}=useNamePreferences();
 const rows=useMemo(()=>eventHistoryRows(data,event,person=>formatName(person,settings.nameDisplay)),[data,event.id,settings.nameDisplay]);
 const {sort,toggle}=useTableSort();
 const ordered=sortedRows(rows,sort,(row,key)=>key==='When'?row.timestamp:key==='By'?row.change.actor?.name?.trim()||row.change.actor?.email||'Unknown':key==='For'?row.person:key==='Subevent'?row.subevent:key==='Change'?historyKindLabel(row.change.kind):row.change.from+' '+row.change.to);
 const scroll=useRef<HTMLDivElement>(null),mobileSort=useRef<HTMLDetailsElement>(null);
 const [page,setPage]=useState(0),size=50,pages=Math.ceil(rows.length/size),index=Math.min(page,Math.max(0,pages-1));
 const visible=ordered.slice(index*size,(index+1)*size);
 const columns=[['When',''],['By','history-by'],['For',''],['Subevent','history-subevent'],['Change','history-type'],['From / To','history-values']];
 return <div className="event-change-history">
  <div ref={scroll} className="event-history-scroll" role="region" aria-label="Event Change History Table" tabIndex={0}>
   <table className="event-history-table"><caption className="sr-only">Changes Across This Event and All Its Subevents, Newest First</caption>
    <thead><tr>{columns.map(([column,className])=><th key={column} scope="col" className={className} aria-sort={sort?.key===column?(sort.direction==='asc'?'ascending':'descending'):'none'}><SortHeading column={column} sort={sort} toggle={key=>{toggle(key);setPage(0);scroll.current?.scrollTo({top:0});}}>{column.toUpperCase()}</SortHeading></th>)}</tr></thead>
    <tbody>{visible.map(row=>{const h=row.change,actor=h.actor?.name?.trim()||h.actor?.email||'Unknown';const stamp=row.timestamp?formatTimestamp(h.at):'Unknown Time';const split=stamp.indexOf(',');return <tr key={row.key}>
     <td><time dateTime={row.timestamp?h.at:undefined}>{split<0?stamp:<>{stamp.slice(0,split)}<span>{stamp.slice(split+2)}</span></>}</time><span className="history-mobile-meta">{actor}</span></td>
     <td className="history-by">{actor}</td>
     <td><strong>{row.person}</strong><span className="history-mobile-meta">{row.subevent}</span></td>
     <td className="history-subevent">{row.subevent}</td>
     <td><HistoryBadges entry={h} config={config}/></td>
     <td><HistoryValue value={h.from} label="From" style={historyValueStyle(h,'from',config)}/><HistoryValue value={h.to} label="To" style={historyValueStyle(h,'to',config)}/></td>
    </tr>;})}{!rows.length&&<tr><td colSpan={6} className="event-history-empty">No Changes Yet.</td></tr>}</tbody>
   </table>
  </div>
  <div className="event-history-pagination"><span>{rows.length?`${index*size+1}–${Math.min((index+1)*size,rows.length)} of ${rows.length}`:'0 Changes'}</span><details ref={mobileSort} className="history-extra-sort"><summary aria-label="Sort History Metadata" data-tooltip="Sort History"><ArrowDownUp size={14}/></summary><div>{[['By','By User'],['Subevent','Subevent']].map(([key,label])=><SortHeading key={key} column={key} sort={sort} toggle={column=>{toggle(column);setPage(0);scroll.current?.scrollTo({top:0});if(mobileSort.current)mobileSort.current.open=false;}}>{label}</SortHeading>)}</div></details>{pages>1&&<><button type="button" className="small" disabled={!index} aria-label="Previous History Page" onClick={()=>{setPage(index-1);scroll.current?.scrollTo({top:0});}}><ChevronLeft size={15}/>Previous</button><button type="button" className="small" disabled={index+1>=pages} aria-label="Next History Page" onClick={()=>{setPage(index+1);scroll.current?.scrollTo({top:0});}}>Next<ChevronRight size={15}/></button></>}</div>
 </div>;
}
