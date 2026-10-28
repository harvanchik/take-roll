/** A backdrop dismissal requires one primary pointer gesture entirely outside the dialog. */
export class ModalBackdropGesture{
 private pointer:number|undefined;
 start(pointer:number,outside:boolean,primary=true){this.pointer=primary&&outside?pointer:undefined;}
 end(pointer:number,outside:boolean){const dismiss=this.pointer===pointer&&outside;this.pointer=undefined;return dismiss;}
 cancel(){this.pointer=undefined;}
}
type Control=Element&{type?:string;value?:string;checked?:boolean;readOnly?:boolean;files?:FileList|null;selectedOptions?:HTMLCollectionOf<HTMLOptionElement>;isContentEditable?:boolean};
export function modalInputValue(input:Control):string|undefined{
 const tag=input.tagName.toLowerCase(),type=input.type?.toLowerCase();
 if(input.readOnly)return;
 if(input.getAttribute('role')==='combobox')return input.textContent?.trim()||'';
 if(['button','submit','reset','image'].includes(type||''))return;
 if(type==='checkbox'||type==='radio')return String(input.checked);
 if(type==='file')return JSON.stringify(Array.from(input.files||[]).map(file=>[file.name,file.size,file.lastModified]));
 if(tag==='select')return JSON.stringify(Array.from(input.selectedOptions||[]).map(option=>option.value));
 if(tag==='input'||tag==='textarea')return input.value??'';
 if(input.isContentEditable)return input.textContent||'';
}
/** Baselines live only as long as the dialog. Reverting a field clears its dirty state. */
export class ModalInputBaseline{
 private values=new Map<Element,string>();
 private controls(root:HTMLElement){return Array.from(root.querySelectorAll<Control>('input,textarea,select,[contenteditable],[role="combobox"]')).filter(input=>input.closest('dialog')===root);}
 remember(root:HTMLElement){for(const input of this.controls(root)){const value=modalInputValue(input);if(value!==undefined&&!this.values.has(input))this.values.set(input,value);}}
 dirty(root:HTMLElement){return this.controls(root).some(input=>{const value=modalInputValue(input);return value!==undefined&&this.values.has(input)&&value!==this.values.get(input);});}
}
