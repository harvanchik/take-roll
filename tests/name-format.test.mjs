import assert from 'node:assert/strict';
import {test} from 'node:test';
import {displayName,applyAction,seedData,personFromFields} from '../lib/model.ts';
import {defaultOrganization,validateOrganization} from '../lib/workspace-settings.ts';
import {encodeNameParts,validateNameDisplay,nameParts} from '../lib/name-format.ts';
import {DEFAULT_ATTENDANCE,validateAttendance} from '../lib/attendance-settings.ts';
const person=personFromFields({firstName:'Alexandra',preferredFirstName:'Alex',lastName:'Rivera',firstPronunciation:'',lastPronunciation:''},'alex');
const part=(field,before='',after='')=>({id:field,field,before,after});
test('custom name parts support last-first, preferred, punctuation, and omitted preferred names',()=>{
 const mode=encodeNameParts([part('last','',', '),part('first','',' '),part('preferred','(',')')]);
 assert.equal(displayName(person,mode),'Rivera, Alexandra (Alex)');
 assert.equal(displayName({...person,preferredFirstName:''},mode),'Rivera, Alexandra');
 assert.equal(displayName({...person,preferredFirstName:'Alexandra'},mode),'Rivera, Alexandra');
 assert.equal(displayName({...person,preferredFirstName:'Alexandra'},encodeNameParts([part('preferred','',' '),part('last')])),'Alexandra Rivera');
 assert.equal(displayName(person,encodeNameParts([part('preferred','',' / '),part('last')])),'Alex / Rivera');
 assert.equal(displayName({...person,preferredFirstName:''},encodeNameParts([part('used','',' '),part('last')])),'Alexandra Rivera');
 for(const legacy of ['legal','preferred','quoted'])assert.equal(displayName(person,encodeNameParts(nameParts(legacy))),displayName(person,legacy));
});
test('custom name formats are validated and survive organization saves without altering stored names or attendance',()=>{
 const mode=encodeNameParts([part('last','',', '),part('used')]);
 assert.equal(validateOrganization({...defaultOrganization,nameDisplay:mode}).nameDisplay,mode);
 let data=seedData();data=applyAction(data,{type:'update-organization',organization:{...defaultOrganization,nameDisplay:mode}});
 assert.equal(data.organization.nameDisplay,mode);assert.equal(data.rosters[0].people[0].name,'YExample58');
 for(const mode of ['custom:invalid','custom:[]',encodeNameParts([part('bad')]),encodeNameParts([part('first'),part('first')]),encodeNameParts([part('last','x'.repeat(21))])])assert.throws(()=>validateNameDisplay(mode));
});
test('status labels accept 1–15 characters and reject empty or oversized labels; order keeps stable marks',()=>{
 for(const label of ['A','123456789012345']){const c=structuredClone(DEFAULT_ATTENDANCE);c.statuses[0].name=label;assert.equal(validateAttendance(c).statuses[0].name,label);}
 for(const label of ['','   ','1234567890123456']){const c=structuredClone(DEFAULT_ATTENDANCE);c.statuses[0].name=label;assert.throws(()=>validateAttendance(c));}
 let data=seedData();data=applyAction(data,{type:'create-event',name:'Test',date:'2026-10-20',rosterId:data.rosters[0].id});const e=data.events[0],id=e.participants[0].id;
 data=applyAction(data,{type:'status',eventId:e.id,personId:id,status:'Present'});
 const c=structuredClone(DEFAULT_ATTENDANCE);c.statuses.reverse();data=applyAction(data,{type:'update-organization',organization:{...defaultOrganization,attendance:c}});
 assert.deepEqual(data.organization.attendance.statuses.map(s=>s.id),['Absent','Tardy','Bit Late','Present']);assert.equal(data.events[0].participants[0].status,'Present');
});
