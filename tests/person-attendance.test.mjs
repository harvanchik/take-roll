import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {applyAction,personFromFields,displayEvent,normalizeAttendanceData} from '../lib/model.ts';
import {withPersonIds,personForUid,personPath} from '../lib/person-identity.ts';
import {personAttendance,filterPersonAttendance,personAttendanceTotals,rosterAttendance,rosterAttendanceSortValue,rosterSummary} from '../lib/person-attendance.ts';
import {livePatch,applyLivePatch} from '../lib/live-patch.ts';
const at='2026-10-22T12:00:00Z';
const fields={firstName:'John',lastName:'Smith',preferredFirstName:'',firstPronunciation:'',lastPronunciation:''};
const person=id=>personFromFields(fields,id);
function setup(){return withPersonIds({rosters:[{id:'r1',name:'Staff',people:[person('1234567a-1111-4111-8111-111111111111'),person('1234567b-2222-4222-8222-222222222222')],createdAt:at,updatedAt:at},{id:'r2',name:'Officials',people:[],createdAt:at,updatedAt:at}],events:[]});}
function event(d,rosterId='r1',name='Training'){return applyAction(d,{type:'create-event',rosterId,name,date:'2026-10-22'},at);}
test('short IDs are seven characters, collision checked, stable across reload/reordering and never link duplicate names',()=>{
 const input=setup(),original=structuredClone(input),ids=Object.values(input.personIds);
 assert.equal(new Set(ids).size,2);assert.ok(ids.every(id=>/^[A-Z0-9]{7}$/.test(id)));assert.notEqual(ids[0],ids[1]);
 const reordered=structuredClone(input);reordered.rosters[0].people.reverse();assert.deepEqual(withPersonIds(reordered).personIds,input.personIds);
 assert.deepEqual(normalizeAttendanceData(JSON.parse(JSON.stringify(input))).personIds,input.personIds);assert.deepEqual(input,original);
 assert.equal(personForUid(input,ids[0].toLowerCase()).id,input.rosters[0].people[0].id);
});
test('migration preserves attendance, names, full UUIDs, histories and existing links without name matching',()=>{
 let d=event(setup());const e=d.events[0],id=e.participants[0].id;d=applyAction(d,{type:'status',eventId:e.id,personId:id,status:'Present'},at);
 delete d.personIds;const before=structuredClone(d),migrated=normalizeAttendanceData(d);assert.deepEqual(migrated.events,before.events);assert.deepEqual(migrated.rosters,before.rosters);assert.deepEqual(d,before);
 assert.equal(personAttendance(migrated,id).length,1);assert.equal(personAttendanceTotals(personAttendance(migrated,id)).attended,1);
 const unrelated=structuredClone(d.events[0]);unrelated.participants[0]={...unrelated.participants[0],id:'unrelated',firstName:'John',lastName:undefined};assert.equal(displayEvent(d,unrelated).participants[0].lastName,undefined);
});
test('explicit linking reuses identity across rosters, events and subevents while same-name additions get separate IDs',()=>{
 let d=setup();const p=d.rosters[0].people[0],uid=d.personIds[p.id];d=applyAction(d,{type:'link-roster-person',rosterId:'r2',uid},at);assert.equal(d.rosters[1].people[0].id,p.id);
 d=event(d);d=event(d,'r2','Officials');d=applyAction(d,{type:'create-subevent',eventId:d.events[1].id,name:'Day 2',date:'2026-10-23'},at);
 assert.equal(personAttendance(d,p.id).length,3);assert.equal(personAttendance(d,d.rosters[0].people[1].id).length,1);
 d=applyAction(d,{type:'edit-person',rosterId:'r2',personId:p.id,fields:{...fields,lastName:'Jones'}},at);assert.equal(d.personIds[p.id],uid);assert.equal(personAttendance(d,p.id).length,3);
 assert.throws(()=>applyAction(d,{type:'link-roster-person',rosterId:'r2',uid},at),/Already/);assert.throws(()=>applyAction(d,{type:'link-roster-person',rosterId:'r2',uid:'ZZZZZZZ'},at),/Not Found/);
 const removed=applyAction(d,{type:'remove-person-from-all-rosters',rosterId:'r1',personId:p.id},at);assert.equal(removed.rosters[0].people[0].id,d.rosters[0].people[1].id);assert.equal(removed.rosters[1].people.length,0);assert.equal(personAttendance(removed,p.id).length,3);
 assert.throws(()=>applyAction(removed,{type:'link-roster-person',rosterId:'r1',uid},at),/Restore/);
 const reused=applyAction(removed,{type:'add-roster-people',rosterId:'r2',csv:'John,Smith,,,'},at);assert.notEqual(reused.rosters[1].people[0].id,p.id);assert.notEqual(reused.personIds[reused.rosters[1].people[0].id],uid);
 assert.deepEqual(applyLivePatch(d,livePatch(d,reused)),reused);
});
test('filtered summaries respect event overrides, excused and unmarked records, removed membership and archives',()=>{
 let d=event(setup()),id=d.rosters[0].people[0].id;d=applyAction(d,{type:'create-subevent',eventId:d.events[0].id,name:'Day 2',date:'2026-10-23'},at);d=applyAction(d,{type:'create-subevent',eventId:d.events[0].id,name:'Day 3',date:'2026-10-24'},at);
 d=applyAction(d,{type:'status',eventId:d.events[0].id,personId:id,status:'Present'},at);d=applyAction(d,{type:'status',eventId:d.events[1].id,personId:id,status:'Absent'},at);d=applyAction(d,{type:'excuse',eventId:d.events[1].id,personId:id,excuse:'work'},at);
 d.events[0].participants[0].note='Safety training';d=applyAction(d,{type:'archive-event',eventId:d.events[0].id},at);
 const rows=personAttendance(d,id),totals=personAttendanceTotals(rows);assert.equal(rows.length,3);assert.ok(rows.every(r=>r.archived));assert.deepEqual(totals,{sessions:3,marked:2,attended:1,absent:0,excused:1,unmarked:1,rate:50});
 const filter={from:'',to:'',roster:[],status:[],excuse:[],search:''};assert.equal(filterPersonAttendance(rows,{...filter,from:'2026-10-23',to:'2026-10-23',roster:['r1'],excuse:['Work']}).length,1);assert.equal(filterPersonAttendance(rows,{...filter,search:'safety'}).length,1);assert.equal(filterPersonAttendance(rows,{...filter,status:['Unmarked']}).length,1);
 rows[1].person.removed=true;assert.equal(personAttendanceTotals(rows).rate,100);d.events[1].subeventDeleted=true;assert.equal(personAttendance(d,id).length,2);
 const onlyUnmarked=rows.filter(r=>!r.person.status);assert.equal(personAttendanceTotals(onlyUnmarked).rate,null);
});
test('removed and permanently deleted roster entries keep links to saved event records without reusing IDs',()=>{
 let d=event(setup()),id=d.rosters[0].people[0].id,uid=d.personIds[id];d=applyAction(d,{type:'remove-roster-person',rosterId:'r1',personId:id},at);d=applyAction(d,{type:'delete-roster-person',rosterId:'r1',personId:id},at);
 assert.equal(personForUid(d,uid).id,id);assert.equal(personAttendance(d,id).length,1);assert.equal(d.personIds[id],uid);
});
test('attendance labels group by the base status while excuse types remain in their own column',()=>{
 let d=event(setup()),id=d.rosters[0].people[0].id,e=d.events[0];
 d=applyAction(d,{type:'status',eventId:e.id,personId:id,status:'Tardy'},at);d=applyAction(d,{type:'excuse',eventId:e.id,personId:id,excuse:'work'},at);
 let row=personAttendance(d,id)[0];assert.equal(row.label,'Tardy');assert.equal(row.excuse,'Work');
 d=applyAction(d,{type:'attendance-state',eventId:e.id,personId:id,status:'Excused (Academic)',excuse:'academic'},at);row=personAttendance(d,id)[0];assert.equal(row.label,'Excused');assert.equal(row.excuse,'Academic');
});
test('multi-select filters use OR within a filter and AND across filters, and empty selections include all',()=>{
 let d=event(setup()),id=d.rosters[0].people[0].id,uid=d.personIds[id];d=applyAction(d,{type:'link-roster-person',rosterId:'r2',uid},at);d=event(d,'r2','Officials');d=applyAction(d,{type:'create-subevent',eventId:d.events[0].id,name:'Day 2',date:'2026-10-23'},at);
 d=applyAction(d,{type:'status',eventId:d.events[0].id,personId:id,status:'Present'},at);d=applyAction(d,{type:'status',eventId:d.events[1].id,personId:id,status:'Tardy'},at);d=applyAction(d,{type:'excuse',eventId:d.events[1].id,personId:id,excuse:'work'},at);
 d=applyAction(d,{type:'attendance-state',eventId:d.events[2].id,personId:id,status:'Excused (Academic)',excuse:'academic'},at);
 const rows=personAttendance(d,id),empty={from:'',to:'',roster:[],status:[],excuse:[],search:''};
 assert.equal(filterPersonAttendance(rows,empty).length,3);assert.equal(filterPersonAttendance(rows,{...empty,status:['Present','Tardy']}).length,2);
 assert.equal(filterPersonAttendance(rows,{...empty,roster:['r1','r2'],excuse:['Work','Academic']}).length,2);
 assert.equal(filterPersonAttendance(rows,{...empty,roster:['r1'],status:['Tardy','Excused'],excuse:['Work','Academic']}).length,1);
 assert.equal(filterPersonAttendance(rows,{...empty,status:['No Longer Used']}).length,0);
});
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));

