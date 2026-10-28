'use client';
import {useDisplayDates,usePersonalPreferences,useRememberedView} from './personal-preferences';
import {useMemo,useState,type MouseEvent} from 'react';
import {ArrowUpRight,Search} from 'lucide-react';
import {personAttendance,filterPersonAttendance,personAttendanceTotals,personRosterMemberships,personAttendanceSortValue,type PersonAttendanceRow} from '../lib/person-attendance';
import {formatTimestamp as formatRosterTimestamp} from '../lib/dates';
import {personForUid,personUid} from '../lib/person-identity';
import {eventPath,rosterPath} from '../lib/navigation';
import type {Data} from '../lib/model';
import {NamePreferences,useNamePreferences} from './name-preferences';
import {colorStyle,statusStyle,flagStyle} from './attendance-style';
import {SortHeading,sortedRows,useTableSort} from './table-sort';
import {workspacePath} from './workspace-switcher';
import ChangeHistory from './change-history';
import Modal from './modal';
import MultiSelect from './multi-select';
import PersonId from './person-id';
import DatePicker from './date-picker';
import AttendanceStats from './attendance-stats';
import ViewOnlyFollowup from './view-only-followup';

export default function PersonAttendance({data,uid,workspaceId,onNavigate}:{data:Data;uid:string;workspaceId?:string;onNavigate:(path:string)=>void}){
 const {displayName,displayPronunciation}=useNamePreferences(),person=personForUid(data,uid),personal=usePersonalPreferences();
 const rows=useMemo(()=>person?personAttendance(data,person.id):[],[data,person?.id]);
 const [filters,setFilters]=useRememberedView('person:'+uid,{from:'',to:'',roster:[] as string[],status:[] as string[],excuse:[] as string[],search:''}),[historyId,setHistoryId]=useState('');
 const {from,to,roster,status,excuse,search}=filters;
 const setFrom=(from:string)=>setFilters(value=>({...value,from})),setTo=(to:string)=>setFilters(value=>({...value,to})),setRoster=(roster:string[])=>setFilters(value=>({...value,roster})),setStatus=(status:string[])=>setFilters(value=>({...value,status})),setExcuse=(excuse:string[])=>setFilters(value=>({...value,excuse})),setSearch=(search:string)=>setFilters(value=>({...value,search}));
 const {sort,toggle}=useTableSort({key:'Date',direction:'desc'},uid);
 const filtered=filterPersonAttendance(rows,{from,to,roster,status,excuse,search}),totals=personAttendanceTotals(filtered);
 const sorted=sortedRows(filtered,sort,personAttendanceSortValue);
 const membership=person?personRosterMemberships(data,person.id):[];
 const history=rows.find(r=>r.event.id===historyId),rosters=[...new Map([...rows.map(r=>[r.event.rosterId,r.rosterName] as const),...membership.map(({roster:r})=>[r.id,r.name] as const)]).entries()],statuses=[...new Set(rows.map(r=>r.label))].sort(),excuses=[...new Set(rows.map(r=>r.excuse).filter(Boolean))].sort();
 const statusOptions=statuses.map(label=>{const row=rows.find(r=>r.label===label)!;return {value:label,label,style:row.person.status?statusStyle(row.person.status,row.config):undefined};});
 const excuseOptions=excuses.map(label=>{const row=rows.find(r=>r.excuse===label)!;return {value:label,label,style:colorStyle(row.config.excuses.find(e=>e.name===label)?.color??'purple')};});
 const hasFilters=!!(from||to||roster.length||status.length||excuse.length||search);
 const go=(event:MouseEvent<HTMLAnchorElement>,path:string)=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();onNavigate(path);};
 if(!person)return <div className="empty-state bordered"><h2>Person Not Found</h2><button onClick={()=>onNavigate('/rosters')}>Open Rosters</button></div>;
 return <section className="person-attendance-page"><div className="page-heading"><div><div className="eyebrow">ATTENDANCE RECORD</div><h1>{displayName(person)}</h1><div className="person-record-meta"><PersonId uid={personUid(data,person.id)??uid}/>{displayPronunciation(person)&&<span>{displayPronunciation(person)}</span>}{membership.map(({roster:r,removedAt})=>{const tooltip=removedAt?'Deleted from this Roster on '+formatRosterTimestamp(removedAt,{dateFormat:'text',timeFormat:'12h',timeZone:personal.timeZone}).replace(', ',' at '):undefined;return <a key={r.id} className={removedAt?'person-roster-removed':undefined} href={workspacePath(rosterPath(r),workspaceId)} data-tooltip={tooltip} aria-label={tooltip?r.name+'. '+tooltip:undefined} onClick={event=>go(event,rosterPath(r))}>{r.name}</a>;})}</div></div></div>
 <AttendanceStats totals={totals}/>
 <div className="person-attendance-filters"><DatePicker label="From" value={from} onChange={setFrom} placeholder="Select Start Date" max={to||undefined}/><DatePicker label="To" value={to} onChange={setTo} placeholder="Select End Date" min={from||undefined}/><label>Roster<MultiSelect value={roster} onValueChange={setRoster} options={rosters.map(([value,label])=>({value,label}))} placeholder="All Rosters" label="Filter By Roster"/></label><label>Attendance<MultiSelect value={status} onValueChange={setStatus} options={statusOptions} placeholder="All Statuses" label="Filter By Attendance"/></label><label>Excuse<MultiSelect value={excuse} onValueChange={setExcuse} options={excuseOptions} placeholder="All Excuses" label="Filter By Excuse"/></label><label className="person-history-search">Search<span className="search-box"><Search size={15}/><input data-page-search value={search} onChange={event=>setSearch(event.target.value)} placeholder="Events, notes…" aria-label="Search Person Attendance"/></span></label><button disabled={!hasFilters} className="small person-filter-clear" onClick={()=>{setFrom('');setTo('');setRoster([]);setStatus([]);setExcuse([]);setSearch('');}}>Clear</button></div>
 <div className="person-attendance-table-scroll"><table className="person-attendance-table"><thead><tr>{['Event','Date'].map(column=><th key={column} scope="col"><SortHeading column={column} sort={sort} toggle={toggle}>{column}</SortHeading></th>)}<th scope="col"><SortHeading column="Note" sort={sort} toggle={toggle}>Note</SortHeading></th>{['Attendance','Excuse'].map(column=><th key={column} scope="col"><SortHeading column={column} sort={sort} toggle={toggle}>{column}</SortHeading></th>)}<th scope="col"><SortHeading column="Flag" sort={sort} toggle={toggle}>Flag</SortHeading></th><th scope="col"><SortHeading column="Last Changed" sort={sort} toggle={toggle}>Last Changed</SortHeading></th></tr></thead><tbody>{sorted.map(row=><AttendanceRecordRow key={row.event.id} row={row} path={eventPath(row.event,data)} workspaceId={workspaceId} onGo={go} onHistory={()=>setHistoryId(row.event.id)}/>)}{!sorted.length&&<tr><td colSpan={7} className="person-history-empty">{rows.length?'No Attendance Matches These Filters.':'No Saved Event Attendance Yet.'}</td></tr>}</tbody></table></div>
 {history&&<Modal title={history.root.name+' · '+(history.event.subeventName||'Day 1')} className="person-record-history-modal" close={()=>setHistoryId('')} dirty={false}><NamePreferences settings={history.settings}><ChangeHistory entries={history.person.history} name={displayName(person)} visibleEntries={8}/></NamePreferences></Modal>}
 </section>;
}

