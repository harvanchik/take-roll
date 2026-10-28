import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRosterCSV,rosterCSV,personFields,personFromFields,seedData,applyAction,filteredPeople,CSV_HEADER} from '../lib/model.ts';
const T1='2026-10-13T01:00:00Z',T2='2026-10-13T01:01:00Z';
const ROW='WExample55,Smith,sample pronunciation,SMITH,Will';
test('CSV has five fields, optional header and optional fifth column',()=>{
 const rows=parseRosterCSV('\uFEFF'+CSV_HEADER+'\r\n'+ROW+'\r\nAExample02,BExample12,sample pronunciation,sample-family\r\n\r\n');
 assert.equal(rows.length,2);assert.equal(rows[0].preferredFirstName,'Will');assert.equal(rows[1].preferredFirstName,'');assert.equal(rows[1].lastPronunciation,'sample-family');
 assert.equal(personFromFields(rows[0],'1').name,'Will Smith');assert.equal(personFromFields(rows[0],'1').pronunciation,'sample pronunciation · SMITH');
 assert.equal(parseRosterCSV('YExample58,,sample pronunciation,,')[0].lastName,'');
});
test('quoted commas, escaped quotes and multiline fields survive CSV round trip',()=>{
 const source='"MExample33, Jane","O""Connor","MAIR-ee, JAYN","oh-KON-er",MJ\n"Two\nNames",Smith,,,\n';
 const rows=parseRosterCSV(source);assert.equal(rows[0].firstName,'MExample33, Jane');assert.equal(rows[0].lastName,'O"Connor');assert.equal(rows[1].firstName,'Two\nNames');
 const r={id:'r',name:'Staff',createdAt:T1,updatedAt:T1,people:rows.map((f,i)=>personFromFields(f,String(i)))};
 assert.deepEqual(parseRosterCSV(rosterCSV(r)),rows);
});
test('invalid CSV reports line and leaves original data unchanged',()=>{
 assert.throws(()=>parseRosterCSV(CSV_HEADER+'\n'+ROW+'\nJExample25,Smith'),/Line 3: expected 4 or 5/);
 assert.throws(()=>parseRosterCSV('"Unclosed,Smith,,,'),/Line 1.*closing quote/);
 assert.throws(()=>parseRosterCSV('"WExample55"extra,Smith,,,'),/Line 1.*unexpected text/);
 assert.throws(()=>parseRosterCSV(',Smith,,,'),/first name is required/);
 assert.throws(()=>parseRosterCSV('A,B,C,D,E,F'),/4 or 5/);
 assert.throws(()=>parseRosterCSV('A'.repeat(201)+',Smith,,,'),/200 characters/);
 assert.throws(()=>parseRosterCSV(Array(501).fill('A,B,,,').join('\n')),/500 people/);
 const d=seedData(T1);assert.throws(()=>applyAction(d,{type:'replace-roster-csv',rosterId:d.rosters[0].id,csv:'bad,row'},T2));assert.equal(d.rosters[0].people.length,48);
});
test('legacy roster CSV preserves unsplit names, pronunciations and distinct JExample27 identities',()=>{
 const d=seedData(T1),r=d.rosters[0];const csv=rosterCSV(r);const round=applyAction(d,{type:'replace-roster-csv',rosterId:r.id,csv},T2);
 assert.deepEqual(round.rosters[0].people.map(p=>[p.id,p.name,p.pronunciation]),r.people.map(p=>[p.id,p.name,p.pronunciation]));
 assert.equal(personFields(round.rosters[0].people.find(p=>p.name==='MExample34')).firstName,'MExample34');
 assert.equal(new Set(round.rosters[0].people.filter(p=>p.name==='JExample27').map(p=>p.id)).size,2);
});
test('inline and CSV edits share all fields; replacements preserve IDs on pronunciation and preferred edits',()=>{
 let d=applyAction(seedData(T1),{type:'create-roster',name:'CSV Staff',csv:ROW+'\n'+ROW},T1);const r=d.rosters.at(-1);const ids=r.people.map(p=>p.id);
 d=applyAction(d,{type:'edit-person',rosterId:r.id,personId:ids[0],fields:{firstName:'WExample55',lastName:'Smith',firstPronunciation:'BILL',lastPronunciation:'SMITH',preferredFirstName:'Bill'}},T2);
 let edited=d.rosters.at(-1);assert.equal(edited.people[0].name,'Bill Smith');assert.ok(rosterCSV(edited).includes('WExample55,Smith,BILL,SMITH,Bill'));
 d=applyAction(d,{type:'replace-roster-csv',rosterId:r.id,csv:ROW+'\nWExample55,Smith,BILL,SMITH,Billy'},T2);
 edited=d.rosters.at(-1);assert.equal(edited.people[0].id,ids[1]);assert.equal(edited.people[1].id,ids[0]);assert.equal(edited.people[1].name,'Billy Smith');
});
test('reorder, additions and removals affect the roster and future events while retaining past attendance',()=>{
 let d=applyAction(seedData(T1),{type:'create-roster',name:'Staff CSV',csv:ROW+'\nJExample25,HExample22,JAYK,sample-family,'},T1);let r=d.rosters.at(-1);
 d=applyAction(d,{type:'create-event',rosterId:r.id,name:'Old meeting',date:'2026-10-12'},T1);const old=d.events[0];
 d=applyAction(d,{type:'status',eventId:old.id,personId:old.participants[0].id,status:'Present'},T1);const snapshot=structuredClone(d.events[0]);
 d=applyAction(d,{type:'replace-roster-csv',rosterId:r.id,csv:'JExample25,HExample22,JAYK,sample-family,\nNew,Person,NOO,PER-sun,'},T2);
 assert.deepEqual(d.events[0],snapshot);assert.equal(d.rosters.at(-1).people[0].id,r.people[1].id);
 d=applyAction(d,{type:'add-roster-people',rosterId:r.id,csv:'AExample02,BExample12,sample pronunciation,sample-family,'},T2);assert.equal(d.rosters.at(-1).people.length,3);
 d=applyAction(d,{type:'create-event',rosterId:r.id,name:'New meeting',date:'2026-10-13'},T2);assert.deepEqual(d.events[1].participants.map(p=>p.name),['JExample25 HExample22','New Person','AExample02 BExample12']);
 assert.equal(filteredPeople(snapshot,'WExample55','All',false).length,1);assert.equal(filteredPeople(snapshot,'Will Smith','All',false).length,1);
 d=applyAction(d,{type:'replace-roster-csv',rosterId:r.id,csv:CSV_HEADER},T2);assert.equal(d.rosters.at(-1).people.length,0);assert.deepEqual(d.events[0],snapshot);
});
