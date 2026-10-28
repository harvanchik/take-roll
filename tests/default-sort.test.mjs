import assert from 'node:assert/strict';import {test} from 'node:test';
import {defaultSort,validateDefaultSort,personSortValue,SORT_CRITERIA} from '../lib/default-sort.ts';
import {organizationSettings,defaultOrganization,validateOrganization} from '../lib/workspace-settings.ts';
import {applyAction,seedData,personFields,replaceRosterPeople} from '../lib/model.ts';
import {effectiveEventSettings,eventSettingsDiff,mergeEventSettings} from '../lib/event-settings.ts';
import {livePatch,applyLivePatch} from '../lib/live-patch.ts';
import {DEFAULT_ATTENDANCE} from '../lib/attendance-settings.ts';
const first='2026-10-20T10:00:00.000Z',second='2026-10-21T10:00:00.000Z';
test('new workspaces use Date Added ASC and legacy alphabetical settings migrate without losing overrides',()=>{
 assert.deepEqual(defaultSort(defaultOrganization),{key:'Date Added',direction:'asc'});
 assert.deepEqual(organizationSettings({forceAlphabetical:true}).defaultSort,{key:'Last Name',direction:'asc'});
 assert.deepEqual(organizationSettings({forceAlphabetical:false}).defaultSort,{key:'Date Added',direction:'asc'});
 const global=organizationSettings({defaultSort:{key:'Notes',direction:'desc'}});
 assert.deepEqual(defaultSort(mergeEventSettings(global,{forceAlphabetical:true})),{key:'Last Name',direction:'asc'});
 assert.deepEqual(defaultSort(mergeEventSettings(global,{forceAlphabetical:false})),{key:'Date Added',direction:'asc'});
 assert.deepEqual(eventSettingsDiff(mergeEventSettings(global,{forceAlphabetical:true}),global),{defaultSort:{key:'Last Name',direction:'asc'}});
});
test('all default criteria and directions validate; malformed sort choices are rejected',()=>{
 for(const key of [...SORT_CRITERIA,'status:Present'])for(const direction of ['asc','desc'])assert.deepEqual(validateDefaultSort({key,direction}),{key,direction});
 for(const value of [null,{},'Last Name',{key:'unknown',direction:'asc'},{key:'Notes',direction:'up'},{key:'status:',direction:'asc'}])assert.throws(()=>validateDefaultSort(value));
 assert.throws(()=>validateOrganization({...defaultOrganization,defaultSort:{key:'Notes',direction:'up'}}));
});
test('global and event default sort save/reload and live patches preserve local overrides',()=>{
 let d=seedData(first);for(const name of ['Local','Inherited'])d=applyAction(d,{type:'create-event',rosterId:d.rosters[0].id,name,date:'2026-10-21'},first);
 d=applyAction(d,{type:'create-subevent',eventId:d.events[0].id,name:'Next',date:'2026-10-22'},first);
 d=applyAction(d,{type:'update-organization',organization:{...organizationSettings(),defaultSort:{key:'Date Added',direction:'desc'}}});
 const before=d;d=applyAction(d,{type:'update-event-settings',eventId:d.events[0].id,settings:{defaultSort:{key:'Last Changed',direction:'desc'}}});
 const live=applyLivePatch(before,JSON.parse(JSON.stringify(livePatch(before,d))));assert.deepEqual(live,d);
 d=JSON.parse(JSON.stringify(d));assert.deepEqual(effectiveEventSettings(d,d.events[2]).defaultSort,{key:'Last Changed',direction:'desc'});assert.deepEqual(effectiveEventSettings(d,d.events[1]).defaultSort,{key:'Date Added',direction:'desc'});
 d=applyAction(d,{type:'update-event-settings',eventId:d.events[0].id,settings:{}});assert.deepEqual(effectiveEventSettings(d,d.events[0]).defaultSort,{key:'Date Added',direction:'desc'});
 assert.throws(()=>applyAction(d,{type:'update-event-settings',eventId:d.events[0].id,settings:{defaultSort:{key:'invalid',direction:'asc'}}}));
});
test('addition timestamps survive edits, CSV replacement and restoration; new memberships receive their own timestamp',()=>{
 let d=seedData(first);const rosterId=d.rosters[0].id;
 d=applyAction(d,{type:'add-roster-people',rosterId,csv:'Zane,Alpha,,,Z'},first);let person=d.rosters[0].people.at(-1);assert.equal(person.addedAt,first);
 d=applyAction(d,{type:'edit-person',rosterId,personId:person.id,fields:{...personFields(person),preferredFirstName:'Zed'}},second);person=d.rosters[0].people.at(-1);assert.equal(person.addedAt,first);assert.equal(person.updatedAt,second);
 const replaced=replaceRosterPeople([person],[personFields(person),{...personFields(person),firstName:'Amy'}],second);assert.equal(replaced[0].addedAt,first);assert.equal(replaced[0].updatedAt,second);assert.equal(replaced[1].addedAt,second);
 d=applyAction(d,{type:'create-event',rosterId,name:'Meeting',date:'2026-10-21'},second);const eventId=d.events[0].id;assert.equal(d.events[0].participants.at(-1).addedAt,second);
 d=applyAction(d,{type:'add-event-people',eventId,csv:'Amy,Zulu,,,',scope:'this'},second);const added=d.events[0].participants.at(-1);assert.equal(added.addedAt,second);
 assert.equal(personSortValue({id:'legacy',name:'Legacy',pronunciation:''},'Date Added','legal',DEFAULT_ATTENDANCE),'');
 assert.equal(personSortValue(added,'Date Added','legal',DEFAULT_ATTENDANCE),second);
 d=applyAction(d,{type:'remove-event-person',eventId,personId:added.id},second);d=applyAction(d,{type:'restore-event-person',eventId,personId:added.id},second);assert.equal(d.events[0].participants.at(-1).addedAt,second);
});
