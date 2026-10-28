import assert from 'node:assert/strict';
import {test} from 'node:test';
import {applyAction} from '../lib/model.ts';
import {seedData} from './fixtures.mjs';
import {eventHistoryRows} from '../lib/event-history.ts';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({entryPoints:['app/event-change-history.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react-dom/server','lucide-react'],outfile:'.sites-runtime/event-history-ui-test.mjs'});
const {default:EventChangeHistory,EventHistoryButton}=await import('../.sites-runtime/event-history-ui-test.mjs'),{createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
const actor={id:'tester',name:'Alex Admin',email:'admin@example.test'};
function setup(){let data=seedData('2026-10-18T10:00:00Z');data=applyAction(data,{type:'create-event',rosterId:data.rosters[0].id,name:'Staff Training',date:'2026-10-18'},'2026-10-18T10:00:00Z',actor);return data;}
test('event-family history includes event entries, all subevents and removed people in descending timestamps',()=>{
 let data=setup();const parent=data.events[0],person=parent.participants[0];data=applyAction(data,{type:'person-note',eventId:parent.id,personId:person.id,note:'Follow Up'},'2026-10-18T12:00:00Z',actor);data=applyAction(data,{type:'create-subevent',eventId:parent.id,name:'Afternoon',date:'2026-10-18'},'2026-10-18T11:00:00Z',actor);const child=data.events.at(-1);data=applyAction(data,{type:'status',eventId:child.id,personId:person.id,status:'Present'},'2026-10-18T13:00:00Z',actor);data=applyAction(data,{type:'remove-event-person',eventId:parent.id,personId:person.id},'2026-10-18T14:00:00Z',actor);
 const rows=eventHistoryRows(data,child,()=> 'Preferred Person');assert.deepEqual(rows.map(r=>r.timestamp),rows.map(r=>r.timestamp).sort((a,b)=>b-a));assert.equal(rows[0].change.kind,'Membership');assert.equal(rows[0].person,'Preferred Person');assert.ok(rows.some(r=>r.subevent==='Afternoon'&&r.change.kind==='Status'));assert.ok(rows.some(r=>r.person==='Event'));assert.ok(rows.every(r=>r.change.actor.name==='Alex Admin'));assert.equal(new Set(rows.map(r=>r.key)).size,rows.length);
 const unrelated=applyAction(data,{type:'create-event',rosterId:data.rosters[0].id,name:'Unrelated',date:'2026-10-18'},'2026-10-18T15:00:00Z',actor);assert.equal(eventHistoryRows(unrelated,parent).length,rows.length);
});
test('lifecycle changes record trusted authors and person history is retained',()=>{
 let data=setup();const parent=data.events[0],person=parent.participants[0];data=applyAction(data,{type:'rename-subevent',eventId:parent.id,name:'Morning'},'2026-10-18T11:00:00Z',actor);data=applyAction(data,{type:'archive-event',eventId:parent.id},'2026-10-18T12:00:00Z',actor);data=applyAction(data,{type:'restore-event',eventId:parent.id},'2026-10-18T13:00:00Z',actor);assert.deepEqual(eventHistoryRows(data,parent).slice(0,3).map(r=>r.change.kind),['Archive','Archive','Subevent Name']);data=applyAction(data,{type:'person-note',eventId:parent.id,personId:person.id,note:'Private Note'},'2026-10-18T14:00:00Z',actor);assert.throws(()=>applyAction(data,{type:'clear-person-history',eventId:parent.id,personId:person.id},'2026-10-18T15:00:00Z',actor),/no longer available/);assert.ok(eventHistoryRows(data,parent).some(r=>r.change.to==='Private Note'));
});
test('history table exposes authors, subjects, subevents, changes and bounded pagination',()=>{
 const data=setup(),event=data.events[0];event.history=Array.from({length:65},(_,i)=>({id:String(i),at:new Date(Date.UTC(2026,9,18,12,i)).toISOString(),kind:'Event Note',from:'Old Note',to:i===64?'<script>alert(1)</script>':'New Note',actor}));
 const html=renderToStaticMarkup(createElement(EventChangeHistory,{data,event}));assert.equal((html.match(/<tr>/g)||[]).length,51);for(const label of ['When','By','For','Subevent','Change','Alex Admin','Day 1','From','To','1–50','65'])assert.ok(html.includes(label),label);assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Next History Page'));
 const button=renderToStaticMarkup(createElement(EventHistoryButton,{onClick(){}}));assert.match(button,/aria-label="View Event Change History"/);assert.ok(!button.includes('>History<'));
 event.history=[];assert.match(renderToStaticMarkup(createElement(EventChangeHistory,{data,event})),/No Changes Yet/);
});


test('membership displays as Roster, values follow the change-type column, headers sort, and only the footer has a count',()=>{
 let data=setup(),event=data.events[0];data=applyAction(data,{type:'remove-event-person',eventId:event.id,personId:event.participants[0].id});event=data.events[0];const html=renderToStaticMarkup(createElement(EventChangeHistory,{data,event}));
 assert.ok(!html.includes('event-history-summary'));assert.ok(!html.includes('Membership'));assert.ok(html.includes('Roster'));assert.ok(html.includes('FROM / TO'));assert.equal((html.match(/aria-sort="none"/g)||[]).length,6);assert.equal((html.match(/Sort Ascending/g)||[]).length,8);assert.ok(html.indexOf('Roster</b></span></td><td>')>=0);assert.ok(html.includes('1–2 of 2'));
});


test('event history keeps operation and type as separate badges, with no placeholder on ordinary changes',()=>{
 const data=setup(),event=data.events[0];
 event.history=['Undo · Status','Redo · Note','Status'].map((kind,i)=>({id:String(i),kind,from:'Old',to:'New',at:new Date(Date.UTC(2026,9,18,12,i)).toISOString(),actor}));
 const html=renderToStaticMarkup(createElement(EventChangeHistory,{data,event}));
 assert.equal((html.match(/class="history-badges"/g)||[]).length,3);
 assert.equal((html.match(/class="history-kind history-operation"/g)||[]).length,2);
 assert.match(html,/history-operation">[\s\S]*?<\/svg>Undo<\/b><b class="history-kind neutral"[^>]*>Attendance<\/b>/);
 assert.match(html,/history-operation">[\s\S]*?<\/svg>Redo<\/b><b class="history-kind note"[^>]*>Note<\/b>/);
 assert.ok(!html.includes('Undo ·'));assert.ok(!html.includes('Redo ·'));
});


test('event history colors attendance values without tinting Unmarked or note text',()=>{
 const data=setup(),event=data.events[0];
 event.history=[{id:'attendance',kind:'Status',from:'Unmarked',to:'Present',statusId:'Present',at:'2026-10-18T13:00:00Z',actor},{id:'note',kind:'Note',from:'Absent',to:'Present',at:'2026-10-18T12:00:00Z',actor}];
 const html=renderToStaticMarkup(createElement(EventChangeHistory,{data,event}));
 assert.equal((html.match(/class="history-attendance-value"/g)||[]).length,1);
 assert.match(html,/class="history-attendance-value" style="--tone:var\(--green\)">Present<\/span>/);
 assert.match(html,/<span>Unmarked<\/span>/);
});

test('event and subevent lifecycle history shows complete names, trusted authors and one entry per committed change',()=>{
 let data=setup(),root=data.events[0];
 data=applyAction(data,{type:'create-subevent',eventId:root.id,name:'Afternoon',date:'2026-10-18'},'2026-10-18T11:00:00Z',actor);
 const child=data.events.at(-1);
 data=applyAction(data,{type:'rename-event',eventId:root.id,name:'Annual Staff Training'},'2026-10-18T12:00:00Z',actor);
 data=applyAction(data,{type:'rename-subevent',eventId:child.id,name:'Afternoon Session'},'2026-10-18T13:00:00Z',actor);
 data=applyAction(data,{type:'rename-event',eventId:root.id,name:'Annual Staff Training'},'2026-10-18T14:00:00Z',actor);
 data=applyAction(data,{type:'rename-subevent',eventId:child.id,name:'Afternoon Session'},'2026-10-18T15:00:00Z',actor);
 const rows=eventHistoryRows(data,data.events[0]);assert.equal(rows.length,4);assert.ok(rows.every(row=>row.change.actor.id===actor.id));
 assert.deepEqual(rows.map(row=>[row.change.from,row.change.to]),[['Afternoon','Afternoon Session'],['Staff Training','Annual Staff Training'],['Not Created','Afternoon'],['Not Created','Staff Training']]);
 const html=renderToStaticMarkup(createElement(EventChangeHistory,{data,event:data.events[0]}));
 for(const label of ['Event','Subevent'])assert.equal(html.split('>'+label+'</b>').length-1,2,label);
 assert.ok(html.includes('Annual Staff Training'));assert.ok(html.includes('Afternoon Session'));
});

test('lifecycle badges stay compact across creation, rename, deletion and undo/redo',async()=>{
 const {historyKindLabel,historyOperation}=await import('../lib/history-kind.ts');
 for(const kind of ['Event','Event name','Event Created','Event Renamed','Event Deleted','Subevent','Subevent Name','Subevent Created','Subevent Renamed','Subevent Deleted'])for(const prefix of ['', 'Undo · ', 'Redo · ']){
  assert.equal(historyKindLabel(prefix+kind),kind.startsWith('Subevent')?'Subevent':'Event');
  assert.equal(historyOperation(prefix+kind),prefix?prefix.split(' ')[0]:undefined);
 }
 assert.equal(historyKindLabel('Event note'),'Event note');
});
