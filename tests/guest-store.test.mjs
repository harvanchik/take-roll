import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({entryPoints:['lib/guest-store.ts','lib/attendance-queue.ts','lib/edit-conflicts.ts'],bundle:true,platform:'node',format:'esm',outdir:'.sites-runtime/guest-test'});
const {GuestStore,GUEST_STORE_KEY,guestPath}=await import('../.sites-runtime/guest-test/guest-store.js');
const {AttendanceQueue}=await import('../.sites-runtime/guest-test/attendance-queue.js');
const {guardEdit}=await import('../.sites-runtime/guest-test/edit-conflicts.js');
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
async function fixture(){const disk=storage(),store=new GuestStore(disk);let state=store.open();const send=async action=>{state=await store.send({revision:state.revision,action});return state;};await send({type:'create-roster',name:'Guest staff',csv:'Ada,Lovelace,,,\nGrace,Hopper,,,'});const rosterId=state.data.rosters[0].id;await send({type:'create-event',rosterId,name:'Training',date:'2026-10-25'});return {disk,store,state,send};}
test('guest records start empty, persist across instances, use real attendance/history/settings, and never require network',async()=>{
 const {disk,store,state,send}=await fixture();const e=state.data.events[0],p=e.participants[0];
 await send({type:'status',eventId:e.id,personId:p.id,status:'Present'});
 await send({type:'person-note',eventId:e.id,personId:p.id,note:'Follow up'});
 await send({type:'update-profile',profile:{firstName:'Guest',lastName:'User',preferredName:''}});
 const reopened=new GuestStore(disk).open();assert.equal(reopened.data.events[0].participants[0].status,'Present');assert.equal(reopened.data.events[0].participants[0].note,'Follow up');assert.ok(reopened.data.events[0].participants[0].history.length);assert.equal(reopened.data.profile.firstName,'Guest');assert.equal(store.read().data.rosters.length,1);
 assert.equal(guestPath('/event/training/day-1?workspace=hosted'),'/event/training/day-1?guest=1');
});
test('guest save queue supports manual saving, subevent deletion, undo, redo, and refresh',async()=>{
 const {disk,store,state,send}=await fixture();let reply=await send({type:'create-subevent',eventId:state.data.events[0].id,name:'Day 2',date:'2026-10-26'});const event=reply.data.events.at(-1),root=reply.data.events[0];
 const queue=new AttendanceQueue(reply.data,reply.revision,b=>store.send(b),()=>{});
 queue.enqueue({type:'status',eventId:event.id,personId:event.participants[0].id,status:'Tardy'});assert.equal(await queue.flush(),true);
 queue.enqueue({type:'delete-subevent',eventId:event.id,restoreId:crypto.randomUUID()});assert.equal(await queue.flush(),true);assert.equal(store.read().data.events.length,1);
 queue.undo(root.id);assert.equal(await queue.flush(),true);assert.equal(store.read().data.events.length,2);assert.equal(store.read().data.events.at(-1).participants[0].status,'Tardy');
 queue.redo(root.id);assert.equal(await queue.flush(),true);assert.equal(new GuestStore(disk).open().data.events.length,1);
 const {defaultPreferences}=await import('../lib/workspace-settings.ts');
 reply=await store.send({revision:store.read().revision,action:{type:'update-preferences',preferences:{...defaultPreferences,autoSave:false}}});const manual=new AttendanceQueue(reply.data,reply.revision,b=>store.send(b),()=>{});manual.enqueue({type:'event-note',eventId:root.id,note:'Manual note'});assert.equal(store.read().data.events[0].note,'');assert.equal(await manual.savePending(),true);assert.equal(store.read().data.events[0].note,'Manual note');
});
test('blocked/full/corrupt browser storage fails visibly without false saves or overwriting records',async()=>{
 const {disk,store,state}=await fixture();const original=disk.getItem(GUEST_STORE_KEY);const broken={...disk,setItem(){throw Error('Quota exceeded');}};
 assert.throws(()=>new GuestStore(broken).open(),/Storage Is Full Or Unavailable/);
 await assert.rejects(()=>new GuestStore(broken).send({revision:state.revision,action:{type:'event-note',eventId:state.data.events[0].id,note:'Lost'}}),/Storage Is Full Or Unavailable/);assert.equal(disk.getItem(GUEST_STORE_KEY),original);
 disk.setItem(GUEST_STORE_KEY,'broken');assert.throws(()=>store.open(),/Stored Data Has Been Kept/);assert.equal(disk.getItem(GUEST_STORE_KEY),'broken');
});
test('guest tabs detect conflicting changes and mutations are idempotent',async()=>{
 const {disk,store,state}=await fixture();const another=new GuestStore(disk),action=guardEdit(state.data,{type:'event-note',eventId:state.data.events[0].id,note:'First'});const first=await store.send({revision:state.revision,action,mutationId:'same'});assert.equal((await store.send({revision:state.revision,action,mutationId:'same'})).revision,first.revision);
 const conflict=await another.send({revision:state.revision,action:{...action,note:'Second'}});assert.equal(conflict.code,'edit_conflict');assert.equal(store.read().data.events[0].note,'First');
});
