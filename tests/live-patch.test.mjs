import assert from 'node:assert/strict';
import {test} from 'node:test';
import {livePatch,applyLivePatch} from '../lib/live-patch.ts';
const wire=value=>JSON.parse(JSON.stringify(value));
test('patches reproduce edits, insertion, removal, reorder, undo, nulls and optional fields',()=>{
 const a={events:[{id:'e',participants:[{id:'a',note:'',history:[]},{id:'b',note:'Keep',history:[]}]}],rosters:[],profile:{firstName:'Alice'},appliedMutationIds:['one','two']};
 const cases=[{...a,profile:{firstName:'Alex',preferredName:'Al'}},{...a,profile:undefined},{...a,appliedMutationIds:['two','three']},{...a,events:[]},{...a,events:[{id:'e',participants:[a.events[0].participants[1],a.events[0].participants[0]]}]},{...a,events:[{id:'e',participants:[{id:'a',note:'Updated',history:[{id:'h',from:null,to:'Updated'}]},a.events[0].participants[1],{id:'c',note:'New',history:[]}]}]}];
 for(const b of cases){const original=wire(a),result=applyLivePatch(a,wire(livePatch(a,b)));assert.deepEqual(wire(result),wire(b));assert.deepEqual(wire(a),original);}
});
test('unchanged branches retain identity, changed branches never mutate the source',()=>{
 const before={events:[{id:'e',participants:[{id:'p',note:'Old',history:[]}]}],rosters:[{id:'r'}]};const after=wire(before);after.events[0].participants[0].note='New';const result=applyLivePatch(before,livePatch(before,after));assert.equal(result.rosters,before.rosters);assert.notEqual(result.events,before.events);assert.equal(before.events[0].participants[0].note,'Old');assert.deepEqual(result,after);
});
test('1000-row attendance patches are compact and support batch updates',()=>{
 const a={events:[{id:'e',participants:Array.from({length:1000},(_,i)=>({id:String(i),note:'A long original note '.repeat(4),status:null,history:[]}))}],rosters:[],appliedMutationIds:Array.from({length:2000},(_,i)=>String(i))};const b=wire(a);b.events[0].participants[500].status='Present';b.events[0].participants[500].history.push({id:'h',kind:'Status',to:'Present'});b.appliedMutationIds.shift();b.appliedMutationIds.push('new');const delta=livePatch(a,b);assert.ok(JSON.stringify(delta).length<JSON.stringify(b).length/100);assert.deepEqual(applyLivePatch(a,delta),b);
 for(const p of b.events[0].participants)p.status='Absent';assert.deepEqual(applyLivePatch(a,livePatch(a,b)),b);
});
test('malformed or prototype-writing patch paths fail safely',()=>{
 for(const key of ['__proto__','constructor','prototype'])assert.throws(()=>applyLivePatch({events:[],rosters:[]},[{path:[key,'polluted'],value:true}]));assert.equal({}.polluted,undefined);
 assert.throws(()=>applyLivePatch({events:[],rosters:[]},[{path:['events',99,'id'],value:'x'}]));
});
