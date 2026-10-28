import {test} from 'node:test';
import assert from 'node:assert/strict';
import {subscribeWorkspace} from '../lib/live-client.ts';

function browser(t,{sse=true,fail=false}={}){
 const original=new Map(['document','window','navigator','EventSource','fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const document=Object.assign(new EventTarget(),{hidden:false}),window=Object.assign(new EventTarget(),{location:{pathname:'/events',replace(){}}}),navigator={onLine:true};
 const sources=[];let polls=0;
 class Source extends EventTarget{constructor(){super();this.closed=false;sources.push(this);}close(){this.closed=true;}message(value){this.onmessage?.({data:JSON.stringify(value)});}error(){this.onerror?.();}}
 for(const [key,value] of Object.entries({document,window,navigator,EventSource:sse?Source:undefined,fetch:async()=>{polls++;if(fail)throw Error('Offline');return Response.json({revision:1});}}))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 t.mock.timers.enable({apis:['setTimeout','Date'],now:100_000});
 const versions=[],states=[];const stop=subscribeWorkspace(v=>versions.push(v),()=>{},s=>states.push(s));
 t.after(()=>{stop();t.mock.timers.reset();for(const [key,descriptor] of original)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
 return {document,window,navigator,sources,versions,states,get polls(){return polls;},stop,async advance(ms){for(let n=0;n<ms;n+=500){t.mock.timers.tick(Math.min(500,ms-n));await new Promise(resolve=>setImmediate(resolve));}}};
}
test('healthy SSE heartbeats never start redundant HTTP polling',async t=>{
 const b=browser(t);assert.equal(b.polls,0);b.sources[0].message({revision:1});
 for(let i=0;i<4;i++){await b.advance(4500);b.sources[0].dispatchEvent(new Event('ping'));}
 assert.equal(b.polls,0);assert.equal(b.sources.length,1);assert.deepEqual(b.versions,[{revision:1}]);
});
test('a silent stalled stream falls back to HTTP and reconnects',async t=>{
 const b=browser(t);await b.advance(13_000);assert.equal(b.polls,1);assert.equal(b.sources[0].closed,true);assert.equal(b.sources.length,2);
});
test('hidden/offline tabs close streams and resume promptly without leaking listeners',async t=>{
 const b=browser(t);b.document.hidden=true;b.document.dispatchEvent(new Event('visibilitychange'));assert.ok(b.sources[0].closed);await b.advance(6000);assert.equal(b.polls,0);
 b.document.hidden=false;b.document.dispatchEvent(new Event('visibilitychange'));await b.advance(500);assert.equal(b.sources.length,2);assert.equal(b.polls,1);
 b.navigator.onLine=false;b.window.dispatchEvent(new Event('offline'));assert.ok(b.sources[1].closed);await b.advance(5000);assert.equal(b.polls,1);
 b.stop();b.navigator.onLine=true;b.window.dispatchEvent(new Event('online'));await b.advance(5000);assert.equal(b.sources.length,2);
});
test('HTTP-only fallback backs off instead of flooding an unavailable server',async t=>{
 const b=browser(t,{sse:false,fail:true});await b.advance(30_000);assert.ok(b.polls>=3&&b.polls<=5,`${b.polls} polls`);assert.ok(b.states.includes('offline'));
});
test('stream reconnects use a short first delay and exponential failure backoff',async t=>{
 const b=browser(t);b.sources[0].error();await b.advance(500);assert.equal(b.sources.length,2);
 b.sources[1].error();await b.advance(500);assert.equal(b.sources.length,3);
 b.sources[2].error();await b.advance(500);assert.equal(b.sources.length,3);await b.advance(500);assert.equal(b.sources.length,4);
});
test('direct snapshots and patches update a separate server baseline without HTTP',async t=>{
 const b=browser(t);const first={accountId:'a',workspaceId:'w',revision:1,data:{events:[],rosters:[],profile:{firstName:'Alice'}}};b.sources[0].message(first);
 b.sources[0].message({accountId:'a',workspaceId:'w',revision:2,baseRevision:1,patch:[{path:['profile','firstName'],value:'Alex'}]});
 assert.equal(b.versions.at(-1).data.profile.firstName,'Alex');assert.equal(b.versions[0].data.profile.firstName,'Alice');assert.equal(b.polls,0);
});
test('a missing patch baseline reconnects and requests full recovery',async t=>{
 const b=browser(t);b.sources[0].message({accountId:'a',workspaceId:'w',revision:3,baseRevision:2,patch:[]});assert.equal(b.versions.at(-1).reload,true);assert.ok(b.sources[0].closed);await b.advance(500);assert.equal(b.sources.length,2);
});
test('stale callbacks from a closed stream cannot close a replacement stream',async t=>{
 const b=browser(t);b.sources[0].error();await b.advance(500);b.sources[0].error();b.sources[0].message({revision:999});assert.equal(b.sources[1].closed,false);assert.ok(!b.versions.some(v=>v.revision===999));
});