await build({entryPoints:['app/person-attendance.tsx','app/roll-call.tsx','app/name-preferences.tsx','app/personal-preferences.tsx','app/event-change-history.tsx','app/attendance-overview.tsx','lib/navigation.ts','lib/sign-in.ts','lib/page-access.ts'],bundle:true,platform:'node',format:'esm',splitting:true,jsx:'automatic',packages:'external',outdir:'.sites-runtime/person-attendance-test'});
const {resolvePage}=await import('../.sites-runtime/person-attendance-test/lib/navigation.js'),{safeSignInReturn}=await import('../.sites-runtime/person-attendance-test/lib/sign-in.js'),{protectedPage}=await import('../.sites-runtime/person-attendance-test/lib/page-access.js');
test('person URLs resolve only IDs in the selected workspace and remain protected after refresh/sign-in',()=>{
 const d=setup(),uid=d.personIds[d.rosters[0].people[0].id],path=personPath(uid);assert.equal(resolvePage(d,path).view,'person');assert.equal(resolvePage(d,path).personUid,uid);assert.equal(resolvePage(d,path.toLowerCase()).personUid,uid);assert.equal(resolvePage(d,'/person/ZZZZZZZ').missing,true);assert.equal(resolvePage(d,'/person/invalid-too-long').missing,true);assert.equal(resolvePage({rosters:[],events:[]},path).missing,true);assert.equal(protectedPage(path),true);assert.equal(safeSignInReturn(path+'?workspace=selected'),path+'?workspace=selected');
});
const {default:AttendanceOverview}=await import('../.sites-runtime/person-attendance-test/app/attendance-overview.js');
const {PersonalPreferences}=await import('../.sites-runtime/person-attendance-test/app/personal-preferences.js'),{default:EventChangeHistory}=await import('../.sites-runtime/person-attendance-test/app/event-change-history.js');
const {default:PersonAttendance}=await import('../.sites-runtime/person-attendance-test/app/person-attendance.js'),{RosterPerson,AttendanceRow:AttendanceRowForTest}=await import('../.sites-runtime/person-attendance-test/app/roll-call.js'),{NamePreferences}=await import('../.sites-runtime/person-attendance-test/app/name-preferences.js'),{createElement:h}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
test('compact roster IDs are copy buttons alongside names, and attendance links preserve workspace selection',()=>{
 const d=event(setup()),p=d.rosters[0].people[0],uid=d.personIds[p.id],html=renderToStaticMarkup(h(NamePreferences,null,h(RosterPerson,{person:p,index:1,busy:false,duplicate:true,uid,workspaceId:'workspace-two',onNavigate(){},onAction:async()=>true})));
 assert.ok(html.includes('Copy Person ID '+uid));assert.ok(html.includes('/person/'+uid+'?workspace=workspace-two'));assert.ok(html.includes('View Attendance Record'));assert.ok(!html.includes('<th'));
 const page=renderToStaticMarkup(h(NamePreferences,null,h(PersonAttendance,{data:d,uid,workspaceId:'workspace-two',onNavigate(){}})));
 for(const label of ['Attendance Rate','All Rosters','All Statuses','All Excuses','Last Changed','View History','John Smith'])assert.ok(page.includes(label),label);assert.ok(page.includes('<table'));assert.ok(page.includes('?workspace=workspace-two'));assert.ok(!page.includes('Edit Person'));
 const headings=page.match(/<thead>[\s\S]*?<\/thead>/)[0].replace(/<[^>]*>/g,' ');
 assert.ok(/Event.*Date.*Note.*Attendance.*Excuse.*Flag.*Last Changed/.test(headings),headings);
 assert.ok(page.includes('Select Start Date'));assert.ok(page.includes('Select End Date'));assert.ok(!page.includes('type="date"'));for(const label of ['Attended','Unexcused Absences','Excused','Unmarked','Attendance Rate'])assert.ok(page.includes('About '+label),label);assert.ok(!page.includes('About Sessions'));assert.ok(!page.includes('person-rate-note'));assert.ok(!page.includes('person-back'));
 const cells=page.match(/<tbody>[\s\S]*?<\/tbody>/)[0].match(/<td\b[\s\S]*?<\/td>/g);assert.equal(cells.length,7);assert.ok(!cells[5].includes('—'));assert.equal((page.match(/class="timestamp-button"/g)||[]).length,1);assert.ok(!headings.includes('HISTORY'));
});

