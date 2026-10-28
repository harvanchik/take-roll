import assert from 'node:assert/strict';
import {test} from 'node:test';
import {settingsRevealOffset,revealSettingsGroup} from '../lib/settings-reveal.ts';
const bounds=(top,bottom)=>({top,bottom});
test('settings already fully visible stay still, including viewport edges',()=>{
 assert.equal(settingsRevealOffset(bounds(100,400),bounds(0,800)),0);
 assert.equal(settingsRevealOffset(bounds(0,800),bounds(0,800)),0);
});
test('clipped sections move only enough to fit; tall sections align their heading',()=>{
 assert.equal(settingsRevealOffset(bounds(650,900),bounds(0,800)),112);
 assert.equal(settingsRevealOffset(bounds(-30,200),bounds(0,800)),-42);
 assert.equal(settingsRevealOffset(bounds(30,825),bounds(0,800)),27.5);
 assert.equal(settingsRevealOffset(bounds(500,1500),bounds(0,800)),488);
 assert.equal(settingsRevealOffset(bounds(12,1012),bounds(0,800)),0);
});
function fixture({rect=bounds(650,900),nested=false,footer=false,header=false,reduced=false,open=true,hidden=false}={}){
 const calls=[],body={},html={};
 const win={innerHeight:800,getComputedStyle:node=>({overflowY:node.scroll?'auto':'visible'}),matchMedia:()=>({matches:reduced}),scrollBy:options=>calls.push({target:'window',...options})};
 const doc={body,documentElement:html,defaultView:win};
 const container={scroll:true,scrollHeight:1500,clientHeight:600,clientTop:0,parentElement:body,getBoundingClientRect:()=>bounds(80,680),scrollBy:options=>calls.push({target:'container',...options})};
 const group={ownerDocument:doc,isConnected:true,open,getClientRects:()=>hidden?[]:[rect],getBoundingClientRect:()=>rect,parentElement:nested?container:body,closest:selector=>selector==='.settings-page'?(header?{querySelector:()=>({getBoundingClientRect:()=>bounds(nested?80:0,220)})}:null):footer?{querySelector:()=>({getBoundingClientRect:()=>bounds(620,670)})}:null};
 return {group,calls,win};
}
test('expanded settings use the mobile scroll container and keep clear of Save',()=>{
 const {group,calls}=fixture({nested:true,footer:true,rect:bounds(500,800)});revealSettingsGroup(group);
 assert.deepEqual(calls,[{target:'container',top:192,behavior:'smooth'}]);
});
test('desktop reveal respects reduced motion and the visual viewport',()=>{
 const {group,calls,win}=fixture({reduced:true});win.visualViewport={offsetTop:50,height:600};revealSettingsGroup(group);
 assert.deepEqual(calls,[{target:'window',top:262,behavior:'auto'}]);
});
test('hidden, collapsed, detached and already visible sections never scroll',()=>{
 for(const options of [{open:false},{hidden:true},{rect:bounds(120,400)}]){const {group,calls}=fixture(options);revealSettingsGroup(group);assert.deepEqual(calls,[]);}
 const {group,calls}=fixture();group.isConnected=false;revealSettingsGroup(group);assert.deepEqual(calls,[]);
});

test('expanded groups stay below the sticky settings header in desktop and nested scrolling',()=>{
 for(const nested of [true,false]){const {group,calls}=fixture({nested,header:true,rect:bounds(120,400)});revealSettingsGroup(group);assert.deepEqual(calls,[{target:nested?'container':'window',top:-112,behavior:'smooth'}]);}
});
