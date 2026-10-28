'use client';
import {useDisplayDates,useRememberedView} from './personal-preferences';
import {useNamePreferences} from './name-preferences';
import {useState} from 'react';
import {Eye,Undo2,Trash2,Search} from 'lucide-react';
import {counts,type Event} from '../lib/model';
import {archiveExpiresAt} from '../lib/workspace-settings';
export default function ArchiveList({events,busy,onAction,onView}:{events:Event[];busy:boolean;onAction:(action:any)=>Promise<unknown>;onView:(event:Event)=>void}){
 const {formatDay,formatTimestamp}=useDisplayDates();
 const {settings}=useNamePreferences();
 const [confirm,setConfirm]=useState(''),[filters,setFilters]=useRememberedView('archive',{search:''});const search=filters.search,setSearch=(search:string)=>setFilters({search});
 const visible=events.filter(e=>!e.parentEventId).filter(e=>`${e.name} ${e.rosterName}`.toLowerCase().includes(search.toLowerCase())).toSorted((a,b)=>(b.archivedAt||'').localeCompare(a.archivedAt||''));
 return <><div className="page-heading"><div><div className="eyebrow">SAVED RECORDS</div><h1>Archive</h1></div><label className="search-box"><Search size={17}/><input data-page-search aria-label="Search Archived Events" placeholder="Search Archived Events…" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>{visible.map(e=>{
  const family=events.filter(item=>item.id===e.id||item.parentEventId===e.id),stats=counts({...e,participants:family.flatMap(item=>item.participants)}),expires=archiveExpiresAt(e.archivedAt!,settings.archiveRetention).toISOString();
  return <section className="archived-event archive-card" key={e.id}><div className="archive-heading"><div><h2>{e.name}</h2><p>{formatDay(e.date)} · {e.rosterName}</p></div><div className="archive-actions"><button type="button" className="icon" disabled={busy} data-tooltip="View Event" aria-label={`View ${e.name}`} onClick={()=>onView(e)}><Eye size={16}/></button><button type="button" className="icon" disabled={busy} data-tooltip="Restore Event" aria-label={`Restore ${e.name}`} onClick={()=>void onAction({type:'restore-event',eventId:e.id})}><Undo2 size={16}/></button><button type="button" className="icon" disabled={busy} data-tooltip="Delete Permanently" aria-label={`Permanently Delete ${e.name}`} aria-expanded={confirm===e.id} onClick={()=>setConfirm(confirm===e.id?'':e.id)}><Trash2 size={16}/></button></div></div><div className="archive-card-meta"><span>Archived <time dateTime={e.archivedAt!}>{formatTimestamp(e.archivedAt!)}</time></span><span>Expires <time dateTime={expires}>{formatTimestamp(expires)}</time></span><span>{family.length} {family.length===1?'Subevent':'Subevents'}{e.settings?.testOnly?' · Test Only':` · ${stats.total-stats.unmarked}/${stats.total} Marked`}</span></div>{confirm===e.id&&<div className="inline-confirm"><span>Permanently delete {e.name}, including attendance, notes, and history? This cannot be undone.</span><button className="danger small" disabled={busy} onClick={async()=>{if(await onAction({type:'delete-archived-event',eventId:e.id}))setConfirm('');}}>Delete Permanently</button><button className="small" disabled={busy} onClick={()=>setConfirm('')}>Cancel</button></div>}</section>;
 })}{!visible.length&&<div className="empty-state bordered"><h2>{events.length?'No Matching Events':'No Archived Events'}</h2><p>Right-click a recent event to archive it.</p></div>}</>;
}