function AttendanceRecordRow({row:r,path,workspaceId,onGo,onHistory}:{row:PersonAttendanceRow;path:string;workspaceId?:string;onGo:(event:MouseEvent<HTMLAnchorElement>,path:string)=>void;onHistory:()=>void}){
 const {formatDay,formatTimestamp}=useDisplayDates();
 return <tr className={r.person.removed?'person-record-removed':undefined}><td><a className="person-record-event" href={workspacePath(path,workspaceId)} onClick={event=>onGo(event,path)}>{r.root.name}<ArrowUpRight size={12}/></a><div className="person-record-session">{r.event.subeventName||'Day 1'}{r.archived&&<span className="tag">Archived</span>}{r.person.removed&&<span className="tag">Removed</span>}</div></td><td><time dateTime={r.event.date}>{formatDay(r.event.date)}</time></td><td className="person-record-note">{r.person.note||'—'}</td><td><span className={r.person.status?'custom-attendance-cell':undefined} style={r.person.status?statusStyle(r.person.status,r.config):undefined}>{r.label}</span></td><td>{r.excuse?<span className="custom-attendance-cell" style={colorStyle(r.config.excuses.find(e=>e.name===r.excuse)?.color??'purple')}>{r.excuse}</span>:'—'}</td><td style={flagStyle(r.config)}>{r.person.flag&&<ViewOnlyFollowup person={r.person} className={r.person.flag==='flagged'?'person-record-flag':'person-record-complete'}/>}</td><td><button className="timestamp-button" type="button" aria-label={'View History For '+r.root.name+' '+(r.event.subeventName||'Day 1')} data-tooltip="View History" onClick={onHistory}>{r.person.updatedAt?<time dateTime={r.person.updatedAt}>{formatTimestamp(r.person.updatedAt)}</time>:'—'}</button></td></tr>;
}
