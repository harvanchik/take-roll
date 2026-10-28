import assert from 'node:assert/strict';import {test} from 'node:test';
import {ModalBackdropGesture,ModalInputBaseline,modalInputValue} from '../lib/modal-dismiss.ts';
import {createRequire} from 'node:module';import {dirname} from 'node:path';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({entryPoints:['app/modal.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',outfile:'.sites-runtime/modal-dismiss-ui.mjs'});
const {default:Modal,ModalCloseConfirmation,ModalDismiss}=await import('../.sites-runtime/modal-dismiss-ui.mjs'),{createElement:h}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
test('a drag from inside never dismisses, while a complete primary backdrop gesture does',()=>{
 const g=new ModalBackdropGesture();g.start(1,false);assert.equal(g.end(1,true),false);g.start(1,true);assert.equal(g.end(1,false),false);g.start(1,true);assert.equal(g.end(1,true),true);assert.equal(g.end(1,true),false);
 g.start(1,true);assert.equal(g.end(2,true),false);g.start(1,true,false);assert.equal(g.end(1,true),false);g.start(1,true);g.cancel();assert.equal(g.end(1,true),false);
});
function root(){return {inputs:[],querySelectorAll(){return this.inputs;}};}
function input(owner,options={}){const node={tagName:'INPUT',type:'text',value:'',checked:false,textContent:'',readOnly:false,getAttribute(name){return name==='role'?this.role:null;},closest(){return owner;},...options};owner.inputs.push(node);return node;}
test('dirty detection covers text, checkboxes, selects, files, and formatted input without losing the opening baseline',()=>{
 const dialog=root(),text=input(dialog,{value:'Initial'}),checkbox=input(dialog,{type:'checkbox',checked:true}),select=input(dialog,{tagName:'SELECT',selectedOptions:[{value:'a'}]}),combobox=input(dialog,{tagName:'BUTTON',type:'button',role:'combobox',textContent:'One'}),editable=input(dialog,{tagName:'DIV',type:undefined,isContentEditable:true,textContent:'Name'}),file=input(dialog,{type:'file',files:[]});
 const baseline=new ModalInputBaseline();baseline.remember(dialog);assert.equal(baseline.dirty(dialog),false);
 for(const [node,key,value] of [[text,'value','Changed'],[checkbox,'checked',false],[select,'selectedOptions',[{value:'b'}]],[editable,'textContent','New Name'],[file,'files',[{name:'staff.csv',size:12,lastModified:1}]]]){const before=node[key];node[key]=value;baseline.remember(dialog);assert.equal(baseline.dirty(dialog),true);node[key]=before;assert.equal(baseline.dirty(dialog),false);}
 combobox.textContent='Two';assert.equal(baseline.dirty(dialog),true);combobox.textContent='One';assert.equal(baseline.dirty(dialog),false);
});
test('read-only generated output and nested dialogs do not dirty the parent; new controls receive their own baseline',()=>{
 const dialog=root(),output=input(dialog,{tagName:'TEXTAREA',readOnly:true,value:'Report'}),nested=root(),other=input(nested,{value:'Other'});dialog.inputs.push(other);const baseline=new ModalInputBaseline();baseline.remember(dialog);output.value='Regenerated';other.value='Changed';assert.equal(baseline.dirty(dialog),false);
 const field=input(dialog,{value:'New Section Default'});baseline.remember(dialog);assert.equal(baseline.dirty(dialog),false);field.value='User Edit';assert.equal(baseline.dirty(dialog),true);dialog.inputs=dialog.inputs.filter(i=>i!==field);assert.equal(baseline.dirty(dialog),false);
 assert.equal(modalInputValue(input(dialog,{type:'submit'})),undefined);
});
test('the compact discard confirmation uses the shared dialog shell and explicit safe/back actions',()=>{
 const html=renderToStaticMarkup(h(ModalCloseConfirmation,{confirm(){},goBack(){}}));for(const label of ['Close Without Saving?','Unsaved progress will be lost.','Go Back','Confirm','modal-close-confirm','Close Dialog'])assert.ok(html.includes(label),label);
 assert.match(html,/autofocus=""[^>]*>Go Back/);const shell=renderToStaticMarkup(h(Modal,{title:'Example',close(){}},h(ModalDismiss,null,'Cancel')));assert.match(shell,/<button type="button">Cancel<\/button>/);assert.ok(!shell.includes('Close Without Saving?'));
});