test('roster filters and search follow current roster names by ID while retaining historical names after deletion',()=>{
 let d=event(setup()),id=d.rosters[0].people[0].id;const original=structuredClone(d.events);
 d=applyAction(d,{type:'rename-roster',rosterId:'r1',name:'Intramural Sports Staff'},at);
 assert.deepEqual(d.events,original);d=applyAction(d,{type:'create-subevent',eventId:d.events[0].id,name:'Tuesday',date:'2026-10-23'},at);
 const rows=personAttendance(d,id),filter={from:'',to:'',roster:['r1'],status:[],excuse:[],search:'intramural'};
 assert.equal(rows.length,2);assert.ok(rows.every(row=>row.rosterName==='Intramural Sports Staff'));assert.equal(filterPersonAttendance(rows,filter).length,2);
 assert.equal(d.events[0].rosterName,original[0].rosterName);assert.equal(rows[0].event.rosterName,'Staff');
 const deleted=applyAction(d,{type:'delete-roster',rosterId:'r1'},at);assert.ok(personAttendance(deleted,id).every(row=>row.rosterName==='Staff'));
 const page=renderToStaticMarkup(h(NamePreferences,null,h(PersonAttendance,{data:d,uid:d.personIds[id],onNavigate(){}})));
 assert.ok(page.includes('Intramural Sports Staff'));assert.ok(!page.includes('>Staff<'));
});

