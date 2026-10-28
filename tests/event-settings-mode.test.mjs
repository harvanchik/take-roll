import assert from 'node:assert/strict';import {test} from 'node:test';
import {applyAction,seedData} from '../lib/model.ts';
import {effectiveEventSettings,eventSettingsSource,eventSettingsDraft,eventSettingsSnapshot,validateEventOverrides} from '../lib/event-settings.ts';
import {organizationSettings} from '../lib/workspace-settings.ts';
import {DEFAULT_ATTENDANCE} from '../lib/attendance-settings.ts';
import {ValueDraft} from '../lib/value-draft.ts';
import {livePatch,applyLivePatch} from '../lib/live-patch.ts';
function setup(){let d=seedData();d=applyAction(d,{type:'create-event',rosterId:d.rosters[0].id,name:'Meeting',date:'2026-10-22'});d=applyAction(d,{type:'create-subevent',eventId:d.events[0].id,name:'Second',date:'2026-10-23'});return d;}
const config=(d,index=0)=>effectiveEventSettings(d,d.events[index]);
const save=(d,settings)=>applyAction(d,{type:'update-event-settings',eventId:d.events[0].id,settings});
test('global and local modes survive reload and global updates without losing dormant local values',()=>{
 let d=setup();assert.equal(eventSettingsDraft(eventSettingsSource(d,d.events[0])).useGlobal,true);
 const local={...eventSettingsSnapshot(config(d)),nameDisplay:'preferred',defaultSort:{key:'Notes',direction:'desc'},attendance:{...DEFAULT_ATTENDANCE,flagColor:'teal',comments:false}};
 d=save(d,{...local,useGlobal:false});
 d=applyAction(d,{type:'update-organization',organization:{...organizationSettings(d.organization),showPronunciation:false,attendance:{...DEFAULT_ATTENDANCE,checkColor:'blue',comments:true}}});
 assert.equal(config(d).showPronunciation,true);assert.equal(config(d).attendance.checkColor,DEFAULT_ATTENDANCE.checkColor);assert.equal(config(d).attendance.comments,false);
 d=save(d,{useGlobal:true});assert.equal(config(d).showPronunciation,false);assert.equal(config(d).attendance.comments,true);
 d=applyAction(d,{type:'update-organization',organization:{...organizationSettings(d.organization),nameDisplay:'legal',attendance:{...DEFAULT_ATTENDANCE,flagColor:'pink'}}});
 d=JSON.parse(JSON.stringify(d));assert.equal(config(d).nameDisplay,'legal');assert.equal(config(d,1).attendance.flagColor,'pink');
 assert.equal(eventSettingsDraft(eventSettingsSource(d,d.events[0])).local.nameDisplay,'preferred');
 d=save(d,{useGlobal:false});assert.equal(config(d).nameDisplay,'preferred');assert.equal(config(d).attendance.flagColor,'teal');assert.deepEqual(config(d,1),config(d));
 const reset=eventSettingsSnapshot(organizationSettings(d.organization));d=save(d,{...reset,useGlobal:false});assert.equal(d.events[0].settings.useGlobal,false);assert.equal(config(d).nameDisplay,'legal');
 d=applyAction(d,{type:'update-organization',organization:{...organizationSettings(d.organization),nameDisplay:'quoted'}});assert.equal(config(d).nameDisplay,'legal');
});
test('mode switching is non-destructive; removing a local choice still clears its marks',()=>{
 let d=setup();const custom={id:'status-remote',name:'Remote',color:'teal',active:true,attended:true,allowExcuse:false};
 d=save(d,{useGlobal:false,attendance:{...DEFAULT_ATTENDANCE,statuses:[...DEFAULT_ATTENDANCE.statuses,custom]}});
 const personId=d.events[0].participants[0].id;d=applyAction(d,{type:'status',eventId:d.events[0].id,personId,status:custom.id});
 d=save(d,{useGlobal:true});assert.equal(d.events[0].participants[0].status,custom.id);
 d=applyAction(d,{type:'update-organization',organization:{...organizationSettings(d.organization),attendance:{...DEFAULT_ATTENDANCE,flagColor:'blue'}}});assert.equal(d.events[0].participants[0].status,custom.id);
 d=save(d,{useGlobal:false});assert.equal(d.events[0].participants[0].status,custom.id);
 d=save(d,{useGlobal:false,attendance:DEFAULT_ATTENDANCE});assert.equal(d.events[0].participants[0].status,null);
});
test('drafts retain local edits across unsaved mode toggles and discard restores the saved mode and values',()=>{
 const d=setup(),source=eventSettingsSource(d,d.events[0]),draft=new ValueDraft(source,eventSettingsDraft);
 draft.update({...draft.value,useGlobal:false});draft.update({...draft.value,local:{...draft.value.local,nameDisplay:'legal'}});draft.update({...draft.value,useGlobal:true});assert.equal(draft.dirty,true);
 draft.update({...draft.value,useGlobal:false});assert.equal(draft.value.local.nameDisplay,'legal');assert.equal(draft.dirty,true);
 draft.update(eventSettingsDraft(source));assert.equal(draft.dirty,false);assert.equal(draft.value.useGlobal,true);
});
test('mode validation rejects malformed settings and strips inactive choices from saved local snapshots',()=>{
 for(const useGlobal of ['true',null,0])assert.throws(()=>validateEventOverrides({useGlobal}));
 assert.throws(()=>validateEventOverrides({useGlobal:true,attendance:{flagColor:'url(evil)'}}));
 const out=validateEventOverrides({useGlobal:false,attendance:{statuses:[...DEFAULT_ATTENDANCE.statuses,{...DEFAULT_ATTENDANCE.statuses[0],id:'status-inactive',active:false}]}});assert.ok(out.attendance.statuses.every(s=>s.active));assert.ok(out.defaultSort);
});
test('mode and remembered local snapshot propagate together to live collaborators',()=>{
 const before=setup(),after=save(before,{useGlobal:false,showPronunciation:false});const patched=applyLivePatch(before,JSON.parse(JSON.stringify(livePatch(before,after))));assert.deepEqual(patched,after);
 const global=save(after,{useGlobal:true}),switched=applyLivePatch(after,JSON.parse(JSON.stringify(livePatch(after,global))));assert.equal(config(switched).showPronunciation,true);assert.equal(eventSettingsDraft(eventSettingsSource(switched,switched.events[0])).local.showPronunciation,false);
});

test('test-only is reversible and inherited by subevents without losing attendance',()=>{
 let d=setup();const root=d.events[0],p=root.participants[0];d=applyAction(d,{type:'status',eventId:root.id,personId:p.id,status:'Present'});const before=d.events[0].participants[0].status;d=save(d,{useGlobal:true,testOnly:true});assert.equal(d.events[0].settings.testOnly,true);assert.equal(d.events[0].participants[0].status,before);d=save(d,{useGlobal:true,testOnly:false});assert.equal(d.events[0].settings.testOnly,false);assert.equal(d.events[0].participants[0].status,before);
});
