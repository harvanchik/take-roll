import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {defaultPreferences} from '../lib/workspace-settings.ts';
import {applyAction,STATUSES,displayName,displayPronunciation,displayEvent,nextExcused,filteredPeople} from '../lib/model.ts';
import {seedData} from './fixtures.mjs';
const require=createRequire(import.meta.url);
const {build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({entryPoints:['lib/attendance-queue.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/queue-test.mjs'});
const {AttendanceQueue}=await import('../.sites-runtime/queue-test.mjs');
function setup(){let d=seedData();return applyAction(d,{type:'create-event',name:'Training',date:'2026-10-12',rosterId:d.rosters[0].id});}
function server(data){let base=structuredClone(data),revision=0;return {get data(){return base;},get revision(){return revision;},async send(body){if(base.appliedMutationIds?.includes(body.mutationId))return {status:200,data:structuredClone(base),revision};if(body.revision!==revision)return {status:409,data:structuredClone(base),revision};base=applyAction(base,body.action,body.occurredAt);base.appliedMutationIds=[...(base.appliedMutationIds||[]),body.mutationId];revision++;return {status:200,data:structuredClone(base),revision,savedAt:new Date().toISOString()};},external(action){base=applyAction(base,action);revision++;}};}
test('full display name includes quoted preferred name, separate pronunciation, and UUID-linked legacy enrichment',()=>{let d=setup(),r=d.rosters[0],e=d.events[0];d=applyAction(d,{type:'edit-person',rosterId:r.id,personId:e.participants[0].id,fields:{firstName:'YExample58',lastName:'AExample09',firstPronunciation:'sample pronunciation',lastPronunciation:'sample-family',preferredFirstName:'YExample57'}});const display=displayEvent(d,e);assert.equal(displayName(display.participants[0]),"YExample58 'YExample57' AExample09");assert.equal(displayPronunciation(display.participants[0]),'sample pronunciation · sample-family');assert.equal(e.participants[0].name,'YExample58');assert.equal(displayName(display.participants.find(p=>p.name==='JExample27')),'JExample27');assert.equal(filteredPeople(display,"YExample58 'YExample57' AExample09",[],false).length,1);});
test('multiple selected statuses form a union and no selections shows all',()=>{let d=setup(),e=d.events[0];for(let i=0;i<STATUSES.length;i++)d=applyAction(d,{type:'status',eventId:e.id,personId:e.participants[i].id,status:STATUSES[i]});const out=d.events[0];assert.equal(filteredPeople(out,'',['Present','Bit Late'],false).length,2);assert.equal(filteredPeople(out,'',['Excused (work)','Excused (Other)'],false).length,2);assert.equal(filteredPeople(out,'',[],false).length,48);assert.equal(filteredPeople(out,'',[],true).length,41);});
test('rapid clicks remain optimistic while delayed network saves run in order',async()=>{const d=setup(),s=server(d);const e=d.events[0],p=e.participants[0];let release;const gate=new Promise(resolve=>release=resolve);let first=true;const q=new AttendanceQueue(d,0,async body=>{if(first){first=false;await gate;}return s.send(body);},()=>{});q.enqueue({type:'status',eventId:e.id,personId:p.id,status:'Present'});q.enqueue({type:'status',eventId:e.id,personId:p.id,status:'Tardy'});q.enqueue({type:'status',eventId:e.id,personId:e.participants[1].id,status:'Bit Late'});assert.equal(q.data.events[0].participants[0].status,'Tardy');assert.equal(q.data.events[0].participants[1].status,'Bit Late');assert.equal(q.snapshot().pending,3);assert.equal(s.revision,0);const flushed=q.flush();release();assert.equal(await flushed,true);assert.deepEqual(s.data.events[0].participants[0].history.map(h=>h.to),['Present','Tardy']);assert.equal(q.snapshot().pending,0);assert.equal(q.data.events[0].participants[0].status,'Tardy');});
test('undo and redo before acknowledgements save every transition and redo branches reset',async()=>{const d=setup(),s=server(d);const e=d.events[0],p=e.participants[0];let release;const gate=new Promise(resolve=>release=resolve);const q=new AttendanceQueue(d,0,async body=>{await gate;return s.send(body);},()=>{});q.enqueue({type:'status',eventId:e.id,personId:p.id,status:'Present'});q.enqueue({type:'status',eventId:e.id,personId:p.id,status:'Tardy'});q.undo(e.id);assert.equal(q.data.events[0].participants[0].status,'Present');q.redo(e.id);assert.equal(q.data.events[0].participants[0].status,'Tardy');const done=q.flush();release();assert.equal(await done,true);const h=s.data.events[0].participants[0].history;assert.deepEqual(h.map(h=>h.to),['Present','Tardy','Present','Tardy']);assert.match(h[2].kind,/Undo/);assert.match(h[3].kind,/Redo/);q.undo(e.id);q.enqueue({type:'status',eventId:e.id,personId:p.id,status:'Absent'});assert.equal(q.snapshot().redoCounts[e.id]||0,0);await q.flush();assert.equal(s.data.events[0].participants[0].status,'Absent');});
test('excused cycles work, academic, other, clear and each click keeps a timestamp',async()=>{const d=setup(),s=server(d),e=d.events[0],p=e.participants[0];const q=new AttendanceQueue(d,0,s.send,()=>{});for(let i=0;i<4;i++)q.enqueue({type:'status',eventId:e.id,personId:p.id,status:nextExcused(q.data.events[0].participants[0].status)});await q.flush();assert.deepEqual(s.data.events[0].participants[0].history.map(h=>h.to),['Excused (work)','Excused (Academic)','Excused (Other)','Unmarked']);assert.ok(s.data.events[0].participants[0].history.every(h=>Number.isFinite(Date.parse(h.at))));});
test('mark remaining accepts all supported statuses and undo preserves already marked or removed people',async()=>{for(const status of STATUSES){let d=setup(),e=d.events[0];d=applyAction(d,{type:'status',eventId:e.id,personId:e.participants[0].id,status:'Present'});d=applyAction(d,{type:'remove-event-person',eventId:e.id,personId:e.participants[1].id});const s=server(d),q=new AttendanceQueue(d,0,s.send,()=>{});q.enqueue({type:'mark-remaining',eventId:e.id,status});assert.equal(q.data.events[0].participants[2].status,status);assert.equal(q.data.events[0].participants[0].status,'Present');assert.equal(q.data.events[0].participants[1].status,null);q.undo(e.id);assert.equal(q.data.events[0].participants[2].status,null);q.redo(e.id);await q.flush();assert.equal(s.data.events[0].participants[2].status,status);}});
test('revision conflicts rebase pending moves without losing another tabs unrelated change',async()=>{const d=setup(),e=d.events[0],s=server(d);s.external({type:'status',eventId:e.id,personId:e.participants[1].id,status:'Absent'});const q=new AttendanceQueue(d,0,s.send,()=>{});q.enqueue({type:'status',eventId:e.id,personId:e.participants[0].id,status:'Present'});await q.flush();assert.equal(s.data.events[0].participants[0].status,'Present');assert.equal(s.data.events[0].participants[1].status,'Absent');q.setBase(d,0);assert.equal(q.serverRevision,2);assert.equal(q.data.events[0].participants[0].status,'Present');});
test('lost save responses retain moves for retry without duplicate audit entries',async()=>{const d=setup(),e=d.events[0],s=server(d);let lost=true,persisted=[];const q=new AttendanceQueue(d,0,async body=>{const reply=await s.send(body);if(lost){lost=false;throw Error('Offline');}return reply;},()=>{},p=>persisted=structuredClone(p));q.enqueue({type:'status',eventId:e.id,personId:e.participants[0].id,status:'Present'});assert.equal(await q.flush(),false);assert.equal(q.snapshot().pending,1);assert.equal(persisted.length,1);q.enqueue({type:'status',eventId:e.id,personId:e.participants[1].id,status:'Tardy'});assert.equal(q.data.events[0].participants[1].status,'Tardy');q.retry();assert.equal(await q.flush(),true);assert.equal(s.data.events[0].participants[0].history.length,1);assert.equal(s.data.events[0].participants[1].status,'Tardy');assert.equal(persisted.length,0);});
test('pending intents recover after refresh; committed IDs are skipped',async()=>{const d=setup(),e=d.events[0],s=server(d);const pending=[{id:crypto.randomUUID(),at:new Date().toISOString(),action:{type:'status',eventId:e.id,personId:e.participants[0].id,status:'Present'}}];const q=new AttendanceQueue(d,0,s.send,()=>{});q.restore(pending);await q.flush();assert.equal(s.data.events[0].participants[0].status,'Present');const reopened=new AttendanceQueue(s.data,s.revision,s.send,()=>{});reopened.restore(pending);assert.equal(reopened.snapshot().pending,0);assert.equal(s.data.events[0].participants[0].history.length,1);});

test('clearing change history is rejected without losing records',()=>{const d=setup(),e=d.events[0],p=e.participants[0];const marked=applyAction(d,{type:'status',eventId:e.id,personId:p.id,status:'Tardy'});assert.throws(()=>applyAction(marked,{type:'clear-person-history',eventId:e.id,personId:p.id}),/no longer available/);assert.equal(marked.events[0].participants[0].history.length,1);});
test('follow-up flag cycles, persists independently of attendance, and supports undo/redo',async()=>{
 const d=setup(),e=d.events[0],p=e.participants[0],s=server(d),q=new AttendanceQueue(d,0,s.send,()=>{});
 for(const flag of ['flagged','complete',null])q.enqueue({type:'person-flag',eventId:e.id,personId:p.id,flag});
 assert.equal(q.data.events[0].participants[0].flag,null);
 q.undo(e.id);assert.equal(q.data.events[0].participants[0].flag,'complete');
 q.redo(e.id);assert.equal(await q.flush(),true);
 const person=s.data.events[0].participants[0];assert.equal(person.flag,null);assert.equal(person.status,null);
 assert.deepEqual(person.history.slice(0,3).map(h=>h.to),['Flagged','Complete','None']);
 assert.ok(person.history.every(h=>h.at));
 assert.throws(()=>applyAction(s.data,{type:'person-flag',eventId:e.id,personId:p.id,flag:'unknown'}),/Unknown flag/);
 q.enqueue({type:'person-flag',eventId:e.id,personId:p.id,flag:'flagged'});await q.flush();
 const copy=applyAction(s.data,{type:'duplicate-event',eventId:e.id});assert.equal(copy.events[1].participants[0].flag,null);
});
test('removing a person across a family preserves records and supports one undo without changing other events',async()=>{
 let d=setup();const root=d.events[0],personId=root.participants[0].id;
 d=applyAction(d,{type:'status',eventId:root.id,personId,status:'Tardy'});
 d=applyAction(d,{type:'person-note',eventId:root.id,personId,note:'Keep this note'});
 for(const name of ['Day 2','Day 3'])d=applyAction(d,{type:'create-subevent',eventId:root.id,name,date:'2026-10-13'});
 const child=d.events[1];d=applyAction(d,{type:'remove-event-person',eventId:child.id,personId});
 d=applyAction(d,{type:'create-event',name:'Unrelated',date:'2026-10-14',rosterId:d.rosters[0].id});
 const before=structuredClone(d),s=server(d),q=new AttendanceQueue(d,0,s.send,()=>{});
 q.enqueue({type:'remove-family-person',eventId:root.id,personId});await q.flush();
 for(const e of q.data.events.slice(0,3))assert.equal(e.participants[0].removed,true);
 assert.deepEqual(q.data.events[3],before.events[3]);
 assert.equal(q.data.events[0].participants[0].note,'Keep this note');assert.equal(q.data.events[0].participants[0].status,'Tardy');
 assert.deepEqual(q.data.events[0].participants[0].history.slice(0,-1),before.events[0].participants[0].history);
 assert.deepEqual(q.data.events[0].participants[1],before.events[0].participants[1]);
 q.undo(root.id);await q.flush();assert.deepEqual(q.data.events.slice(0,3).map(e=>e.participants[0].removed),[false,true,false]);
 q.redo(root.id);await q.flush();assert.ok(q.data.events.slice(0,3).every(e=>e.participants[0].removed));
 assert.throws(()=>applyAction(d,{type:'set-family-membership',eventId:root.id,personId,changes:[{eventId:d.events[3].id,removed:true}]}),/Invalid subevent/);
});

test('overview undo and redo follow the latest change among selected subevents',async()=>{let d=setup();d=applyAction(d,{type:'create-subevent',eventId:d.events[0].id,name:'Day 2',date:'2026-10-13'});const s=server(d),q=new AttendanceQueue(d,0,body=>s.send(body),()=>{});const [one,two]=d.events,id=one.participants[0].id;q.enqueue({type:'person-flag',eventId:one.id,personId:id,flag:'flagged'});q.enqueue({type:'person-flag',eventId:two.id,personId:id,flag:'flagged'});q.enqueue({type:'person-flag',eventId:one.id,personId:id,flag:'complete'});assert.equal(q.undoAcross([two.id]).eventId,two.id);assert.equal(q.data.events[1].participants[0].flag,null);assert.equal(q.data.events[0].participants[0].flag,'complete');assert.equal(q.undoAcross([one.id,two.id]).eventId,one.id);assert.equal(q.data.events[0].participants[0].flag,'flagged');assert.equal(q.redoAcross([one.id,two.id]).eventId,one.id);assert.equal(q.data.events[0].participants[0].flag,'complete');assert.equal(q.redoAcross([two.id]).eventId,two.id);assert.equal(q.undoAcross([]),undefined);assert.equal(await q.flush(),true);assert.equal(s.data.events[0].participants[0].flag,'complete');assert.equal(s.data.events[1].participants[0].flag,'flagged');});

test('open history can refresh from another tab without replacing the queue or losing undo',async()=>{
 const d=setup(),e=d.events[0],s=server(d),q=new AttendanceQueue(d,0,s.send,()=>{});
 q.enqueue({type:'status',eventId:e.id,personId:e.participants[0].id,status:'Present'});await q.flush();
 s.external({type:'person-note',eventId:e.id,personId:e.participants[0].id,note:'Updated in another tab'});
 q.setBase(s.data,s.revision);
 assert.equal(q.data.events[0].participants[0].history.at(-1).to,'Updated in another tab');
 assert.equal(q.snapshot().undoCounts[e.id],1);
 q.undo(e.id);await q.flush();
 assert.equal(q.data.events[0].participants[0].status,null);
 assert.equal(q.data.events[0].participants[0].note,'Updated in another tab');
});
test('new optimistic history immediately includes the signed-in actor',async()=>{
 const d=setup(),e=d.events[0],actor={id:'person',name:'Taylor',email:'taylor@example.test'};
 let release;const gate=new Promise(resolve=>release=resolve);
 const q=new AttendanceQueue(d,0,async body=>{await gate;return {status:200,data:applyAction(d,body.action,body.occurredAt,actor),revision:1};},()=>{},()=>{},actor);
 q.enqueue({type:'status',eventId:e.id,personId:e.participants[0].id,status:'Tardy'});
 assert.deepEqual(q.data.events[0].participants[0].history.at(-1).actor,actor);
 release();await q.flush();assert.deepEqual(q.data.events[0].participants[0].history.at(-1).actor,actor);
});

test('a live confirmation recovers a lost response and resumes later queued edits without a retry',async()=>{const d=setup(),s=server(d),e=d.events[0];let calls=0;const q=new AttendanceQueue(d,0,async body=>{calls++;const reply=await s.send(body);if(calls===1)throw Error('Response Lost');return reply;},()=>{});q.enqueue({type:'status',eventId:e.id,personId:e.participants[0].id,status:'Present'});assert.equal(await q.flush(),false);q.enqueue({type:'person-note',eventId:e.id,personId:e.participants[1].id,note:'Keep Moving'});q.setBase(s.data,s.revision);assert.equal(await q.flush(),true);assert.equal(calls,2);assert.equal(q.snapshot().pending,0);assert.equal(q.snapshot().error,'');assert.equal(s.data.events[0].participants[0].history.length,1);assert.equal(s.data.events[0].participants[1].note,'Keep Moving');});
test('a live acknowledgement received before a failed HTTP response settles the in-flight operation',async()=>{const d=setup(),s=server(d),e=d.events[0];let q; q=new AttendanceQueue(d,0,async body=>{const reply=await s.send(body);q.setBase(reply.data,reply.revision);throw Error('HTTP Response Lost');},()=>{});q.enqueue({type:'status',eventId:e.id,personId:e.participants[0].id,status:'Present'});assert.equal(await q.flush(),true);assert.equal(q.snapshot().pending,0);assert.equal(q.snapshot().error,'');assert.equal(s.data.events[0].participants[0].history.length,1);});
test('an optimistic attendance move copies the workspace once and retains its undo baseline',()=>{const d=setup();d.preferences={theme:'device',haptics:true,autoSave:false};const q=new AttendanceQueue(d,0,async()=>{throw Error('No Manual Save');},()=>{});const original=globalThis.structuredClone;let copies=0;globalThis.structuredClone=(...args)=>{copies++;return original(...args);};try{q.enqueue({type:'status',eventId:d.events[0].id,personId:d.events[0].participants[0].id,status:'Present'});assert.equal(copies,1);}finally{globalThis.structuredClone=original;}assert.equal(q.data.events[0].participants[0].status,'Present');q.undo(d.events[0].id);assert.equal(q.data.events[0].participants[0].status,null);});

test('a live removal pauses invalid queued choices before another network request',async()=>{const {DEFAULT_ATTENDANCE}=await import('../lib/attendance-settings.ts'),{organizationSettings}=await import('../lib/workspace-settings.ts');const d=setup(),s=server(d),e=d.events[0];let release,calls=0;const gate=new Promise(r=>release=r),q=new AttendanceQueue(d,0,async body=>{calls++;const reply=await s.send(body);await gate;return reply;},()=>{});q.enqueue({type:'status',eventId:e.id,personId:e.participants[0].id,status:'Present'});q.enqueue({type:'status',eventId:e.id,personId:e.participants[1].id,status:'Tardy'});const c=structuredClone(DEFAULT_ATTENDANCE);c.statuses=c.statuses.filter(s=>s.id!=='Tardy');s.external({type:'update-organization',organization:organizationSettings({attendance:c})});q.setBase(s.data,s.revision);release();assert.equal(await q.flush(),false);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);assert.equal(q.snapshot().pending,1);assert.match(q.snapshot().error,/Permanently Removed/);assert.equal(q.data.events[0].participants[1].status,null);});

test('live archive pauses waiting edits without dropping them and restore allows retry',async()=>{
 const d=setup(),e=d.events[0],s=server(d);let online=false;
 const q=new AttendanceQueue(d,0,async body=>{if(!online)throw Error('Offline');return s.send(body);},()=>{});
 q.enqueue({type:'person-note',eventId:e.id,personId:e.participants[0].id,note:'Keep My Draft'});await q.flush();
 s.external({type:'archive-event',eventId:e.id});q.setBase(s.data,s.revision);
 assert.equal(q.snapshot().pending,1);assert.match(q.snapshot().error,/Archived/);
 assert.throws(()=>q.enqueue({type:'status',eventId:e.id,personId:e.participants[0].id,status:'Present'}),/Archived/);
 s.external({type:'restore-event',eventId:e.id});q.setBase(s.data,s.revision);online=true;q.retry();assert.equal(await q.flush(),true);
 assert.equal(s.data.events[0].participants[0].note,'Keep My Draft');
});

test('default alphabetical order does not forbid manual roster or attendance reordering',()=>{
 let d=setup();d=applyAction(d,{type:'update-organization',organization:{name:'Team',nameDisplay:'quoted',showPronunciation:true,archiveRetention:'30d',forceAlphabetical:true}});
 const e=d.events[0],r=d.rosters[0];
 const reordered=applyAction(d,{type:'reorder-event',eventId:e.id,personIds:e.participants.map(p=>p.id).reverse()});assert.deepEqual(reordered.events[0].participants.map(p=>p.id),e.participants.map(p=>p.id).reverse());
 const roster=applyAction(d,{type:'reorder-roster',rosterId:r.id,personIds:r.people.map(p=>p.id).reverse()});assert.deepEqual(roster.rosters[0].people.map(p=>p.id),r.people.map(p=>p.id).reverse());
});

test('theme shortcut preference and attendance edits queue while a save is in flight',async()=>{
 const d=setup(),event=d.events[0],s=server(d);let release;const gate=new Promise(resolve=>release=resolve);const q=new AttendanceQueue(d,0,async body=>{await gate;return s.send(body);},()=>{});q.enqueue({type:'update-preferences',preferences:{...defaultPreferences,...d.preferences,theme:'light'}});q.enqueue({type:'status',eventId:event.id,personId:event.participants[0].id,status:'Present'});assert.equal(q.data.events[0].participants[0].status,'Present');release();assert.equal(await q.flush(),true);assert.equal(s.data.preferences.theme,'light');assert.equal(s.data.events[0].participants[0].status,'Present');
});

test('roster notes save while attendance changes are queued',async()=>{
 const d=setup(),e=d.events[0],roster=d.rosters[0],p=roster.people[0],s=server(d);let release;const gate=new Promise(resolve=>release=resolve),q=new AttendanceQueue(d,0,async body=>{await gate;return s.send(body);},()=>{});q.enqueue({type:'roster-person-note',rosterId:roster.id,personId:p.id,note:'A shared note',before:''});q.enqueue({type:'status',eventId:e.id,personId:p.id,status:'Present'});assert.equal(q.data.personNotes[p.id],'A shared note');release();assert.equal(await q.flush(),true);assert.equal(s.data.personNotes[p.id],'A shared note');assert.equal(s.data.events[0].participants[0].status,'Present');
});
