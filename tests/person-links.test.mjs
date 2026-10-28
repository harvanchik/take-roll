import assert from 'node:assert/strict';import {test} from 'node:test';import {createRequire} from 'node:module';import {dirname} from 'node:path';
import {applyAction,personFromFields} from '../lib/model.ts';import {withPersonIds,personForUid,personUid} from '../lib/person-identity.ts';import {personIdentity,matchingPeoplePlan,identityGuard,identityLinkBlocker} from '../lib/person-links.ts';import {personAttendance} from '../lib/person-attendance.ts';import {guardEdit,editFingerprint} from '../lib/edit-conflicts.ts';import {livePatch,applyLivePatch} from '../lib/live-patch.ts';
const at='2026-10-23T12:00:00Z',fields={firstName:'John',lastName:'Smith',preferredFirstName:'',firstPronunciation:'JOHN',lastPronunciation:'SMITH'},person=(id,f=fields)=>personFromFields(f,id);
function setup(){let d=withPersonIds({rosters:[{id:'first',name:'Main Roster',people:[person('1111111a'),person('other',{...fields,firstName:'Alex'})],createdAt:at,updatedAt:at},{id:'subset',name:'Subset',people:[person('2222222b')],createdAt:at,updatedAt:at}],events:[]});for(const rosterId of ['first','subset'])d=applyAction(d,{type:'create-event',rosterId,name:rosterId,date:'2026-10-23'},at);d=applyAction(d,{type:'status',eventId:d.events[0].id,personId:'1111111a',status:'Absent'},at);d=applyAction(d,{type:'person-note',eventId:d.events[1].id,personId:'2222222b',note:'Keep This Note'},at);d=applyAction(d,{type:'person-flag',eventId:d.events[1].id,personId:'2222222b',flag:'flagged'},at);return d;}
test('retroactive linking keeps all original records, IDs and histories and joins history through both old URLs',()=>{
 const d=setup(),before=structuredClone(d),after=applyAction(d,{type:'link-matching-people'},at);assert.deepEqual(d,before);assert.deepEqual(after.rosters,before.rosters);assert.deepEqual(after.events,before.events);assert.deepEqual(after.personIds,before.personIds);assert.equal(after.personLinkReview.linked,1);assert.equal(personUid(after,'1111111a','first'),personUid(after,'2222222b','subset'));assert.equal(personAttendance(after,'1111111a').length,2);assert.equal(personAttendance(after,'2222222b').length,2);assert.equal(personForUid(after,before.personIds['2222222b']).id,'1111111a');assert.equal(matchingPeoplePlan(after).links.length,0);assert.deepEqual(applyLivePatch(d,livePatch(d,after)),after);assert.deepEqual(JSON.parse(JSON.stringify(after)).events,before.events);
});
test('same-name duplicates in one roster and separate same-session attendance are never collapsed',()=>{
 let d=setup();d.rosters[0].people.push(person('third'));let plan=matchingPeoplePlan(d);assert.equal(plan.links.length,0);assert.match(plan.skipped[0].reason,/Multiple/);
 d=withPersonIds(d);const before=structuredClone(d);const sameRoster={type:'link-person-identity',rosterId:'first',personId:'1111111a',uid:personUid(d,'third','first')};
 assert.match(identityLinkBlocker(d,'1111111a','third'),/same roster.*different rosters/);
 assert.throws(()=>applyAction(d,sameRoster,at),/same roster.*separate attendance records/);assert.deepEqual(d,before);
 d=setup();d.events[0].participants.push({...d.events[1].participants[0]});plan=matchingPeoplePlan(d);assert.equal(plan.links.length,0);assert.match(plan.skipped[0].reason,/Separate Attendance/);
 assert.match(identityLinkBlocker(d,'1111111a','2222222b'),/same subevent/);
 assert.throws(()=>applyAction(d,{type:'link-person-identity',rosterId:'first',personId:'1111111a',uid:personUid(d,'2222222b')},at),/same subevent.*separate IDs/);const after=applyAction(d,{type:'link-matching-people'},at);assert.deepEqual(after.events,d.events);
});
test('different preferred names are left for explicit review and pronunciation differences never get overwritten',()=>{
 const d=setup();d.rosters[0].people[0].preferredFirstName='Jack';d.rosters[1].people[0].preferredFirstName='Johnny';assert.equal(matchingPeoplePlan(d).links.length,0);d.rosters[1].people[0].preferredFirstName='Jack';d.rosters[1].people[0].firstPronunciation='Different';const after=applyAction(d,{type:'link-matching-people'},at);assert.equal(after.personLinkReview.linked,1);assert.deepEqual(after.rosters,d.rosters);
});
test('new rosters, appends and new CSV rows automatically use one unambiguous identity',()=>{
 let d=applyAction(setup(),{type:'link-matching-people'},at);d=applyAction(d,{type:'create-roster',name:'New Roster',csv:'John,Smith,,,'},at);assert.equal(d.rosters.at(-1).people[0].id,'1111111a');
 d.rosters.push({id:'empty',name:'Empty',people:[],createdAt:at,updatedAt:at});d=applyAction(d,{type:'add-roster-people',rosterId:'empty',csv:'John,Smith,,,'},at);assert.equal(d.rosters.at(-1).people[0].id,'1111111a');
 d.rosters.push({id:'csv',name:'CSV',people:[],createdAt:at,updatedAt:at});d=applyAction(d,{type:'replace-roster-csv',rosterId:'csv',csv:'John,Smith,,,'},at);assert.equal(d.rosters.at(-1).people[0].id,'1111111a');
});
test('duplicate imported names and ambiguous matches get distinct new identities',()=>{
 let d=setup();d=applyAction(d,{type:'create-roster',name:'Ambiguous',csv:'John,Smith,,,\nJohn,Smith,,,'},at);const ids=d.rosters.at(-1).people.map(p=>p.id);assert.equal(new Set(ids).size,2);assert.ok(ids.every(id=>!['1111111a','2222222b'].includes(id)));
 d=applyAction(setup(),{type:'link-matching-people'},at);d.rosters.push({id:'csv',name:'CSV',people:[],createdAt:at,updatedAt:at});d=applyAction(d,{type:'replace-roster-csv',rosterId:'csv',csv:'John,Smith,,,\nJohn,Smith,,,'},at);assert.equal(new Set(d.rosters.at(-1).people.map(p=>p.id)).size,2);
});
test('unlink creates a new ID, keeps scoped historical attendance intact and cannot be automatically relinked',()=>{
 const linked=applyAction(setup(),{type:'link-matching-people'},at),before=structuredClone(linked.events),separate=applyAction(linked,{type:'unlink-roster-person',rosterId:'subset',personId:'2222222b'},at),id=separate.rosters[1].people[0].id;
 assert.notEqual(id,'2222222b');assert.notEqual(personUid(separate,id),personUid(separate,'1111111a'));assert.deepEqual(separate.events,before);assert.equal(personAttendance(separate,id).length,1);assert.equal(personAttendance(separate,id)[0].person.note,'Keep This Note');assert.equal(personAttendance(separate,id)[0].person.flag,'flagged');assert.equal(personAttendance(separate,'1111111a').length,1);assert.equal(matchingPeoplePlan(separate).links.length,0);assert.match(matchingPeoplePlan(separate).skipped[0].reason,/Manually/);
 let next=applyAction(separate,{type:'create-roster',name:'Independent',csv:'John,Smith,,,'},at);assert.notEqual(next.rosters.at(-1).people[0].id,id);assert.notEqual(next.rosters.at(-1).people[0].id,'1111111a');
 next=applyAction(separate,{type:'link-person-identity',rosterId:'subset',personId:id,uid:personUid(separate,'1111111a')},at);assert.equal(personAttendance(next,'1111111a').length,2);assert.deepEqual(next.events,before);
});
test('CSV round trips preserve an unlinked identity and all saved attendance',()=>{
 let d=applyAction(setup(),{type:'link-matching-people'},at);d=applyAction(d,{type:'unlink-roster-person',rosterId:'subset',personId:'2222222b'},at);const id=d.rosters[1].people[0].id,events=structuredClone(d.events);d=applyAction(d,{type:'replace-roster-csv',rosterId:'subset',csv:'John,Smith,,,'},at);assert.equal(d.rosters[1].people[0].id,id);assert.equal(personIdentity(d,d.events[1].participants[0].id,'subset'),id);assert.deepEqual(d.events,events);
});
test('correcting an unshared name auto-links, but edits to a manually separate person stay separate',()=>{
 let d=setup();d.rosters[1].people[0].firstName='Jon';d=applyAction(d,{type:'edit-person',rosterId:'subset',personId:'2222222b',fields},at);assert.equal(personIdentity(d,'2222222b'),'1111111a');d=applyAction(d,{type:'unlink-roster-person',rosterId:'subset',personId:'2222222b'},at);const id=d.rosters[1].people[0].id;d=applyAction(d,{type:'edit-person',rosterId:'subset',personId:id,fields:{...fields,firstName:'Alex'}},at);assert.equal(personIdentity(d,id),id);
});
test('identity conflict guards ignore attendance-only changes but detect roster and identity changes',()=>{
 const d=setup(),target=identityGuard(d),changed=applyAction(d,{type:'person-note',eventId:d.events[0].id,personId:'1111111a',note:'Concurrent Note'},at);assert.deepEqual(identityGuard(changed),target);assert.notDeepEqual(identityGuard(applyAction(d,{type:'link-matching-people'},at)),target);
});
test('explicit linking into a previously unlinked roster uses a distinct row ID without inheriting its old scope',()=>{
 let d=applyAction(setup(),{type:'link-matching-people'},at);d=applyAction(d,{type:'unlink-roster-person',rosterId:'first',personId:'1111111a'},at);const separate=d.rosters[0].people[0].id,events=structuredClone(d.events);
 d=applyAction(d,{type:'link-roster-person',rosterId:'first',uid:d.personIds['1111111a']},at);const added=d.rosters[0].people.at(-1);assert.notEqual(added.id,'1111111a');assert.equal(personIdentity(d,added.id,'first'),'1111111a');assert.equal(personIdentity(d,separate,'first'),separate);assert.deepEqual(d.events,events);assert.equal(personAttendance(d,separate).length,1);assert.equal(personAttendance(d,'1111111a').length,1);
});
test('re-adding a matching name after permanent roster removal never reuses a manually split historical scope',()=>{
 let d=applyAction(setup(),{type:'link-matching-people'},at);d=applyAction(d,{type:'unlink-roster-person',rosterId:'first',personId:'1111111a'},at);const separate=d.rosters[0].people[0].id;
 d=applyAction(d,{type:'remove-roster-person',rosterId:'first',personId:separate},at);d=applyAction(d,{type:'delete-roster-person',rosterId:'first',personId:separate},at);d=applyAction(d,{type:'add-roster-people',rosterId:'first',csv:'John,Smith,,,'},at);const added=d.rosters[0].people.at(-1);assert.notEqual(added.id,'1111111a');assert.notEqual(added.id,separate);assert.equal(personIdentity(d,added.id,'first'),added.id);assert.equal(personAttendance(d,separate).length,1);
});
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({entryPoints:['app/person-attendance.tsx','app/name-preferences.tsx'],bundle:true,platform:'node',format:'esm',splitting:true,jsx:'automatic',packages:'external',outbase:'.',outdir:'.sites-runtime/person-links-ui'});
const {default:Page}=await import('../.sites-runtime/person-links-ui/app/person-attendance.js'),{NamePreferences}=await import('../.sites-runtime/person-links-ui/app/name-preferences.js'),{createElement:h}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
test('history membership includes linked rosters without events and old IDs display the canonical copyable ID',()=>{
 let d=applyAction(setup(),{type:'link-matching-people'},at);d.events=[];const old=d.personIds['2222222b'],page=renderToStaticMarkup(h(NamePreferences,null,h(Page,{data:d,uid:old,onNavigate(){}})));assert.match(page,/Main Roster/);assert.match(page,/Subset/);assert.ok(page.includes('Copy Person ID '+d.personIds['1111111a']));
});

