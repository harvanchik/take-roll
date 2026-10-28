import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';import {dirname} from 'node:path';
import {applyAction,seedData} from '../lib/model.ts';
import {withSlugs,resolvePage,eventPath} from '../lib/navigation.ts';
import {eventFamily,selectedComparisonEvents} from '../lib/subevents.ts';
import {eventHistoryRows} from '../lib/event-history.ts';
import {createElement as h} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({stdin:{contents:"export {AttendanceQueue} from './lib/attendance-queue';export {EditableSubeventTab} from './app/roll-call';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',outfile:'.sites-runtime/subevent-unit.mjs'});
const {AttendanceQueue,EditableSubeventTab}=await import('../.sites-runtime/subevent-unit.mjs');
function setup(){let data=seedData();data=applyAction(data,{type:'create-event',rosterId:data.rosters[0].id,name:'Workshop',date:'2026-10-20'});for(const name of ['Tuesday','Wednesday'])data=applyAction(data,{type:'create-subevent',eventId:data.events[0].id,name,date:'2026-10-20'});return withSlugs(data);}
test('deleting the first day preserves its parent identity, active subevents and links',()=>{
 const data=setup(),root=data.events[0],path=eventPath(root),person=root.participants[0];
 let changed=applyAction(data,{type:'status',eventId:root.id,personId:person.id,status:'Present'});const snapshot=structuredClone(changed.events[0]);
 changed=applyAction(changed,{type:'delete-subevent',eventId:root.id,restoreId:'root-undo'});
 assert.equal(changed.events[0].subeventDeleted,true);assert.equal(changed.events[0].participants.length,0);
 assert.deepEqual(eventFamily(changed,root).map(e=>e.id),data.events.slice(1).map(e=>e.id));
 assert.equal(resolvePage(changed,path).eventId,data.events[1].id);assert.equal(resolvePage(changed,path+'/'+root.subeventSlug).missing,true);
 assert.equal(selectedComparisonEvents(changed,root,{scope:'all',selected:changed.events.map(e=>e.id)}).length,2);
 assert.equal(eventHistoryRows(changed,changed.events[1]).filter(r=>r.change.kind==='Subevent Deleted').length,1);
 assert.throws(()=>applyAction(changed,{type:'status',eventId:root.id,personId:person.id,status:'Absent'}),/No Longer Exists/);
 changed=applyAction(changed,{type:'restore-subevent',eventId:root.id,subeventId:root.id,restoreId:'root-undo',snapshot,historyIntent:'undo'});
 assert.equal(changed.events[0].participants[0].status,'Present');assert.equal(changed.events[0].subeventDeleted,undefined);assert.equal(eventFamily(changed,root).length,3);
});
test('a deletion makes one audit event, undo preserves newer sibling edits, and last/archive deletion is blocked',()=>{
 const data=setup(),root=data.events[0],target=data.events[1],other=data.events[2],snapshot=structuredClone(target);
 let changed=applyAction(data,{type:'delete-subevent',eventId:target.id,restoreId:'child-undo'});
 assert.ok(!changed.events.some(e=>e.id===target.id));assert.equal(changed.events[0].history.length,root.history.length+1);
 const entry=eventHistoryRows(changed,root).find(r=>r.change.kind==='Subevent Deleted');assert.equal(entry.subevent,'Tuesday');
 changed=applyAction(changed,{type:'person-note',eventId:other.id,personId:other.participants[0].id,note:'Newer Edit'});
 changed=applyAction(changed,{type:'restore-subevent',eventId:root.id,subeventId:target.id,restoreId:'child-undo',snapshot,historyIntent:'undo'});
 assert.equal(changed.events.find(e=>e.id===other.id).participants[0].note,'Newer Edit');
 const archive=applyAction(data,{type:'archive-event',eventId:root.id});assert.throws(()=>applyAction(archive,{type:'delete-subevent',eventId:target.id,restoreId:'x'}),/Archived/);
 changed=applyAction(changed,{type:'delete-subevent',eventId:target.id,restoreId:'new-child'});changed=applyAction(changed,{type:'delete-subevent',eventId:other.id,restoreId:'other'});
 assert.throws(()=>applyAction(changed,{type:'delete-subevent',eventId:root.id,restoreId:'last'}),/At Least One/);
});
test('delete undo/redo is available from remaining subevents, never persisted, and disappears on refresh',async()=>{
 const data=setup(),root=data.events[0],target=data.events[1],remaining=data.events[2];let server=data,revision=0,persisted=[];
 const transport=async body=>{assert.ok(!body.action.snapshot);const action=body.action.type==='restore-subevent'?{...body.action,snapshot:target}:body.action;server=applyAction(server,action);return {status:200,data:server,revision:++revision};};
 const queue=new AttendanceQueue(data,0,transport,()=>{},pending=>{persisted=structuredClone(pending);});
 queue.enqueue({type:'delete-subevent',eventId:target.id,restoreId:'delete-id',undoToken:'memory-only-token'});assert.ok(!JSON.stringify(persisted).includes('memory-only-token'));await queue.flush();
 assert.ok(queue.snapshot().undoCounts[remaining.id]);queue.undo(remaining.id);await queue.flush();assert.ok(queue.data.events.some(e=>e.id===target.id));
 queue.redo(remaining.id);await queue.flush();assert.ok(!queue.data.events.some(e=>e.id===target.id));
 const refreshed=new AttendanceQueue(server,revision,transport,()=>{});assert.equal(refreshed.undo(remaining.id),undefined);assert.ok(!refreshed.data.events.some(e=>e.id===target.id));
 // Root deletion also supports redo despite the parent audit growing with every operation.
 let rootServer=data;const rootQueue=new AttendanceQueue(data,0,async body=>{rootServer=applyAction(rootServer,body.action.type==='restore-subevent'?{...body.action,snapshot:root}:body.action);return {status:200,data:rootServer,revision:++revision};},()=>{});
 rootQueue.enqueue({type:'delete-subevent',eventId:root.id,restoreId:'root-id',undoToken:'root-token'});assert.equal(await rootQueue.flush(),true,rootQueue.snapshot().error);rootQueue.undo(remaining.id);assert.equal(await rootQueue.flush(),true,rootQueue.snapshot().error);rootQueue.redo(remaining.id);assert.equal(await rootQueue.flush(),true,rootQueue.snapshot().error);assert.equal(rootQueue.data.events[0].subeventDeleted,true);
});
test('subevent tabs advertise right click while archive tabs expose no mutation menu',()=>{
 const props={name:'Tuesday',selected:false,busy:false,onSelect(){},onSave:async()=>true,onDelete(){},canDelete:true};
 const html=renderToStaticMarkup(h(EditableSubeventTab,props));assert.match(html,/Right Click For Options/);assert.ok(!html.includes('Double-Click To Rename'));
 const archived=renderToStaticMarkup(h(EditableSubeventTab,{...props,readOnly:true}));assert.ok(!archived.includes('Right Click For Options'));assert.match(archived,/Tuesday/);
});
