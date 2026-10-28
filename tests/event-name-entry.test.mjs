import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedData,applyAction,personFields} from '../lib/model.ts';
function setup(){let data=seedData();data=applyAction(data,{type:'create-event',rosterId:data.rosters[0].id,name:'Training',date:'2026-10-19'});return applyAction(data,{type:'create-subevent',eventId:data.events[0].id,name:'Afternoon',date:'2026-10-19'});}
test('event name input preserves all five fields and only adds to the selected subevent',()=>{
 const data=setup(),target=data.events[1],before=target.participants.length;
 const fields={firstName:'Alexandra',lastName:'Rivera',firstPronunciation:'al-ig-ZAN-druh',lastPronunciation:'ree-VEH-rah',preferredFirstName:'Alex'};
 const csv=Object.values(fields).map(value=>'"'+value.replace(/"/g,'""')+'"').join(',');
 const next=applyAction(data,{type:'add-event-people',eventId:target.id,csv});
 assert.equal(next.events[1].participants.length,before+1);assert.deepEqual(personFields(next.events[1].participants.at(-1)),fields);
 assert.deepEqual(next.events[0],data.events[0]);assert.deepEqual(next.rosters,data.rosters);
 const added=next.events[1].participants.at(-1);assert.equal(added.status,null);assert.equal(added.history[0].kind,'Membership');
});
test('structured event additions validate names and enforce the shared event limit',()=>{
 const data=setup(),event=data.events[0];
 assert.throws(()=>applyAction(data,{type:'add-event-people',eventId:event.id,csv:''}));
 assert.throws(()=>applyAction(data,{type:'add-event-people',eventId:event.id,csv:',Rivera,,,'}));
 event.participants=Array.from({length:500},(_,i)=>({...event.participants[0],id:String(i)}));
 assert.throws(()=>applyAction(data,{type:'add-event-people',eventId:event.id,csv:'Alex,Rivera,,,'}),/500/);
});

test('all-subevent additions share identity but keep independent attendance and history',()=>{
 let data=setup();data=applyAction(data,{type:'create-event',rosterId:data.rosters[0].id,name:'Other',date:'2026-10-19'});
 const source=data.events.find(e=>e.subeventName==='Afternoon'),unrelated=data.events.at(-1);
 const next=applyAction(data,{type:'add-event-people',eventId:source.id,scope:'all',csv:'Alex,Rivera,,,'});
 const family=next.events.filter(e=>e.id===(source.parentEventId||source.id)||e.parentEventId===source.parentEventId);
 const added=family.map(e=>e.participants.at(-1));assert.equal(family.length,2);assert.equal(new Set(added.map(p=>p.id)).size,1);
 assert.notEqual(added[0].history,added[1].history);assert.notEqual(added[0].history[0].id,added[1].history[0].id);
 assert.deepEqual(next.events.find(e=>e.id===unrelated.id),unrelated);assert.deepEqual(next.rosters,data.rosters);
 const marked=applyAction(next,{type:'status',eventId:family[0].id,personId:added[0].id,status:'Present'});
 assert.equal(marked.events.find(e=>e.id===family[1].id).participants.at(-1).status,null);
});
test('all-subevent additions validate every destination before adding anyone',()=>{
 const data=setup(),source=data.events[1];
 data.events[0].participants=Array.from({length:500},(_,i)=>({...data.events[0].participants[0],id:String(i)}));
 const before=JSON.stringify(data);assert.throws(()=>applyAction(data,{type:'add-event-people',eventId:source.id,scope:'all',csv:'Alex,Rivera,,,'}),/500/);assert.equal(JSON.stringify(data),before);
 assert.throws(()=>applyAction(data,{type:'add-event-people',eventId:source.id,scope:'other',csv:'Alex,Rivera,,,'}),/Scope/);
 data.events[0].participants=[];data.events[0].archivedAt='2026-10-19T12:00:00Z';
 assert.throws(()=>applyAction(data,{type:'add-event-people',eventId:source.id,scope:'all',csv:'Alex,Rivera,,,'}),/Archived|Restore/);
});