test('linked removed roster memberships preserve the deletion time and restore cleanly',async()=>{
 const {personRosterMemberships}=await import('../lib/person-attendance.ts');let d=event(setup()),id=d.rosters[0].people[0].id,uid=d.personIds[id];d=applyAction(d,{type:'link-roster-person',rosterId:'r2',uid},at);const linked=d.rosters[1].people[0].id;d=applyAction(d,{type:'remove-roster-person',rosterId:'r2',personId:linked},'2026-10-23T16:42:00Z');
 const memberships=personRosterMemberships(d,id);assert.deepEqual(memberships.map(x=>[x.roster.id,x.removedAt]),[['r1',null],['r2','2026-10-23T16:42:00Z']]);
 const page=renderToStaticMarkup(h(PersonalPreferences,{value:{theme:'dark',haptics:false,timeZone:'UTC'},owner:'test'},h(NamePreferences,null,h(PersonAttendance,{data:d,uid,onNavigate(){}}))));assert.ok(page.includes('person-roster-removed'));assert.ok(page.includes('Deleted from this Roster on 23 Oct 2026 at 4:42 PM'));
 d=applyAction(d,{type:'restore-roster-person',rosterId:'r2',personId:linked},at);assert.equal(personRosterMemberships(d,id)[1].removedAt,null);assert.equal(personAttendance(d,id).length,1);
});
test('person history sort values include note and flag independently of the event date',async()=>{
 const {personAttendanceSortValue}=await import('../lib/person-attendance.ts');let d=event(setup()),id=d.rosters[0].people[0].id,e=d.events[0];d=applyAction(d,{type:'person-note',eventId:e.id,personId:id,note:'Follow up'},at);d=applyAction(d,{type:'person-flag',eventId:e.id,personId:id,flag:'flagged'},at);const row=personAttendance(d,id)[0];assert.equal(personAttendanceSortValue(row,'Note'),'Follow up');assert.equal(personAttendanceSortValue(row,'Flag'),'flagged');assert.equal(personAttendanceSortValue(row,'Date'),'2026-10-22');
});

