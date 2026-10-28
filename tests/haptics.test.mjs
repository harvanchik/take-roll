import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function setup(){
 const calls=[],prefs=new Map();let now=1000,coarse=true,reduced=false,broken=false;
 const context={exports:{},require:()=>({WebHaptics:class{trigger(pattern){calls.push(pattern);return Promise.resolve();}cancel(){calls.push('cancel');}destroy(){calls.push('destroy');}}}),Date:{now:()=>now},document:{hidden:false},window:{matchMedia:q=>({matches:q.includes('coarse')?coarse:reduced})},localStorage:{getItem:k=>{if(broken)throw Error();return prefs.get(k)??null;},setItem:(k,v)=>{if(broken)throw Error();prefs.set(k,v);}}};
 const source=ts.transpileModule(fs.readFileSync(new URL('../lib/haptics.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,context);
 return {api:context.exports,calls,context,prefs,advance:()=>now+=100,stale:()=>now+=6000,coarse:v=>coarse=v,reduced:v=>reduced=v,broken:()=>broken=true};
}
test('only recent mobile touch interactions produce feedback',()=>{
 const h=setup();h.api.feedback('mark');assert.equal(h.calls.length,0);
 h.api.noteHapticGesture();h.api.feedback('mark');assert.equal(h.calls.length,1);
 h.api.noteHapticGesture(false);h.api.feedback('mark');assert.equal(h.calls.length,1);
 h.api.noteHapticGesture();h.coarse(false);h.api.feedback('mark');assert.equal(h.calls.length,1);
 h.coarse(true);h.context.document.hidden=true;h.api.feedback('mark');assert.equal(h.calls.length,1);
 h.context.document.hidden=false;h.stale();h.api.feedback('mark');assert.equal(h.calls.length,1);
});
test('reduced motion defaults to quiet; explicit preference overrides and survives storage failure',()=>{
 const h=setup();h.reduced(true);h.api.noteHapticGesture();h.api.feedback('mark');assert.equal(h.calls.length,0);
 h.broken();h.api.setHapticsEnabled(true);h.api.feedback('mark');assert.equal(h.calls.length,1);
 h.api.setHapticsEnabled(false);assert.equal(h.api.hapticsEnabled(),false);h.api.feedback('mark');assert.equal(h.calls.filter(c=>Array.isArray(c)).length,1);
});
test('semantic feedback suppresses the generic click from the same action',()=>{
 const h=setup();h.api.noteHapticGesture();h.api.feedback('warning');h.api.feedback('warning',true);h.api.feedback('selection',true);assert.equal(h.calls.length,1);
 h.advance();h.api.feedback('selection',true);assert.equal(h.calls.length,2);
 h.api.feedback('error');assert.equal(h.calls.at(-1),'error');
});
test('attendance semantics do not equate absence with an error or queued changes with server success',()=>{
 const h=setup();for(const status of ['Present','Absent',null])assert.equal(h.api.actionFeedback({type:'attendance-state',status}),'mark');
 assert.equal(h.api.actionFeedback({type:'person-flag',flag:'complete'}),'success');
 assert.equal(h.api.actionFeedback({type:'remove-event-person'}),'warning');
 for(const type of ['person-note','event-note','excuse','report-settings'])assert.equal(h.api.actionFeedback({type}),null);
});
test('server rendering does not touch browser APIs',()=>{
 const h=setup();delete h.context.window;assert.equal(h.api.hapticsEnabled(),false);assert.doesNotThrow(()=>h.api.feedback('mark'));assert.equal(h.calls.length,0);
});

test('Safari touch clicks without pointer metadata are accepted only after an actual touch',()=>{
 const h=setup();const click={detail:0};assert.equal(h.api.isHapticTouchClick(click),false);
 h.api.noteHapticGesture();assert.equal(h.api.isHapticTouchClick(click),true);
 assert.equal(h.api.isHapticTouchClick({detail:1,pointerType:'mouse'}),false);
 h.api.noteHapticGesture(false);assert.equal(h.api.isHapticTouchClick(click),false);
});
test('iPhone uses the native direct-tap path instead of a programmatic label click',()=>{
 const h=setup();h.context.navigator={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X)',platform:'iPhone',maxTouchPoints:5};
 assert.equal(h.api.usesIosHapticTaps(),true);h.api.noteHapticGesture();h.api.feedback('mark');assert.equal(h.calls.length,0);
 h.context.navigator={userAgent:'Mozilla/5.0',platform:'MacIntel',maxTouchPoints:5};assert.equal(h.api.usesIosHapticTaps(),true);
 h.context.navigator={userAgent:'Android',platform:'Linux',maxTouchPoints:5};assert.equal(h.api.usesIosHapticTaps(),false);h.api.feedback('mark');assert.equal(h.calls.length,1);
});
