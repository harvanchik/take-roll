import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaultOrganization} from '../lib/workspace-settings.ts';
import {applyAction,seedData,personFromFields,displayName} from '../lib/model.ts';
import {nameTokens,encodeNameParts,encodeNameTokens,validateNameDisplay,formatCustomName} from '../lib/name-format.ts';
import {replaceTokens,reorderNameFields,formatLength,fieldOffset} from '../lib/name-format-edit.ts';
const field=(field,id=field)=>({kind:'field',field,id});
const text=text=>({kind:'text',text});
const example={firstName:'Alexandra',preferredFirstName:'Alex',lastName:'Rivera'};
const format=(tokens,preferred='Alex')=>formatCustomName({...example,preferredFirstName:preferred},encodeNameTokens(tokens));

test('all saved presets and custom punctuation load into inline tokens without changing names',()=>{
 const custom=encodeNameParts([{id:'last',field:'last',before:'',after:', '},{id:'first',field:'first',before:'',after:' '},{id:'preferred',field:'preferred',before:'(',after:')'}]);
 for(const mode of ['legal','preferred','quoted',custom])for(const preferredFirstName of ['Alex','','Alexandra']){
  const fields={...example,preferredFirstName};assert.equal(formatCustomName(fields,encodeNameTokens(nameTokens(mode))),formatCustomName(fields,mode));
 }
});
test('inline preferred-name wrappers disappear without losing legal-name punctuation',()=>{
 for(const [open,close] of [["'","'"],['‘','’'],['“','”'],['(',')'],['[',']']]){
  const tokens=[field('last'),text(', '),field('first'),text(' '+open),field('preferred'),text(close)];
  assert.equal(format(tokens),`Rivera, Alexandra ${open}Alex${close}`);assert.equal(format(tokens,''),'Rivera, Alexandra');
  assert.equal(format([text(open),field('preferred'),text(close+', '),field('last'),text(', '),field('first')],''),'Rivera, Alexandra');
  assert.equal(format([field('first'),text(' '+open),field('preferred'),text(close+' '),field('last')],''),'Alexandra Rivera');
 }
 assert.equal(format([field('last'),text(', '),field('preferred'),text(', '),field('first')],''),'Rivera, Alexandra');
 assert.equal(format([field('used'),text(' '),field('last')],''),'Alexandra Rivera');
 assert.equal(format([field('preferred'),text(' '),field('last')]),'Alex Rivera');
});
test('cursor insertion, replacing a selection, Backspace and Delete treat chips as atomic units',()=>{
 const initial=[field('last'),text(', '),field('first')];
 const inserted=replaceTokens(initial,2,2,[field('preferred')]);assert.equal(format(inserted),'Rivera,Alex Alexandra');
 assert.equal(format(replaceTokens(inserted,2,3,[])),'Rivera, Alexandra');
 assert.equal(format(replaceTokens(initial,1,3,[text(' / ')])),'Rivera / Alexandra');
 assert.equal(format(replaceTokens(initial,0,1,[])),', Alexandra');
 assert.deepEqual(replaceTokens(initial,0,formatLength(initial),[field('used')]),[field('used')]);
 const punctuation=replaceTokens([field('first'),field('last')],1,1,[text(' (Legal), ')]);assert.equal(format(punctuation),'Alexandra (Legal), Rivera');
 assert.equal(fieldOffset(initial,'first'),3);
});
test('handle reordering moves only chips, leaving punctuation in place',()=>{
 const initial=[field('first'),text(', '),field('last'),text(" '"),field('preferred'),text("'")];
 const moved=reorderNameFields(initial,'last',0);assert.equal(format(moved),"Rivera, Alexandra 'Alex'");
 assert.deepEqual(moved.filter(t=>t.kind==='text'),initial.filter(t=>t.kind==='text'));
 assert.equal(reorderNameFields(initial,'first',-1),initial);assert.equal(reorderNameFields(initial,'last',9),initial);
});
test('inline formats survive organization save, reload and member rendering without touching records',()=>{
 let data=seedData();data=applyAction(data,{type:'create-event',name:'Team Meeting',date:'2026-10-20',rosterId:data.rosters[0].id});
 data=applyAction(data,{type:'status',eventId:data.events[0].id,personId:data.events[0].participants[0].id,status:'Present'});
 const before=structuredClone({events:data.events,rosters:data.rosters}),mode=encodeNameTokens([field('last'),text(', '),field('used')]);
 data=applyAction(data,{type:'update-organization',organization:{...defaultOrganization,...data.organization,nameDisplay:mode}});
 const reopened=JSON.parse(JSON.stringify(data));assert.equal(reopened.organization.nameDisplay,validateNameDisplay(mode));assert.deepEqual({events:reopened.events,rosters:reopened.rosters},before);
 assert.equal(displayName(personFromFields({...example,firstPronunciation:'',lastPronunciation:''}),reopened.organization.nameDisplay),'Rivera, Alex');
 assert.deepEqual(nameTokens(validateNameDisplay(mode)),nameTokens(mode));
});
test('untrusted inline formats are bounded and validated; text is not interpreted as markup',()=>{
 assert.equal(format([field('first'),text(' <script> '),field('last')]),'Alexandra <script> Rivera');
 for(const tokens of [[field('__proto__')],[field('first'),field('first')],[field('first'),text('x'.repeat(321))],[{kind:'html',text:'bad'}],[field('first'),text('\n')],Array.from({length:9},(_,i)=>field('first','f'+i))])assert.throws(()=>validateNameDisplay(encodeNameTokens(tokens)));
 assert.deepEqual(nameTokens(validateNameDisplay(encodeNameTokens([]))),[]);
});
