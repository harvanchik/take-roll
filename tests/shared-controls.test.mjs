import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {createElement as h} from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({stdin:{contents:"export {default as Select} from './app/select';export {default as Modal} from './app/modal';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',outfile:'.sites-runtime/shared-controls-test.mjs'});
const {Select,Modal}=await import('../.sites-runtime/shared-controls-test.mjs');
test('custom selects retain named form values, required semantics and rich option labels',()=>{
 const html=render(h('label',null,'Roster',h(Select,{name:'roster',defaultValue:'b',required:true},h('option',{value:'a'},'A'),h('option',{value:'b'},'Staff',' (',8,')'))));
 assert.match(html,/role="combobox"/);assert.match(html,/aria-required="true"/);assert.match(html,/Staff \(8\)/);assert.match(html,/name="roster" value="b"/);assert.match(html,/type="button"/);
});
test('controlled numeric values and disabled controls retain their field behavior',()=>{
 const html=render(h(Select,{name:'count',value:10,disabled:true},h('option',{value:4},'Four'),h('option',{value:10},'Ten')));
 assert.match(html,/>Ten<\/span>/);assert.match(html,/disabled=""/);assert.match(html,/name="count".*value="10"/);
});
test('shared modal provides its accessible heading and one consistent close control',()=>{
 const html=render(h(Modal,{title:'Workspaces',close:()=>{}},h('p',null,'Different modal content')));
 assert.match(html,/<dialog[^>]+aria-labelledby=/);assert.match(html,/<h2 id="[^"]+">Workspaces<\/h2>/);assert.match(html,/class="icon modal-close"/);assert.match(html,/aria-label="Close Dialog"/);assert.ok(html.includes('Different modal content'));
});

test('action-style dropdowns support an explicitly empty selection without changing the offered choices',()=>{
 const html=render(h(Select,{value:null,'aria-label':'Choose Where To Add Person'},h('option',{value:'this'},'This Subevent'),h('option',{value:'all'},'All Subevents')));
 assert.match(html,/role="combobox"/);assert.match(html,/aria-label="Choose Where To Add Person"/);assert.ok(!html.includes('>null<'));
});
