import assert from 'node:assert/strict';
import {test} from 'node:test';
import {applyAction} from '../lib/model.ts';
import {seedData} from './fixtures.mjs';
import {captureAttendanceView,attendanceViewPeople} from '../lib/attendance-view.ts';
function setup(){let d=seedData();return applyAction(d,{type:'create-event',name:'Training',date:'2026-10-12',rosterId:d.rosters[0].id});}
test('unmarked rows stay visible with live statuses until the user changes view',()=>{let d=setup(),e=d.events[0],p=e.participants[0];const view=captureAttendanceView(e,'',[],true,null);d=applyAction(d,{type:'status',eventId:e.id,personId:p.id,status:'Present'});e=d.events[0];assert.equal(captureAttendanceView(e,'',[],true,view),view);assert.equal(attendanceViewPeople(e,view)[0].status,'Present');assert.equal(attendanceViewPeople(e,view).length,48);const next=captureAttendanceView(e,'',['Present'],false,view);assert.deepEqual(attendanceViewPeople(e,next).map(p=>p.id),[p.id]);const back=captureAttendanceView(e,'',[],true,next);assert.equal(attendanceViewPeople(e,back).length,47);});
test('excuse changes stay in the selected view, while search, event and explicit refresh recapture',()=>{let d=setup(),e=d.events[0],p=e.participants[0];d=applyAction(d,{type:'status',eventId:e.id,personId:p.id,status:'Tardy'});e=d.events[0];const view=captureAttendanceView(e,'',['Unexcused'],false,null);d=applyAction(d,{type:'excuse',eventId:e.id,personId:p.id,excuse:'academic'});e=d.events[0];assert.equal(attendanceViewPeople(e,view)[0].excuse,'academic');assert.equal(captureAttendanceView(e,'',['Unexcused'],false,view),view);assert.equal(attendanceViewPeople(e,captureAttendanceView(e,'',['Unexcused'],false,view,1)).length,0);assert.equal(attendanceViewPeople(e,captureAttendanceView(e,'YExample58',['Unexcused'],false,view)).length,0);assert.notEqual(captureAttendanceView({...e,id:'other-event'},'',['Unexcused'],false,view).key,view.key);});
test('retained membership respects removals and saved reordering',()=>{let d=setup(),e=d.events[0];const view=captureAttendanceView(e,'',[],true,null),ids=e.participants.map(p=>p.id);d=applyAction(d,{type:'reorder-event',eventId:e.id,personIds:ids.slice().reverse(),personId:ids[0]});assert.equal(attendanceViewPeople(d.events[0],view)[0].id,ids.at(-1));d=applyAction(d,{type:'remove-event-person',eventId:e.id,personId:ids[0]});assert.equal(attendanceViewPeople(d.events[0],view).length,47);});
test('flag and completed views select distinct people and preserve membership until switching',()=>{const d=setup(),e=d.events[0];e.participants[0].flag='flagged';e.participants[1].flag='complete';let view=captureAttendanceView(e,'',[],false,null,0,'flagged');assert.deepEqual(attendanceViewPeople(e,view).map(p=>p.id),[e.participants[0].id]);e.participants[0].flag='complete';assert.equal(captureAttendanceView(e,'',[],false,view,0,'flagged'),view);view=captureAttendanceView(e,'',[],false,view,0,'complete');assert.equal(attendanceViewPeople(e,view).length,2);view=captureAttendanceView(e,'',[],false,view,0,null);assert.equal(attendanceViewPeople(e,view).length,e.participants.length);});

test('restores and newly added people immediately refresh filtered membership',()=>{
 let d=setup(),e=d.events[0],p=e.participants[0];
 d=applyAction(d,{type:'remove-event-person',eventId:e.id,personId:p.id});e=d.events[0];
 const removed=captureAttendanceView(e,'',[],true,null);
 assert.equal(attendanceViewPeople(e,removed).length,47);
 d=applyAction(d,{type:'restore-event-person',eventId:e.id,personId:p.id});e=d.events[0];
 const restored=captureAttendanceView(e,'',[],true,removed);
 assert.equal(attendanceViewPeople(e,restored).length,48);
 d=applyAction(d,{type:'add-event-people',eventId:e.id,names:'New Person'});e=d.events[0];
 const added=captureAttendanceView(e,'',[],true,restored);
 assert.equal(attendanceViewPeople(e,added).length,49);
});

test('attendance search matches the hidden short ID and respects active filters',()=>{
 const d=setup(),e=d.events[0],person=e.participants[0],uid=d.personIds[person.id],lookup=p=>d.personIds[p.id];const view=captureAttendanceView(e,uid.toLowerCase(),[],true,null,0,null,[],undefined,lookup);assert.deepEqual(attendanceViewPeople(e,view).map(p=>p.id),[person.id]);const changed=captureAttendanceView(e,uid,[],true,view,0,null,[],undefined,p=>p.id===person.id?'ZZZZZZZ':lookup(p));assert.equal(attendanceViewPeople(e,changed).length,0);
});
