import assert from 'node:assert/strict';
import {test} from 'node:test';
import {applyAction,personFields,personFromFields,rosterCSV,CSV_HEADER,rosterPersonKey,rosterRemovalTargets,hasOtherActiveRoster,matchesPersonSearch,displayEvent,displayName} from '../lib/model.ts';
import {livePatch,applyLivePatch} from '../lib/live-patch.ts';
import {compactSaveReply,expandSaveReply} from '../lib/save-packet.ts';
import {createRequire} from 'node:module';import {dirname} from 'node:path';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({entryPoints:['lib/edit-conflicts.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'.sites-runtime/removed-roster-conflicts.mjs'});
const {guardEdit,editFingerprint}=await import('../.sites-runtime/removed-roster-conflicts.mjs');
const T1='2026-10-22T12:00:00Z',T2='2026-10-22T13:00:00Z',T3='2026-10-22T14:00:00Z';
const fields={firstName:'Alexandra',lastName:'Rivera',preferredFirstName:'Alex',firstPronunciation:'al-ig-ZAN-druh',lastPronunciation:'ree-VAIR-uh'};
const person=(id,f=fields)=>({...personFromFields(f,id),addedAt:T1,updatedAt:T1});
function setup(){return {rosters:[{id:'one',name:'One',people:[person('p1'),person('p2',{...fields,firstName:'Morgan'})],createdAt:T1,updatedAt:T1},{id:'two',name:'Two',people:[person('q1',{...fields,firstName:' alexandra ',lastName:' RIVERA ',preferredFirstName:'Ali'}),person('q2',{...fields,firstName:'Alex'})],createdAt:T1,updatedAt:T1}],events:[]};}
const change=(data,type,extra={})=>applyAction(data,{type,rosterId:'one',personId:'p1',...extra},T2);
test('removal retains exact fields and original position; restoration and permanent deletion are roster scoped',()=>{
 let d=applyAction(setup(),{type:'create-event',rosterId:'one',name:'Past Event',date:'2026-10-22'},T1);const events=structuredClone(d.events),before=structuredClone(d.rosters[0].people[0]);
 d=change(d,'remove-roster-person');assert.equal(d.rosters[0].people.length,1);assert.deepEqual(d.rosters[0].removedPeople,[{...before,removedAt:T2,removedIndex:0}]);assert.ok(!rosterCSV(d.rosters[0]).includes('Alexandra'));assert.deepEqual(d.events,events);
 assert.throws(()=>change(d,'edit-person',{fields:{...fields,firstName:'Forbidden'}}));
 d=change(d,'restore-roster-person');assert.equal(d.rosters[0].people[0].id,'p1');assert.deepEqual(personFields(d.rosters[0].people[0]),fields);assert.equal(d.rosters[0].people[0].addedAt,T1);assert.equal(d.rosters[0].removedPeople.length,0);assert.ok(!('removedAt' in d.rosters[0].people[0]));
 assert.throws(()=>change(d,'delete-roster-person'));d=change(d,'remove-roster-person');d=change(d,'delete-roster-person');assert.equal(d.rosters[0].removedPeople.length,0);assert.throws(()=>change(d,'restore-roster-person'));assert.equal(d.rosters[1].people.length,2);assert.deepEqual(d.events,events);
});
test('all-roster removal follows shared IDs and leaves independently imported identical names alone',()=>{
 const input=setup(),copy=structuredClone(input);input.rosters.push({id:'legacy',name:'Legacy',people:[{id:'legacy-p',name:'Alexandra Rivera',pronunciation:'Different'}],createdAt:T1,updatedAt:T1},{id:'linked',name:'Linked',people:[person('p1',{...fields,lastName:'Changed'})],createdAt:T1,updatedAt:T1});
 assert.equal(rosterRemovalTargets(input,'one','p1').length,2);const d=change(input,'remove-person-from-all-rosters');
 assert.deepEqual(d.rosters.map(r=>r.people.length),[1,2,1,0]);assert.deepEqual(d.rosters.map(r=>r.removedPeople?.length??0),[1,0,0,1]);assert.equal(d.rosters[1].people[0].id,'q1');
 assert.equal(rosterPersonKey(person('id')),'alexandra rivera');assert.deepEqual(input.rosters.slice(0,2),copy.rosters);
 const restored=change(d,'restore-roster-person');assert.equal(restored.rosters[0].people.length,2);assert.equal(restored.rosters[3].removedPeople.length,1);
 assert.throws(()=>change(d,'remove-person-from-all-rosters'));
});
test('CSV omissions are recoverable, preserve earlier removed names and never rewrite saved events',()=>{
 let d=setup();d=applyAction(d,{type:'create-event',rosterId:'one',name:'Past',date:'2026-10-22'},T1);const events=structuredClone(d.events);
 d=change(d,'replace-roster-csv',{csv:'Morgan,Rivera,,,Mo'});assert.equal(d.rosters[0].removedPeople[0].id,'p1');assert.equal(d.rosters[0].people[0].id,'p2');assert.equal(d.rosters[0].removedPeople[0].preferredFirstName,'Alex');
 d=change(d,'replace-roster-csv',{csv:CSV_HEADER});assert.equal(d.rosters[0].people.length,0);assert.equal(d.rosters[0].removedPeople.length,2);assert.deepEqual(d.events,events);assert.throws(()=>change(d,'create-event',{name:'Empty',date:'2026-10-22'}));
 d=change(d,'restore-roster-person');d=change(d,'create-event',{name:'Future',date:'2026-10-22'});assert.deepEqual(d.events.at(-1).participants.map(p=>p.id),['p1']);assert.ok(!('removedAt' in d.events.at(-1).participants[0]));
});
test('restore enforces the active roster limit without discarding the removed entry',()=>{
 const d=change(setup(),'remove-roster-person');d.rosters[0].people=Array.from({length:500},(_,i)=>person('full-'+i));const before=structuredClone(d);assert.throws(()=>change(d,'restore-roster-person'),/500/);assert.deepEqual(d,before);
});
test('conflict guards detect new matching copies, edits, restore/remove cycles and permanent deletion',()=>{
 let d=setup();d.rosters[1].people[0].id='p1';const all=guardEdit(d,{type:'remove-person-from-all-rosters',rosterId:'one',personId:'p1'});d.rosters[1].people[0].firstPronunciation='Updated';assert.notEqual(all.expected,editFingerprint(d,all));
 d=setup();d.rosters[1].people[0].id='p1';const unrelated=structuredClone(d);unrelated.rosters[1].people[1].lastName='Unrelated';assert.equal(all.expected,editFingerprint(unrelated,all));
 d=change(setup(),'remove-roster-person');const restore=guardEdit(d,{type:'restore-roster-person',rosterId:'one',personId:'p1'}),del=guardEdit(d,{type:'delete-roster-person',rosterId:'one',personId:'p1'});
 const restored=change(d,'restore-roster-person');assert.notEqual(del.expected,editFingerprint(restored,del));
 const removedAgain=applyAction(restored,{type:'remove-roster-person',rosterId:'one',personId:'p1'},T3);assert.notEqual(del.expected,editFingerprint(removedAgain,del));
 const deleted=change(d,'delete-roster-person');assert.notEqual(restore.expected,editFingerprint(deleted,restore));assert.throws(()=>change(deleted,'restore-roster-person'));
});
test('saved removed names survive JSON reload, live patches and compact save replies',()=>{
 const before=setup(),after=change(before,'remove-person-from-all-rosters');assert.deepEqual(JSON.parse(JSON.stringify(after)),after);assert.deepEqual(applyLivePatch(before,livePatch(before,after)),after);
 const packet=compactSaveReply({data:after,revision:2},before,1);assert.deepEqual(expandSaveReply(packet,{data:before,revision:1}).data,after);
 const restored=change(after,'restore-roster-person');assert.deepEqual(applyLivePatch(after,livePatch(after,restored)),restored);
});
test('legacy event name enrichment remains available while the roster entry is removed',()=>{
 const d=setup();d.events=[{id:'e',rosterId:'one',participants:[{...person('p1'),lastName:undefined,firstName:'Alexandra',status:null,removed:false,history:[],note:'',updatedAt:null}]}];const removed=change(d,'remove-roster-person');assert.equal(displayName(displayEvent(removed,removed.events[0]).participants[0]),"Alexandra 'Alex' Rivera");
});
await build({entryPoints:['app/roll-call.tsx','app/name-preferences.tsx'],bundle:true,platform:'node',format:'esm',splitting:true,jsx:'automatic',packages:'external',outdir:'.sites-runtime/removed-roster-ui'});
const {RosterEditor,RosterPerson}=await import('../.sites-runtime/removed-roster-ui/roll-call.js'),{NamePreferences}=await import('../.sites-runtime/removed-roster-ui/name-preferences.js'),{createElement:h}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
test('removed roster rows expose restore and permanent-delete icons, timestamps and no edit control',()=>{
 const d=change(setup(),'remove-roster-person'),p=d.rosters[0].removedPeople[0];const html=renderToStaticMarkup(h(NamePreferences,null,h(RosterPerson,{person:p,removedAt:p.removedAt,index:1,busy:false,duplicate:false,note:'Saved shared note',metrics:{sessions:5,attended:3,absent:1,excused:1,unmarked:0,marked:4,rate:75},onAction:async()=>true})));
 for(const value of ['Restore Person','Permanently Delete Person','Removed On',p.removedAt,'placeholder="No notes"','Saved shared note','readOnly','75%','al-ig-ZAN-druh','ree-VAIR-uh'])assert.ok(html.includes(value),value);assert.ok(!html.includes('Edit Person'));assert.ok(!html.includes('<input'));assert.ok(!html.includes('disabled=""'));
 const editor=renderToStaticMarkup(h(NamePreferences,null,h(RosterEditor,{roster:d.rosters[0],busy:false,onAction:async()=>true,newEvent(){}})));assert.ok(editor.includes('Removed From This Roster (1)'));
});

test('deleting a roster removes active and removed entries, preserves saved events and other rosters, and syncs live',()=>{
 let d=applyAction(setup(),{type:'create-event',rosterId:'one',name:'Training',date:'2026-10-23'},T1);d=change(d,'remove-roster-person');const before=structuredClone(d),del={type:'delete-roster',rosterId:'one'};
 const after=applyAction(d,del,T2);assert.equal(after.rosters.length,1);assert.deepEqual(after.rosters[0],before.rosters[1]);assert.deepEqual(after.events,before.events);assert.deepEqual(after.personIds,before.personIds);assert.deepEqual(d,before);assert.deepEqual(applyLivePatch(d,livePatch(d,after)),after);assert.throws(()=>applyAction(after,del),/no longer exists/i);
 const last=applyAction(after,{type:'delete-roster',rosterId:'two'},T2);assert.deepEqual(last.rosters,[]);assert.deepEqual(last.events,before.events);
});
test('roster delete confirmation detects renames, membership changes and edits without blocking unrelated event attendance',()=>{
 let d=applyAction(setup(),{type:'create-event',rosterId:'one',name:'Training',date:'2026-10-23'},T1);const del=guardEdit(d,{type:'delete-roster',rosterId:'one'});
 for(const action of [{type:'rename-roster',name:'Renamed'},{type:'edit-person',personId:'p1',fields:{...fields,lastName:'Changed'}},{type:'remove-roster-person',personId:'p1'},{type:'add-roster-people',csv:'New,Person,,,'}])assert.notEqual(editFingerprint(applyAction(d,{...action,rosterId:'one'},T2),del),del.expected);
 assert.equal(editFingerprint(applyAction(d,{type:'status',eventId:d.events[0].id,personId:'p1',status:'Present'},T2),del),del.expected);
});

test('roster summary and search sit above the full-width roster table',()=>{
 const d=setup();const html=renderToStaticMarkup(h(NamePreferences,null,h(RosterEditor,{roster:d.rosters[0],data:d,busy:false,onAction:async()=>true,newEvent(){}})));assert.match(html,/roster-panel roster-record-page/);assert.ok(html.indexOf('person-attendance-summary')<html.indexOf('roster-top-toolbar'));assert.ok(html.indexOf('roster-top-toolbar')<html.indexOf('roster-rows-scroll'));assert.match(html,/roster-search-field/);assert.match(html,/aria-label="Search Roster Names"/);assert.ok(!html.includes('class="roster-head"'));
});

test('active roster rows show individual attendance totals and an editable shared note',()=>{
 let d=setup();d=applyAction(d,{type:'create-event',rosterId:'one',name:'Training',date:'2026-10-23'},T1);const person=d.rosters[0].people[0];d=applyAction(d,{type:'status',eventId:d.events[0].id,personId:person.id,status:'Present'},T1);d=applyAction(d,{type:'roster-person-note',rosterId:'one',personId:person.id,note:'Shared roster note'},T1);const html=renderToStaticMarkup(h(NamePreferences,null,h(RosterEditor,{roster:d.rosters[0],data:d,busy:false,onAction:async()=>true,newEvent(){}})));for(const label of ['Sessions','Attended','Unexcused Absences','Excused','Attendance Rate','Notes'])assert.match(html,new RegExp('aria-label=\"'+label+': Sort Ascending\"'));assert.ok(html.includes('Shared roster note'));assert.match(html,/class="inline-person-note"/);
});

test('all-roster removal option requires another active linked roster, not a matching name',()=>{
 let d=setup();assert.equal(hasOtherActiveRoster(d,'one','p1'),false);d.personLinks={q1:'p1'};assert.equal(hasOtherActiveRoster(d,'one','p1'),true);d=applyAction(d,{type:'remove-roster-person',rosterId:'two',personId:'q1'},T2);assert.equal(hasOtherActiveRoster(d,'one','p1'),false);
});
test('roster search matches a short ID without depending on its display',()=>{const p=person('p1');assert.equal(matchesPersonSearch(p,'a1b2c3d','A1B2C3D'),true);assert.equal(matchesPersonSearch(p,'b2c','A1B2C3D'),true);assert.equal(matchesPersonSearch(p,'different','A1B2C3D'),false);assert.equal(matchesPersonSearch(p,'rivera',undefined),true);});