test('event history keeps the entire long change value available for horizontal scrolling',()=>{
 let d=event(setup()),eventId=d.events[0].id,personId=d.rosters[0].people[0].id,note='A detailed history entry '.repeat(24);d=applyAction(d,{type:'person-note',eventId,personId,note},at);const html=renderToStaticMarkup(h(NamePreferences,null,h(EventChangeHistory,{data:d,event:d.events[0]})));assert.ok(html.includes(note));assert.ok(!html.includes('Show Full To Value'));
});

test('view-only follow-up icons expose the actual flag-change timestamp, not later edits',()=>{
 let d=event(setup()),personId=d.rosters[0].people[0].id,eventId=d.events[0].id,uid=d.personIds[personId];d=applyAction(d,{type:'person-flag',eventId,personId,flag:'flagged'},'2026-10-23T16:42:00Z');d=applyAction(d,{type:'person-note',eventId,personId,note:'Later edit'},'2026-10-24T16:42:00Z');
 const props={value:{theme:'dark',haptics:false,timeZone:'UTC'},owner:'test'},tree=h(PersonalPreferences,props,h(NamePreferences,null,h(PersonAttendance,{data:d,uid,onNavigate(){}})));let html=renderToStaticMarkup(tree);assert.ok(html.includes('data-tooltip="Flagged on 23 Oct 2026 4:42 PM."'));assert.ok(!html.includes('Flagged on 24 Oct'));
 const person=d.events[0].participants.find(p=>p.id===personId),row=renderToStaticMarkup(h(PersonalPreferences,props,h(NamePreferences,null,h(AttendanceRowForTest,{person,index:1,duplicate:false,duplicateNumber:1,busy:false,readOnly:true,onAction:async()=>true}))));assert.ok(row.includes('data-tooltip="Flagged on 23 Oct 2026 4:42 PM."'));assert.ok(!row.includes('Mark complete'));
 d.events.find(e=>e.id===eventId).participants.find(p=>p.id===personId).history=[];html=renderToStaticMarkup(h(PersonalPreferences,props,h(NamePreferences,null,h(PersonAttendance,{data:d,uid,onNavigate(){}}))));assert.ok(html.includes('Flagged — date unavailable'));
});

test('overview uses dated indicators only in read-only mode',()=>{
 let d=event(setup()),personId=d.rosters[0].people[0].id,eventId=d.events[0].id;d=applyAction(d,{type:'person-flag',eventId,personId,flag:'complete'},'2026-10-23T16:42:00Z');const controls={search:'',filter:[],unmarked:false,flagFilter:null,onSearch(){},onAll(){},onToggle(){},onUnmarked(){},onFlag(){}},props={data:d,parent:d.events[0],controls,onSelection(){},busy:true,readOnly:true};const render=props=>renderToStaticMarkup(h(PersonalPreferences,{value:{theme:'dark',haptics:false,timeZone:'UTC'},owner:'test'},h(NamePreferences,null,h(AttendanceOverview,props))));
 const archived=render(props);assert.ok(archived.includes('data-tooltip="Completed on 23 Oct 2026 4:42 PM."'));assert.ok(!archived.includes('data-tooltip="Clear Flag"'));const writable=render({...props,readOnly:false,busy:false});assert.ok(writable.includes('data-tooltip="Clear Flag"'));
});

