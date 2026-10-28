import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedData,applyAction,excuseFor} from '../lib/model.ts';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {attendanceSettings} from '../lib/attendance-settings.ts';
import {keyboardChoices,keyboardExcuseChanges} from '../lib/attendance-keyboard.ts';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({stdin:{contents:"export {AttendanceQueue} from './lib/attendance-queue';export {guardEdit,editFingerprint} from './lib/edit-conflicts';export {removedEdit,restoreForEdit} from './lib/removed-edit';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/keyboard-group-queue.mjs'});
const {AttendanceQueue,guardEdit,editFingerprint,removedEdit,restoreForEdit}=await import('../.sites-runtime/keyboard-group-queue.mjs');
function setup(){const d=seedData();return applyAction(d,{type:'create-event',name:'Practice',date:'2026-10-26',rosterId:d.rosters[0].id});}
test('group notes, flags and recoverable removals each undo and redo as one move',async()=>{
 for(const [field,value] of [['note','Shared note'],['flag','flagged'],['removed',true]]){
  const d=setup(),e=d.events[0],ids=e.participants.slice(0,2).map(p=>p.id);d.preferences={theme:'dark',haptics:false,autoSave:false};let server=d,rev=0;
  const q=new AttendanceQueue(d,0,async body=>({status:200,data:server=applyAction(server,body.action),revision:++rev}),()=>{});
  q.enqueue({type:'set-person-field',eventId:e.id,field,changes:ids.map(personId=>({personId,value}))});
  assert.equal(q.snapshot().undoCounts[e.id],1);assert.ok(q.data.events[0].participants.slice(0,2).every(p=>(p[field]??null)===value));
  q.undo(e.id);assert.ok(q.data.events[0].participants.slice(0,2).every(p=>(p[field]??null)===(field==='note'?'':field==='removed'?false:null)));
  q.redo(e.id);assert.ok(await q.savePending());assert.ok(server.events[0].participants.slice(0,2).every(p=>(p[field]??null)===value));assert.equal(server.rosters[0].people.length,d.rosters[0].people.length);
 }
});
test('group note guards permit independent status changes but detect note edits and removals',()=>{
 const d=setup(),e=d.events[0],personId=e.participants[0].id,a={type:'set-person-field',eventId:e.id,field:'note',changes:[{personId,value:'new'}]},guard=guardEdit(d,a);
 const status=applyAction(d,{type:'status',eventId:e.id,personId,status:'Present'});assert.equal(editFingerprint(status,a),guard.expected);
 const note=applyAction(d,{type:'person-note',eventId:e.id,personId,note:'Elsewhere'});assert.notEqual(editFingerprint(note,a),guard.expected);
 const removed=applyAction(d,{type:'remove-event-person',eventId:e.id,personId});assert.ok(removedEdit(removed,a));assert.throws(()=>applyAction(removed,a));
 const restored=applyAction(removed,restoreForEdit(removed,a));assert.equal(restored.events[0].participants[0].removed,false);assert.equal(restored.events[0].participants[0].note,'new');
});
test('invalid group changes are atomic and cannot write other participant fields',()=>{
 const d=setup(),e=d.events[0],ids=e.participants.slice(0,2).map(p=>p.id),base={type:'set-person-field',eventId:e.id,field:'flag'};
 for(const action of [{...base,field:'status',changes:[]},{...base,changes:[{personId:ids[0],value:'flagged'},{personId:ids[1],value:'invalid'}]},{...base,changes:ids.map(()=>({personId:ids[0],value:null}))},{...base,changes:[{personId:'unknown',value:null}]}])assert.throws(()=>applyAction(d,action));
 assert.equal(d.events[0].participants[0].flag,undefined);
});
test('numbered excuses cycle exactly like the excuse button and skip incompatible statuses',()=>{
 let d=setup();const config=attendanceSettings(),id=d.events[0].participants[0].id;assert.equal(keyboardChoices(config).at(-1).id,'Excused');
 for(const expected of ['work','academic','other',null]){const changes=keyboardExcuseChanges([d.events[0].participants[0]],config);d=applyAction(d,{type:'set-statuses',eventId:d.events[0].id,changes});assert.equal(excuseFor(d.events[0].participants[0]),expected);}
 d=applyAction(d,{type:'status',eventId:d.events[0].id,personId:id,status:'Present'});assert.deepEqual(keyboardExcuseChanges([d.events[0].participants[0]],config),[]);
 d=applyAction(d,{type:'status',eventId:d.events[0].id,personId:id,status:'Absent'});const changes=keyboardExcuseChanges([d.events[0].participants[0]],config);assert.equal(changes[0].status,'Absent');assert.equal(changes[0].excuse,'work');
});

 test('group family removal preserves each membership and all attendance data through one undo/redo',async()=>{
 let d=setup();const e=d.events[0];d=applyAction(d,{type:'create-subevent',eventId:e.id,name:'Second',date:'2026-10-27'});const family=d.events.filter(x=>x.id===e.id||x.parentEventId===e.id),ids=e.participants.slice(0,2).map(p=>p.id),second=family.find(x=>x.id!==e.id);
 d=applyAction(d,{type:'person-note',eventId:second.id,personId:ids[0],note:'Preserved note'});d=applyAction(d,{type:'status',eventId:second.id,personId:ids[0],status:'Absent'});d=applyAction(d,{type:'remove-event-person',eventId:second.id,personId:ids[1]});
 d=applyAction(d,{type:'create-event',name:'Unrelated',date:'2026-10-28',rosterId:d.rosters[0].id});const unrelated=d.events.at(-1),original=structuredClone(d);d.preferences={theme:'dark',haptics:false,autoSave:false};let server=d,revision=0;
 const changes=family.flatMap(x=>ids.map(personId=>({eventId:x.id,personId,removed:true}))),action={type:'set-family-memberships',eventId:e.id,changes},q=new AttendanceQueue(d,0,async body=>({status:200,data:server=applyAction(server,body.action),revision:++revision}),()=>{});
 q.enqueue(action);assert.equal(q.snapshot().undoCounts[e.id],1);assert.ok(q.data.events.filter(x=>family.some(f=>f.id===x.id)).every(x=>x.participants.filter(p=>ids.includes(p.id)).every(p=>p.removed)));assert.deepEqual(q.data.events.find(x=>x.id===unrelated.id),unrelated);
 q.undo(e.id);for(const x of original.events){const now=q.data.events.find(n=>n.id===x.id);assert.deepEqual(now.participants.map(p=>[p.removed,p.status,p.note]),x.participants.map(p=>[p.removed,p.status,p.note]));}
 q.redo(e.id);assert.ok(await q.savePending());const person=server.events.find(x=>x.id===second.id).participants.find(p=>p.id===ids[0]);assert.equal(person.note,'Preserved note');assert.equal(person.status,'Absent');assert.ok(person.history.length>=3);
 const guard=guardEdit(d,action),changed=applyAction(d,{type:'person-note',eventId:second.id,personId:ids[0],note:'Concurrent'});assert.notEqual(editFingerprint(changed,action),guard.expected);
 assert.throws(()=>applyAction(d,{...action,changes:[...changes,{eventId:unrelated.id,personId:ids[0],removed:true}]}));assert.throws(()=>applyAction(d,{...action,changes:[changes[0],changes[0]]}));assert.throws(()=>applyAction(d,{...action,changes:[{...changes[0],removed:'yes'}]}));
 });
