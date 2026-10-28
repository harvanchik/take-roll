import assert from 'node:assert/strict';import {test} from 'node:test';
import {applyAction,seedData} from '../lib/model.ts';
import {effectiveEventSettings,eventSettingsDiff,eventSettingsSource,combinedEventSettings} from '../lib/event-settings.ts';
import {attendanceSettings,DEFAULT_ATTENDANCE} from '../lib/attendance-settings.ts';
import {organizationSettings} from '../lib/workspace-settings.ts';
import {comparisonRows} from '../lib/subevents.ts';
import {withSlugs,resolvePage,eventSettingsPath} from '../lib/navigation.ts';
function setup(){let d=seedData();for(const name of ['Local','Inherited'])d=applyAction(d,{type:'create-event',name,date:'2026-10-20',rosterId:d.rosters[0].id});d=applyAction(d,{type:'create-subevent',eventId:d.events[0].id,name:'Second',date:'2026-10-21'});return withSlugs(d);}
test('new and existing events inherit defaults, overrides stay scoped and legacy custom settings freeze before globals change',()=>{
 let d=setup(),root=d.events[0],sibling=d.events[2],other=d.events[1];const original=structuredClone(d);
 const global=organizationSettings(d.organization),value={...effectiveEventSettings(d,root),showPronunciation:false,attendance:{...DEFAULT_ATTENDANCE,comments:false}};
 const overrides=eventSettingsDiff(value,global);assert.deepEqual(overrides,{showPronunciation:false,attendance:{comments:false}});
 assert.deepEqual(d,original);d=applyAction(d,{type:'update-event-settings',eventId:sibling.id,settings:overrides});
 assert.equal(d.events[2].settings,undefined);assert.equal(effectiveEventSettings(d,sibling).showPronunciation,false);assert.equal(effectiveEventSettings(d,other).showPronunciation,true);
 d=applyAction(d,{type:'update-organization',organization:{...global,nameDisplay:'legal',attendance:{...DEFAULT_ATTENDANCE,eventNote:false,comments:true}}});
 assert.equal(effectiveEventSettings(d,root).nameDisplay,'quoted');assert.equal(effectiveEventSettings(d,root).attendance.eventNote,true);assert.equal(effectiveEventSettings(d,root).attendance.comments,false);assert.equal(effectiveEventSettings(d,other).attendance.comments,true);
 assert.equal(resolvePage(d,eventSettingsPath(root)).eventId,root.id);assert.equal(resolvePage(d,eventSettingsPath(root)).view,'event-settings');
});
test('local choices work across subevents, cleanup and undo validation do not cross event families',()=>{
 let d=setup(),root=d.events[0],other=d.events[1],child=d.events[2],person=root.participants[0].id;
 const custom={id:'status-local',name:'Remote',color:'teal',active:true,attended:true,allowExcuse:false};
 const statuses=[custom,...DEFAULT_ATTENDANCE.statuses];d=applyAction(d,{type:'update-event-settings',eventId:root.id,settings:{attendance:{statuses}}});
 for(const eventId of [root.id,child.id])d=applyAction(d,{type:'status',eventId,personId:person,status:custom.id});
 assert.throws(()=>applyAction(d,{type:'status',eventId:other.id,personId:person,status:custom.id}));
 const rows=comparisonRows([d.events[0],d.events[2]],DEFAULT_ATTENDANCE,e=>attendanceSettings(effectiveEventSettings(d,e)));assert.equal(rows.find(r=>r.person.id===person).present,2);
 d=applyAction(d,{type:'update-organization',organization:{...organizationSettings(d.organization),attendance:{...DEFAULT_ATTENDANCE,statuses:DEFAULT_ATTENDANCE.statuses.filter(s=>s.id!=='Present')}}});assert.equal(d.events[0].participants[0].status,custom.id);
 d=applyAction(d,{type:'update-event-settings',eventId:root.id,settings:{}});assert.equal(d.events[0].participants[0].status,null);assert.equal(d.events[2].participants[0].status,null);
 assert.throws(()=>applyAction(d,{type:'status',eventId:child.id,personId:person,status:custom.id,historyIntent:'undo'}));
});
test('validation rejects invalid or organizational fields and archived settings stay read-only',()=>{
 let d=setup(),root=d.events[0];for(const settings of [{name:'Wrong'},{archiveRetention:'1d'},{attendance:{flagColor:'url(evil)'}},{showPronunciation:'yes'}])assert.throws(()=>applyAction(d,{type:'update-event-settings',eventId:root.id,settings}));
 const before=eventSettingsSource(d,root);d=applyAction(d,{type:'archive-event',eventId:root.id});assert.throws(()=>applyAction(d,{type:'update-event-settings',eventId:root.id,settings:{showPronunciation:false}}));assert.deepEqual(eventSettingsSource(d,root),before);
});

test('duplicate events preserve local choices and all-event comparisons include each event configuration',()=>{
 let d=setup(),root=d.events[0];const local={...DEFAULT_ATTENDANCE.statuses[0],id:'status-remote',name:'Remote',color:'indigo'};
 d=applyAction(d,{type:'update-event-settings',eventId:root.id,settings:{attendance:{statuses:[local]}}});
 const combined=attendanceSettings(combinedEventSettings(d,[d.events[0],d.events[1]],d.events[0]));assert.ok(combined.statuses.some(s=>s.id==='Present'));assert.ok(combined.statuses.some(s=>s.id==='status-remote'));
 d=applyAction(d,{type:'duplicate-event',eventId:root.id});const copy=d.events.find(e=>!e.parentEventId&&e.id!==root.id&&e.name.includes('(Copy)'));assert.deepEqual(effectiveEventSettings(d,copy).attendance.statuses,[local]);
});

test('live patches carry local overrides without replacing unrelated event branches',async()=>{
 const {livePatch,applyLivePatch}=await import('../lib/live-patch.ts');const before=setup(),root=before.events[0];
 const after=applyAction(before,{type:'update-event-settings',eventId:root.id,settings:{showPronunciation:false,attendance:{comments:false}}});
 const patched=applyLivePatch(before,JSON.parse(JSON.stringify(livePatch(before,after))));assert.deepEqual(patched,after);assert.equal(patched.events[1],before.events[1]);assert.equal(effectiveEventSettings(patched,root).showPronunciation,false);
});

test('event settings links survive safe sign-in returns and reject external redirects',async()=>{
 const {safeSignInReturn}=await import('../lib/sign-in.ts');assert.equal(safeSignInReturn('/event-settings/workshop?workspace=org'),'/event-settings/workshop?workspace=org');assert.equal(safeSignInReturn('//evil.test/event-settings/workshop'),'/events');
});
