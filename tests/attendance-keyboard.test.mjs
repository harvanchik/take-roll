import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextUnmarkedId,adjacentPersonId,keyboardSelection,keyboardStatus} from '../lib/attendance-keyboard.ts';
import {defaultPreferences,validatePreferences} from '../lib/workspace-settings.ts';
import {seedData,applyAction} from '../lib/model.ts';
const rows=[{id:'one',status:'Present'},{id:'two',status:null},{id:'removed',status:null,removed:true},{id:'three',status:null}];
test('next unmarked follows visible order, wraps, and ignores removed people',()=>{
 assert.equal(nextUnmarkedId(rows,''),'two');assert.equal(nextUnmarkedId(rows,'two'),'three');assert.equal(nextUnmarkedId(rows,'three'),'two');
 assert.equal(nextUnmarkedId(rows.filter(row=>row.id==='one'),''),'');assert.equal(nextUnmarkedId([],''),'');assert.equal(nextUnmarkedId([{id:'only',status:null}],'only'),'only');
});
test('keyboard navigation wraps at the table edges and uses configured status order',()=>{
 assert.equal(adjacentPersonId(rows,'',1),'one');assert.equal(adjacentPersonId(rows,'',-1),'three');assert.equal(adjacentPersonId(rows,'one',-1),'three');assert.equal(adjacentPersonId(rows,'three',1),'one');assert.equal(adjacentPersonId([],'',1),'');
 const statuses=[{id:'custom'},{id:'Present'}];assert.equal(keyboardStatus('1',statuses),'custom');assert.equal(keyboardStatus('2',statuses),'Present');assert.equal(keyboardStatus('0',statuses),null);for(const key of ['3','x','Enter'])assert.equal(keyboardStatus(key,statuses),undefined);
});
test('personal pins validate, deduplicate, and leave roster and event records intact',()=>{
 const preferences={...defaultPreferences,pinnedEvents:['event-a','event-a'],pinnedRosters:['roster-b']},validated=validatePreferences(preferences);assert.deepEqual(validated.pinnedEvents,['event-a']);
 const before=seedData(),after=applyAction(before,{type:'update-preferences',preferences:validated});assert.deepEqual(after.events,before.events);assert.deepEqual(after.rosters,before.rosters);
 const legacy=applyAction(after,{type:'update-preferences',preferences:{theme:'dark',haptics:false}});assert.deepEqual(legacy.preferences.pinnedRosters,['roster-b']);
 for(const pinnedEvents of [null,'event-a',[42],[''],['x'.repeat(201)],Array(1001).fill('a')])assert.throws(()=>validatePreferences({...defaultPreferences,pinnedEvents}));
});

test('anchored keyboard selection wraps, shrinks, and excludes removed people',()=>{
 assert.deepEqual(keyboardSelection(rows,'one',1),['one','two']);
 assert.deepEqual(keyboardSelection(rows,'one',-1),['one','three']);
 assert.deepEqual(keyboardSelection(rows,'one',2),['one','two','three']);
 assert.deepEqual(keyboardSelection(rows,'one',0),['one']);
 assert.deepEqual(keyboardSelection(rows,'one',99),['one','two','three']);
 assert.deepEqual(keyboardSelection([], 'one',1),[]);
});

 test('previous unmarked follows visible order backward and wraps',()=>{
 assert.equal(nextUnmarkedId(rows,'three',-1),'two');assert.equal(nextUnmarkedId(rows,'two',-1),'three');assert.equal(nextUnmarkedId(rows,'',-1),'three');assert.equal(nextUnmarkedId([],'',-1),'');
 });
 test('contiguous selection includes both endpoints without wrapping or including removed rows',async()=>{
 const {contiguousSelection}=await import('../lib/attendance-keyboard.ts');
 assert.deepEqual(contiguousSelection(rows,'one','three'),['one','two','three']);assert.deepEqual(contiguousSelection(rows,'three','one'),['one','two','three']);assert.deepEqual(contiguousSelection(rows,'two','three'),['two','three']);assert.deepEqual(contiguousSelection(rows,'missing','two'),['two']);assert.deepEqual(contiguousSelection(rows,'one','removed'),[]);
 });

