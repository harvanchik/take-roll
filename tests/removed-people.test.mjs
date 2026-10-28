import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {createElement as h} from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {applyAction} from '../lib/model.ts';
import {seedData} from './fixtures.mjs';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({stdin:{contents:"export {AttendanceRow} from './app/roll-call';export {editTarget} from './lib/edit-conflicts';export {default as ChangeHistory} from './app/change-history';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',outfile:'.sites-runtime/removed-people-test.mjs'});
const {AttendanceRow,ChangeHistory,editTarget}=await import('../.sites-runtime/removed-people-test.mjs');
test('name and pronunciation share an attendance-record link with the selected workspace, including read-only rows',()=>{
 const person={id:'historical-row',name:'Alex Rivera',pronunciation:'AL-ex ree-VAIR-uh',status:null,note:'',updatedAt:null,removed:false,history:[]},props={person,index:1,duplicate:false,duplicateNumber:1,busy:false,onAction:async()=>true,recordUid:'ABC1234',workspaceId:'workspace-two'};
 for(const readOnly of [false,true]){
  const html=render(h(AttendanceRow,{...props,readOnly})),link=html.match(/<a class="attendance-person-link"[\s\S]*?<\/a>/)?.[0];assert.ok(link);assert.ok(link.includes('/person/ABC1234?workspace=workspace-two'));assert.ok(link.includes('Alex Rivera'));assert.ok(link.includes('AL-ex ree-VAIR-uh'));
 }
 for(const mode of [{demo:true},{preview:true}])assert.ok(!render(h(AttendanceRow,{...props,...mode})).includes('attendance-person-link'));
});
function setup(){let data=seedData();data=applyAction(data,{type:'create-event',rosterId:data.rosters[0].id,name:'Training',date:'2026-10-19'});return applyAction(data,{type:'create-subevent',eventId:data.events[0].id,name:'Afternoon',date:'2026-10-19'});}
test('removed attendance rows preserve visible fields, disable editing, and expose restore/delete/history controls',()=>{
 const person={id:'person',name:'Alex Rivera',pronunciation:'AL-ex',note:'Follow up tomorrow',status:'Tardy',excuse:'work',flag:'flagged',removed:true,updatedAt:'2026-10-19T14:00:00Z',history:[{id:'removal',at:'2026-10-19T13:00:00Z',kind:'Membership',from:'Included',to:'Removed'}]};
 const html=render(h(AttendanceRow,{person,index:1,duplicate:false,duplicateNumber:1,busy:false,onAction:async()=>true}));
 assert.match(html,/Follow up tomorrow/);assert.match(html,/textarea[^>]+disabled/);assert.match(html,/Removed On/);assert.match(html,/dateTime="2026-10-19T13:00:00Z"/i);
 assert.match(html,/data-tooltip="Restore Person"/);assert.match(html,/data-tooltip="Permanently Delete Person"/);assert.match(html,/aria-label="Open change history for Alex Rivera"/);
 for(const [,attrs] of html.matchAll(/<button([^>]+)>/g))if(attrs.includes('status-button')||attrs.includes('person-flag'))assert.ok(attrs.includes('disabled'),attrs);
 const history=render(h(ChangeHistory,{entries:person.history,name:person.name,busy:false,readOnly:true,onClear:async()=>true}));assert.match(history,/Included/);assert.ok(!history.includes('history-clear-button'));
});
test('permanent person deletion only accepts removed records and cannot be restored or overwritten by stale edits',()=>{
 let data=setup();const target=data.events[0],id=target.participants[0].id,action={type:'delete-event-person',eventId:target.id,personId:id};
 assert.throws(()=>applyAction(data,action),/Remove This Person/);
 data=applyAction(data,{type:'person-note',eventId:target.id,personId:id,note:'Private Note'});
 data=applyAction(data,{type:'remove-event-person',eventId:target.id,personId:id});
 const before=editTarget(data,action),next=applyAction(data,action);
 assert.ok(!next.events[0].participants.some(p=>p.id===id));assert.deepEqual(next.events[1],data.events[1]);assert.deepEqual(next.rosters,data.rosters);assert.notDeepEqual(editTarget(next,action),before);
 assert.throws(()=>applyAction(next,{type:'restore-event-person',eventId:target.id,personId:id}),/not found/i);
 assert.throws(()=>applyAction(next,{type:'person-note',eventId:target.id,personId:id,note:'Stale'}),/not found/i);
 assert.throws(()=>applyAction(next,{type:'restore-and-edit-person',eventId:target.id,personId:id,edit:{type:'person-note',eventId:target.id,personId:id,note:'Stale'}}));
 data.events[0].archivedAt='2026-10-19T14:00:00Z';assert.throws(()=>applyAction(data,action),/Archived/);
});

test('archived attendance rows disable every mutation while leaving history available',()=>{
 const person={id:'archived-person',name:'Alex Rivera',note:'Saved Note',pronunciation:'AL-ex',status:'Present',flag:'complete',removed:false,updatedAt:'2026-10-19T13:00:00Z',history:[]};
 const html=render(h(AttendanceRow,{person,index:1,duplicate:false,duplicateNumber:1,busy:false,readOnly:true,onAction:async()=>true}));
 assert.match(html,/Saved Note/);assert.match(html,/textarea[^>]+disabled/);
 for(const [,attrs] of html.matchAll(/<button([^>]+)>/g)){
  if(attrs.includes('timestamp-button'))assert.ok(!attrs.includes('disabled'),attrs);
  else assert.ok(attrs.includes('disabled'),attrs);
 }
 assert.ok(!html.includes('Removed On'));
});