test('test-only event family is hidden from person records and restored on switching off',()=>{
 let d=event(setup()),record=d.events[0],person=record.participants[0];d=applyAction(d,{type:'create-subevent',eventId:record.id,name:'Day 2',date:'2026-10-23'});d=applyAction(d,{type:'status',eventId:record.id,personId:person.id,status:'Present'});const rows=personAttendance(d,person.id);const before=personAttendanceTotals(rows);assert.equal(before.sessions,2);d=applyAction(d,{type:'update-event-settings',eventId:record.id,settings:{useGlobal:true,testOnly:true}});const testRows=personAttendance(d,person.id);assert.equal(testRows.length,0);assert.equal(personAttendanceTotals(testRows).sessions,0);d=applyAction(d,{type:'update-event-settings',eventId:record.id,settings:{useGlobal:true,testOnly:false}});assert.deepEqual(personAttendanceTotals(personAttendance(d,person.id)),before);
});

test('roster attendance uses event origin even for people in linked rosters',()=>{
 let d=setup();const p=d.rosters[0].people[0];d.rosters[1].people.push({...p});d=event(d,'r1','Roster One');d=event(d,'r2','Roster Two');d=applyAction(d,{type:'status',eventId:d.events[0].id,personId:p.id,status:'Present'});d=applyAction(d,{type:'status',eventId:d.events[1].id,personId:p.id,status:'Absent'});d=applyAction(d,{type:'create-subevent',eventId:d.events[0].id,name:'Second',date:'2026-10-23'});const one=personAttendanceTotals(rosterAttendance(d,p.id,'r1')),two=personAttendanceTotals(rosterAttendance(d,p.id,'r2'));assert.equal(one.sessions,2);assert.equal(one.attended,1);assert.equal(one.absent,0);assert.equal(two.sessions,1);assert.equal(two.attended,0);assert.equal(two.absent,1);assert.equal(personAttendance(d,p.id).length,3);
});
test('roster metric sort values are numeric and notes are sortable',()=>{
 const values={sessions:12,attended:7,absent:3,excused:2,rate:70};for(const [key,value] of [['Sessions',12],['Attended',7],['Unexcused Absences',3],['Excused',2],['Attendance Rate',70],['Notes','Reminder']])assert.equal(rosterAttendanceSortValue(values,key,'Reminder'),value);assert.equal(rosterAttendanceSortValue({...values,rate:null},'Attendance Rate',''),-1);
});

test('roster summary counts official event families and rates only marked active people',()=>{
 let d=event(setup()),root=d.events[0],people=d.rosters[0].people;
 d=applyAction(d,{type:'status',eventId:root.id,personId:people[0].id,status:'Present'},at);
 d=applyAction(d,{type:'status',eventId:root.id,personId:people[1].id,status:'Absent'},at);
 d=applyAction(d,{type:'excuse',eventId:root.id,personId:people[1].id,excuse:'work'},at);
 d=applyAction(d,{type:'create-subevent',eventId:root.id,name:'Second',date:'2026-10-23'},at);
 d=event(d,'r1','Practice Test');const testEvent=d.events.find(e=>e.name==='Practice Test');d=applyAction(d,{type:'update-event-settings',eventId:testEvent.id,settings:{useGlobal:true,testOnly:true}},at);
 const rows=people.flatMap(p=>rosterAttendance(d,p.id,'r1'));
 assert.deepEqual(rosterSummary(d,'r1',rows,people.length),{events:1,subevents:2,people:2,excusedRate:50,unexcusedRate:0,attendanceRate:50});
 assert.deepEqual(rosterSummary(d,'r2',[],0),{events:0,subevents:0,people:0,excusedRate:null,unexcusedRate:null,attendanceRate:null});
});