test('repeated Shift clicks keep their origin while the active range grows and shrinks',async()=>{
 const {clickPersonSelection}=await import('../lib/attendance-keyboard.ts'),list=Array.from({length:12},(_,i)=>({id:String(i+1),status:null}));
 let range={anchor:'2',offset:0,base:[]},selected=['2'];const click=(id,extend=false,add=false)=>{const result=clickPersonSelection(list,range,selected,id,extend,add);range=result.range;selected=result.ids;};
 click('5',true);assert.deepEqual(selected,['2','3','4','5']);assert.equal(range.anchor,'2');click('7',true);assert.deepEqual(selected,['2','3','4','5','6','7']);assert.equal(range.anchor,'2');click('4',true);assert.deepEqual(selected,['2','3','4']);click('1',true);assert.deepEqual(selected,['1','2']);
});
test('Ctrl clicks start additive ranges without discarding earlier groups',async()=>{
 const {clickPersonSelection}=await import('../lib/attendance-keyboard.ts'),list=Array.from({length:15},(_,i)=>({id:String(i+1),status:null}));
 let range={anchor:'1',offset:0,base:[]},selected=['1'];const click=(id,extend=false,add=false)=>{const result=clickPersonSelection(list,range,selected,id,extend,add);range=result.range;selected=result.ids;};
 click('3',true);click('7',false,true);assert.equal(range.anchor,'7');assert.deepEqual(selected,['1','2','3','7']);click('10',true);assert.deepEqual(selected,['1','2','3','7','8','9','10']);assert.equal(range.anchor,'7');click('8',true);assert.deepEqual(selected,['1','2','3','7','8']);click('13',false,true);click('15',true);assert.deepEqual(selected,['1','2','3','7','8','13','14','15']);click('12',true);assert.deepEqual(selected,['1','2','3','7','8','12','13']);click('6');assert.deepEqual(selected,['6']);assert.deepEqual(range.base,[]);
});
test('additive ranges exclude hidden and removed rows and keep visible order',async()=>{
 const {clickPersonSelection}=await import('../lib/attendance-keyboard.ts');
 const result=clickPersonSelection(rows,{anchor:'two',offset:0,base:['one','hidden','removed']},['one','two'],'three',true,false);assert.deepEqual(result.ids,['one','two','three']);
});

test('Ctrl clicks toggle selected rows, including the last row, and establish a new anchor',async()=>{
 const {clickPersonSelection}=await import('../lib/attendance-keyboard.ts'),list=Array.from({length:8},(_,i)=>({id:String(i+1),status:null}));let range={anchor:'1',offset:0,base:[]},selected=['1'];
 const click=(id,extend=false,add=false)=>{const next=clickPersonSelection(list,range,selected,id,extend,add);range=next.range;selected=next.ids;};
 click('4',true);click('2',false,true);assert.deepEqual(selected,['1','3','4']);assert.equal(range.anchor,'2');click('6',false,true);click('8',true);assert.deepEqual(selected,['1','3','4','6','7','8']);click('6',false,true);assert.deepEqual(selected,['1','3','4','7','8']);
 click('1',false,true);click('3',false,true);click('4',false,true);click('7',false,true);click('8',false,true);assert.deepEqual(selected,[]);click('8',false,true);assert.deepEqual(selected,['8']);
});
test('opposite boundary shortcut restores the exact prior selection and anchor in either direction',async()=>{
 const {boundaryPersonSelection}=await import('../lib/attendance-keyboard.ts'),list=Array.from({length:8},(_,i)=>({id:String(i+1),status:null}));
 for(const direction of [1,-1]){const initial={active:'5',ids:['1','2','5'],range:{anchor:'5',offset:0,base:['1','2','5']}};let result=boundaryPersonSelection(list,initial,null,direction);
 assert.deepEqual(result.ids,direction===1?['1','2','5','6','7','8']:['1','2','3','4','5']);const repeat=boundaryPersonSelection(list,result,result.boundary,direction);assert.deepEqual(repeat.ids,result.ids);
 result=boundaryPersonSelection(list,result,result.boundary,-direction);assert.deepEqual(result.ids,initial.ids);assert.equal(result.active,initial.active);assert.deepEqual(result.range,initial.range);assert.equal(result.boundary,null);
 }
});