test('shared roster notes follow linked identities and unlink safely copies the note',()=>{
 let d=setup();d=applyAction(d,{type:'roster-person-note',rosterId:'subset',personId:'2222222b',note:'Call ahead'},at);const linked=applyAction(d,{type:'link-matching-people'},at);const root=personIdentity(linked,'1111111a','first');assert.equal(linked.personNotes[root],'Call ahead');assert.equal(linked.personNotes[personIdentity(linked,'2222222b','subset')],'Call ahead');assert.deepEqual(applyLivePatch(d,livePatch(d,linked)),linked);const changed=applyAction(linked,{type:'roster-person-note',rosterId:'first',personId:'1111111a',note:'Updated'},at);assert.equal(changed.personNotes[personIdentity(changed,'2222222b','subset')],'Updated');const separated=applyAction(changed,{type:'unlink-roster-person',rosterId:'subset',personId:'2222222b'},at);const separatedPerson=separated.rosters[1].people[0];assert.notEqual(personIdentity(separated,separatedPerson.id,'subset'),root);assert.equal(separated.personNotes[personIdentity(separated,separatedPerson.id,'subset')],'Updated');assert.equal(separated.personNotes[root],'Updated');
});
test('linking never overwrites different shared roster notes',()=>{
 let d=setup();d=applyAction(d,{type:'roster-person-note',rosterId:'first',personId:'1111111a',note:'First note'},at);d=applyAction(d,{type:'roster-person-note',rosterId:'subset',personId:'2222222b',note:'Second note'},at);const before=structuredClone(d);assert.match(identityLinkBlocker(d,'1111111a','2222222b'),/different notes/i);assert.throws(()=>applyAction(d,{type:'link-person-identity',rosterId:'first',personId:'1111111a',uid:personUid(d,'2222222b')},at),/different notes/i);const result=applyAction(d,{type:'link-matching-people'},at);assert.equal(result.personLinkReview.linked,0);assert.match(result.personLinkReview.skipped[0].reason,/Different Person Notes/);assert.deepEqual(result.personNotes,before.personNotes);
});

test('shared note conflict guards detect edits made from another linked roster',()=>{
 let d=applyAction(setup(),{type:'link-matching-people'},at);const draft=guardEdit(d,{type:'roster-person-note',rosterId:'first',personId:'1111111a',note:'First edit',before:''});d=applyAction(d,{type:'roster-person-note',rosterId:'subset',personId:'2222222b',note:'Other edit'},at);assert.notEqual(draft.expected,editFingerprint(d,draft));assert.equal(d.personNotes[personIdentity(d,'1111111a','first')],'Other edit');
});
