import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rememberedWorkspace,rememberWorkspace} from '../lib/workspace-selection.ts';
const storage=()=>{const entries=new Map();return {getItem:key=>entries.get(key)||null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};};
test('last workspace persists across sessions and stays separate for each account',()=>{
 const local=storage(),firstSession=storage();rememberWorkspace('alice','team-a',local,firstSession);rememberWorkspace('bob','team-b',local,firstSession);
 assert.equal(rememberedWorkspace('alice',local,storage()),'team-a');assert.equal(rememberedWorkspace('bob',local,storage()),'team-b');assert.equal(rememberedWorkspace('other',local,firstSession),undefined);
});
test('existing tab selections can migrate without losing the selected workspace',()=>{
 const local=storage(),session=storage();session.setItem('roll-call.workspace.v1.alice','old-team');const selected=rememberedWorkspace('alice',local,session);assert.equal(selected,'old-team');rememberWorkspace('alice',selected,local,session);assert.equal(rememberedWorkspace('alice',local,storage()),'old-team');
});
test('no-workspace state clears only that account’s selection',()=>{
 const local=storage(),session=storage();rememberWorkspace('alice','a',local,session);rememberWorkspace('bob','b',local,session);rememberWorkspace('alice',undefined,local,session);assert.equal(rememberedWorkspace('alice',local,session),undefined);assert.equal(rememberedWorkspace('bob',local,session),'b');
});
test('restricted device storage falls back to available session storage',()=>{
 const denied={getItem(){throw Error('Blocked');},setItem(){throw Error('Blocked');},removeItem(){throw Error('Blocked');}},session=storage();rememberWorkspace('alice','team',denied,session);assert.equal(rememberedWorkspace('alice',denied,session),'team');
});
