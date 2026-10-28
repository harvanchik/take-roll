import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
class Element extends EventTarget{
 children=[];dataset={};captureIds=new Set();
 setAttribute(){} appendChild(node){this.children.push(node);return node;}
 setPointerCapture(id){this.captureIds.add(id);}hasPointerCapture(id){return this.captureIds.has(id);}releasePointerCapture(id){this.captureIds.delete(id);}remove(){this.removed=true;}
}
function setup(){const context={exports:{},document:{createElement:()=>new Element()}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/ios-swipe-haptic.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);let enabled=true;const card=new Element(),api=context.exports.createIosSwipeHaptic(card,()=>enabled),label=card.children[0];return {api,label,disable:()=>enabled=false};}
const click=label=>label.dispatchEvent(new Event('click',{cancelable:true}));
test('only a committed swipe permits one native release activation',()=>{const h=setup();h.api.capture(1);assert.equal(h.api.owns(1),true);assert.equal(click(h.label),false);h.api.capture(2);h.api.commit();assert.equal(click(h.label),true);assert.equal(click(h.label),false);});
test('cancelled and disabled swipes never activate the native switch',()=>{const h=setup();h.api.capture(1);h.api.commit();h.api.cancel();assert.equal(h.api.owns(1),false);assert.equal(click(h.label),false);h.api.capture(2);h.api.commit();h.disable();assert.equal(click(h.label),false);});
test('unmount removes the native gesture surface',()=>{const h=setup();h.api.destroy();assert.equal(h.label.removed,true);});
