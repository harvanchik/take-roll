import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DEFAULT_ATTENDANCE} from '../lib/attendance-settings.ts';
import {mobileSwipeActions,SKIP_SWIPE} from '../lib/mobile-swipe-actions.ts';
import {validateOrganization,defaultOrganization} from '../lib/workspace-settings.ts';
import {applyAction} from '../lib/model.ts';
import {seedData} from './fixtures.mjs';
import {effectiveEventSettings,eventSettingsSnapshot} from '../lib/event-settings.ts';
import {livePatch,applyLivePatch} from '../lib/live-patch.ts';
import {menuPlacement} from '../lib/menu-placement.ts';
test('swipe actions support custom active statuses and skip, with a fallback for inactive choices',()=>{
 const config=structuredClone(DEFAULT_ATTENDANCE);config.statuses.push({id:'status-remote',name:'Remote',active:true,attended:true,allowExcuse:false,color:'blue'});
 assert.equal(mobileSwipeActions(config).left.id,'Absent');assert.equal(mobileSwipeActions(config).right.id,'Present');
 assert.deepEqual(mobileSwipeActions(config,{left:SKIP_SWIPE,right:'status-remote'}).left,{id:SKIP_SWIPE,name:'Skip'});assert.equal(mobileSwipeActions(config,{right:'status-remote'}).right.name,'Remote');
 config.statuses.at(-1).active=false;assert.equal(mobileSwipeActions(config,{right:'status-remote'}).right.id,'Present');
 const saved=validateOrganization({...defaultOrganization,mobileSwipe:{left:SKIP_SWIPE,right:'status-remote'}});assert.equal(saved.mobileSwipe.left,SKIP_SWIPE);assert.equal(saved.mobileSwipe.right,'status-remote');assert.throws(()=>validateOrganization({...defaultOrganization,mobileSwipe:{left:'not-an-action'}}));
});
test('menus stay inside narrow viewports, flip above when needed, and constrain long content',()=>{
 for(const width of [240,320,375,768,1440])for(const height of [180,320,700])for(const x of [0,width/2,width-20])for(const y of [0,height/2,height-30]){
  const viewport={left:0,top:0,width,height},menu={width:300,height:600},placement=menuPlacement({left:x,right:x+20,top:y,bottom:y+30},menu,viewport),actualHeight=Math.min(menu.height,placement.maxHeight);
  assert.ok(placement.left>=8);assert.ok(placement.top>=8);assert.ok(placement.left+placement.width<=width-8);assert.ok(placement.top+actualHeight<=height-8);
 }
 const above=menuPlacement({left:10,right:90,top:270,bottom:300},{width:210,height:180},{left:0,top:0,width:320,height:320});assert.ok(above.top<270);assert.equal(above.maxHeight,258);
 const keyboard=menuPlacement({left:10,right:100,top:220,bottom:250},{width:280,height:400},{left:0,top:100,width:320,height:200});assert.ok(keyboard.top>=108);assert.ok(keyboard.top+Math.min(400,keyboard.maxHeight)<=292);
});

test('saved swipe defaults inherit globally, allow family-local overrides, and survive reload and live delivery',()=>{
 let data=seedData();data=applyAction(data,{type:'create-event',rosterId:data.rosters[0].id,name:'Training',date:'2026-10-28'});const root=data.events[0];data=applyAction(data,{type:'create-subevent',eventId:root.id,name:'Second',date:'2026-10-29'});
 data=applyAction(data,{type:'update-organization',organization:{...defaultOrganization,mobileSwipe:{left:SKIP_SWIPE,right:'Present'}}});
 assert.deepEqual(effectiveEventSettings(data,root).mobileSwipe,{left:SKIP_SWIPE,right:'Present'});
 const before=structuredClone(data),local={...eventSettingsSnapshot(effectiveEventSettings(data,root)),mobileSwipe:{left:'Absent',right:SKIP_SWIPE},useGlobal:false};
 data=applyAction(data,{type:'update-event-settings',eventId:root.id,settings:local});assert.deepEqual(effectiveEventSettings(data,data.events[1]).mobileSwipe,{left:'Absent',right:SKIP_SWIPE});
 assert.deepEqual(applyLivePatch(before,livePatch(before,data)),data);const reopened=JSON.parse(JSON.stringify(data));assert.deepEqual(effectiveEventSettings(reopened,reopened.events[0]).mobileSwipe,local.mobileSwipe);
 data=applyAction(data,{type:'update-organization',organization:{...defaultOrganization,mobileSwipe:{left:'Tardy',right:'Present'}}});assert.deepEqual(effectiveEventSettings(data,root).mobileSwipe,local.mobileSwipe);
 data=applyAction(data,{type:'update-event-settings',eventId:root.id,settings:{...local,useGlobal:true}});assert.deepEqual(effectiveEventSettings(data,root).mobileSwipe,{left:'Tardy',right:'Present'});
});
