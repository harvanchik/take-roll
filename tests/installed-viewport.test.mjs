import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import {installViewportGuards,installedViewportScript} from '../lib/installed-viewport.ts';

function fixture({touch=1,standalone=false,legacy=false,fullscreen=false}={}){
 const modes=new Map();
 for(const [name,matches] of [['standalone',standalone],['fullscreen',fullscreen]]){const target=new EventTarget();target.matches=matches;modes.set(`(display-mode: ${name})`,target);}
 const attributes={},doc=new EventTarget();doc.documentElement={dataset:{}};doc.querySelector=()=>({setAttribute:(name,value)=>attributes[name]=value});
 const win={navigator:{maxTouchPoints:touch,standalone:legacy},matchMedia:query=>modes.get(query)};
 return {win,doc,modes,attributes};
}
test('normal mobile browsing retains zoom and native gestures',()=>{
 const {win,doc,attributes}=fixture();const cleanup=installViewportGuards(win,doc);
 assert.equal(doc.documentElement.dataset.installedMobile,'false');assert.doesNotMatch(attributes.content,/maximum-scale|user-scalable/);
 const event=new Event('gesturestart',{cancelable:true});doc.dispatchEvent(event);assert.equal(event.defaultPrevented,false);cleanup();
});
test('installed touch apps block pinch but keep single-finger content scrolling',()=>{
 for(const options of [{standalone:true},{legacy:true},{fullscreen:true}]){
  const {win,doc,attributes}=fixture(options);const cleanup=installViewportGuards(win,doc);
  assert.equal(doc.documentElement.dataset.installedMobile,'true');assert.match(attributes.content,/maximum-scale=1/);assert.match(attributes.content,/viewport-fit=cover/);
  for(const type of ['gesturestart','gesturechange']){const event=new Event(type,{cancelable:true});doc.dispatchEvent(event);assert.equal(event.defaultPrevented,true);}
  for(const fingers of [1,2]){const event=new Event('touchstart',{cancelable:true});event.touches=Array(fingers);doc.dispatchEvent(event);assert.equal(event.defaultPrevented,fingers>1);}
  cleanup();const event=new Event('gesturestart',{cancelable:true});doc.dispatchEvent(event);assert.equal(event.defaultPrevented,false);
 }
});
test('desktop installs keep zoom; switching display mode updates touch app rules',()=>{
 const desktop=fixture({touch:0,standalone:true});installViewportGuards(desktop.win,desktop.doc)();assert.equal(desktop.doc.documentElement.dataset.installedMobile,'false');
 const {win,doc,modes,attributes}=fixture();const cleanup=installViewportGuards(win,doc);const media=modes.get('(display-mode: standalone)');media.matches=true;media.dispatchEvent(new Event('change'));assert.equal(doc.documentElement.dataset.installedMobile,'true');
 media.matches=false;media.dispatchEvent(new Event('change'));assert.doesNotMatch(attributes.content,/maximum-scale/);cleanup();
});
test('pre-hydration script matches installed viewport behavior',()=>{
 for(const options of [{},{standalone:true},{legacy:true},{fullscreen:true},{standalone:true,touch:0}]){
  const {win,doc,attributes}=fixture(options);vm.runInNewContext(installedViewportScript,{navigator:win.navigator,matchMedia:win.matchMedia,document:doc});
  const early=doc.documentElement.dataset.installedMobile;const cleanup=installViewportGuards(win,doc);assert.equal(doc.documentElement.dataset.installedMobile,early);if(early==='true')assert.match(attributes.content,/user-scalable=no/);cleanup();
 }
});
