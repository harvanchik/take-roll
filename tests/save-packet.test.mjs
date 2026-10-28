import assert from 'node:assert/strict';import {test} from 'node:test';
import {compactSaveReply,expandSaveReply} from '../lib/save-packet.ts';
test('compact acknowledgements reconstruct exact saved data and preserve the captured baseline',()=>{
 const base={events:Array.from({length:50},(_,i)=>({id:String(i),history:[],participants:[{id:'p',note:'Saved Note '+i,history:[]}]})),rosters:[],personalRevision:2,preferences:{theme:'dark',haptics:false}};
 const next=structuredClone(base);next.events[0].participants[0].note='New Note';next.events[0].history.push({id:'change'});next.appliedMutationIds=['save'];const original=structuredClone(base);
 const reply=compactSaveReply({data:next,revision:9},base,8);assert.ok(reply.patch);assert.ok(JSON.stringify(reply).length<JSON.stringify(next).length/10);
 assert.deepEqual(expandSaveReply(JSON.parse(JSON.stringify(reply)),{data:base,revision:8}).data,next);assert.deepEqual(base,original);
 assert.throws(()=>expandSaveReply(reply,{data:base,revision:7}));assert.throws(()=>expandSaveReply(reply,{data:{...base,personalRevision:3},revision:8}));assert.throws(()=>expandSaveReply(reply));
});
test('tiny or unpatchable replies stay complete and stale personal settings cannot become a baseline',()=>{
 const base={events:[],rosters:[]},full={data:{events:[],rosters:[]},revision:1};assert.equal(compactSaveReply(full,base,0),full);assert.equal(expandSaveReply(full),full);const error={error:'Conflict',revision:1};assert.equal(compactSaveReply(error,base,0),error);
});
