'use client';
import {useId,useLayoutEffect,useRef,useState} from 'react';
import Select from './select';
import {NAME_FIELDS,nameTokens,encodeNameTokens,validateNameTokens,type NameDisplay,type NameToken} from '../lib/name-format';
import {compactTokens,fieldOffset,formatLength,reorderNameFields,replaceTokens} from '../lib/name-format-edit';

type Cursor={start:number;end:number};
const clean=(text:string)=>text.replace(/[\u200b\ufeff]/g,'').replace(/\u00a0/g,' ');
const isChip=(node:Node):node is HTMLElement=>node.nodeType===1&&(node as HTMLElement).hasAttribute('data-name-chip');
function nodeLength(node:Node):number{return isChip(node)?1:node.nodeType===3?clean(node.textContent||'').length:Array.from(node.childNodes).reduce((n,child)=>n+nodeLength(child),0);}
function offsetAt(root:HTMLElement,node:Node,offset:number):number{
 let position=0,found=false;
 function visit(current:Node){if(found)return;if(current===node){position+=current.nodeType===3?clean((current.textContent||'').slice(0,offset)).length:Array.from(current.childNodes).slice(0,offset).reduce((n,child)=>n+nodeLength(child),0);found=true;return;}if(isChip(current)){if(current.contains(node)){position++;found=true;}else position++;return;}if(current.nodeType===3){position+=nodeLength(current);return;}for(const child of current.childNodes)visit(child);}
 visit(root);return position;
}
function readTokens(root:HTMLElement):NameToken[]{
 const result:NameToken[]=[];
 function visit(node:Node,optionalFor?:string){if(isChip(node)){result.push({kind:'field',id:node.dataset.nameChip!,field:node.dataset.field as keyof typeof NAME_FIELDS});return;}if(node.nodeType===3){const text=clean(node.textContent||'');if(text)result.push({kind:'text',text,...(optionalFor?{optionalFor}:{})});return;}const owner=node.nodeType===1?(node as HTMLElement).dataset.optionalFor||optionalFor:optionalFor;for(const child of node.childNodes)visit(child,owner);}
 for(const node of root.childNodes)visit(node);return compactTokens(result);
}
function selectRange(root:HTMLElement,cursor:Cursor){
 const doc=root.ownerDocument,range=doc.createRange();
 function point(at:number):[Node,number]{let left=at;let result:[Node,number]|null=null;
  function visit(node:Node){if(result)return;if(isChip(node)){const index=Array.from(node.parentNode!.childNodes).indexOf(node as ChildNode);if(left===0)result=[node.parentNode!,index];else if(left===1)result=[node.parentNode!,index+1];else left--;return;}if(node.nodeType===3){const text=node.textContent||'',length=clean(text).length;if(left<=length){let raw=0,count=0;while(raw<text.length&&count<left){if(!/[\u200b\ufeff]/.test(text[raw]))count++;raw++;}if(!length)raw=text.length;result=[node,raw];}else left-=length;return;}for(const child of node.childNodes)visit(child);}
  visit(root);return result||[root,root.childNodes.length];
 }
 const start=point(cursor.start),end=point(cursor.end);range.setStart(...start);range.setEnd(...end);const selection=doc.getSelection();selection?.removeAllRanges();selection?.addRange(range);
}
function paint(root:HTMLElement,tokens:NameToken[],disabled:boolean){
 const doc=root.ownerDocument,fragment=doc.createDocumentFragment();
 const text=(value:string,owner?:string)=>{const span=doc.createElement('span');span.dataset.formatText='';if(owner)span.dataset.optionalFor=owner;span.textContent=value||'\u200b';fragment.appendChild(span);};
 text('');
 for(const t of tokens){if(t.kind==='text'){text(t.text,t.optionalFor);continue;}
  const chip=doc.createElement('span');chip.className='name-chip';chip.contentEditable='false';chip.dataset.nameChip=t.id;chip.dataset.field=t.field;
  const handle=doc.createElement('button');handle.type='button';handle.className='name-chip-handle';handle.dataset.chipHandle=t.id;handle.disabled=disabled;handle.setAttribute('aria-label',`Reorder ${NAME_FIELDS[t.field]}`);handle.setAttribute('data-tooltip','Drag To Reorder');
  const dots=doc.createElement('span');dots.className='name-chip-grip';dots.setAttribute('aria-hidden','true');handle.appendChild(dots);
  const label=doc.createElement('span');label.className='name-chip-label';label.textContent=NAME_FIELDS[t.field];
  const remove=doc.createElement('button');remove.type='button';remove.className='name-chip-remove';remove.dataset.chipRemove=t.id;remove.disabled=disabled;remove.setAttribute('aria-label',`Remove ${NAME_FIELDS[t.field]}`);remove.setAttribute('data-tooltip','Remove '+NAME_FIELDS[t.field]);const cross=doc.createElement('span');cross.textContent='×';cross.setAttribute('aria-hidden','true');remove.appendChild(cross);
  chip.appendChild(handle);chip.appendChild(label);chip.appendChild(remove);fragment.appendChild(chip);text('');
 }
 root.replaceChildren(fragment);
}
export default function NameFormatEditor({value,onChange,disabled=false}:{value:NameDisplay;onChange:(value:NameDisplay)=>void;disabled?:boolean}){
 const id=useId(),field=useRef<HTMLDivElement>(null),root=useRef<HTMLDivElement>(null),tokens=useRef(nameTokens(value)),last=useRef<NameDisplay|null>(null),lastDisabled=useRef(disabled),cursor=useRef<Cursor>({start:formatLength(tokens.current),end:formatLength(tokens.current)}),composing=useRef(false);
 const drag=useRef<{id:string;pointer:number;x:number;y:number;to:number;active:boolean}|null>(null);
 const [message,setMessage]=useState(''),[count,setCount]=useState(tokens.current.filter(t=>t.kind==='field').length);
 const remember=()=>{const node=root.current,selection=node?.ownerDocument.getSelection();if(!node||!selection?.rangeCount)return;const range=selection.getRangeAt(0);if(node.contains(range.startContainer)&&node.contains(range.endContainer))cursor.current={start:offsetAt(node,range.startContainer,range.startOffset),end:offsetAt(node,range.endContainer,range.endOffset)};};
 useLayoutEffect(()=>{const node=root.current;if(!node)return;if(last.current!==value||lastDisabled.current!==disabled){tokens.current=nameTokens(value);paint(node,tokens.current,disabled);last.current=value;lastDisabled.current=disabled;setCount(tokens.current.filter(t=>t.kind==='field').length);cursor.current={start:formatLength(tokens.current),end:formatLength(tokens.current)};}},[value,disabled]);
 useLayoutEffect(()=>{const doc=root.current?.ownerDocument;if(!doc)return;doc.addEventListener('selectionchange',remember);return()=>doc.removeEventListener('selectionchange',remember);},[]);
 const commit=(next:NameToken[],selection?:Cursor,focus=true)=>{
  if(disabled)return;
  try{next=validateNameTokens(compactTokens(next));}catch{setMessage('Use At Most 8 Name Parts And 320 Punctuation Characters.');paint(root.current!,tokens.current,disabled);selectRange(root.current!,cursor.current);return;}
  tokens.current=next;last.current=encodeNameTokens(next);setCount(next.filter(t=>t.kind==='field').length);setMessage('');
  if(selection){cursor.current=selection;paint(root.current!,next,disabled);if(focus){root.current!.focus({preventScroll:true});selectRange(root.current!,selection);}}
  onChange(last.current);
 };
 const insert=(field:keyof typeof NAME_FIELDS)=>{const t:NameToken={kind:'field',id:crypto.randomUUID(),field},at=cursor.current;commit(replaceTokens(tokens.current,at.start,at.end,[t]),{start:at.start+1,end:at.start+1});requestAnimationFrame(()=>{root.current?.focus({preventScroll:true});if(root.current)selectRange(root.current,cursor.current);});};
 const reorder=(chipId:string,to:number)=>{const next=reorderNameFields(tokens.current,chipId,to);if(next===tokens.current)return;commit(next,{start:fieldOffset(next,chipId),end:fieldOffset(next,chipId)},false);requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(`[data-chip-handle="${chipId}"]`)?.focus({preventScroll:true}));const chip=next.find(t=>t.kind==='field'&&t.id===chipId);if(chip?.kind==='field')setMessage(`${NAME_FIELDS[chip.field]} Moved To Position ${to+1}.`);};
 const finishDrag=(cancel=false)=>{const session=drag.current;drag.current=null;root.current?.querySelectorAll('[data-drop-target]').forEach(node=>node.removeAttribute('data-drop-target'));root.current?.removeAttribute('data-dragging');if(session?.active&&!cancel)reorder(session.id,session.to);};
 return <div className="name-format-editor"><label id={id+'-label'} onClick={()=>{if(!disabled)root.current?.focus();}}>Name Display</label><div ref={field} className={'name-format-field'+(disabled?' disabled':'')}>
  <div ref={root} className="name-format-input" role="textbox" aria-labelledby={id+'-label'} aria-multiline="false" aria-disabled={disabled} contentEditable={!disabled} suppressContentEditableWarning spellCheck={false} tabIndex={disabled?-1:0}
   onInput={()=>{if(!composing.current){remember();commit(readTokens(root.current!));}}}
   onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;remember();commit(readTokens(root.current!));}}
   onBlur={()=>{if(composing.current){composing.current=false;remember();commit(readTokens(root.current!));}}}
   onBeforeInput={e=>{const type=(e.nativeEvent as InputEvent).inputType;if(type==='insertParagraph'||type==='insertLineBreak')e.preventDefault();}}
   onPaste={e=>{e.preventDefault();remember();const text=e.clipboardData.getData('text/plain').replace(/[\r\n\t]/g,' ').replace(/[\u0000-\u001f\u007f\u200b\ufeff]/g,'');const at=cursor.current;commit(replaceTokens(tokens.current,at.start,at.end,[{kind:'text',text}]),{start:at.start+text.length,end:at.start+text.length});}}
   onDrop={e=>e.preventDefault()} onDragStart={e=>e.preventDefault()}
   onClick={e=>{const remove=(e.target as HTMLElement).closest<HTMLElement>('[data-chip-remove]');if(remove&&!disabled){const at=fieldOffset(tokens.current,remove.dataset.chipRemove!);commit(replaceTokens(tokens.current,at,at+1,[]),{start:at,end:at});}else remember();}}
   onKeyDown={e=>{
    if(disabled)return;
    if(e.key==='Escape'){finishDrag(true);return;}
    if(e.key==='Enter'&&!(e.target as HTMLElement).closest('button')){e.preventDefault();return;}
    if((e.target as HTMLElement).closest('button')||composing.current)return;
    remember();const at=cursor.current;
    if((e.key==='Backspace'||e.key==='Delete')&&at.start===at.end&&!e.ctrlKey&&!e.metaKey&&!e.altKey){const offset=e.key==='Backspace'?at.start-1:at.start;let position=0;const chip=tokens.current.find(t=>{const found=position===offset&&t.kind==='field';position+=t.kind==='field'?1:t.text.length;return found;});if(chip){e.preventDefault();commit(replaceTokens(tokens.current,offset,offset+1,[]),{start:offset,end:offset});}}
   }}
   onPointerDown={e=>{const handle=(e.target as HTMLElement).closest<HTMLElement>('[data-chip-handle]');if(!handle||disabled||e.button!==0)return;e.preventDefault();remember();const fields=tokens.current.filter(t=>t.kind==='field');drag.current={id:handle.dataset.chipHandle!,pointer:e.pointerId,x:e.clientX,y:e.clientY,to:fields.findIndex(t=>t.id===handle.dataset.chipHandle),active:false};handle.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);}}
   onPointerMove={e=>{const s=drag.current;if(!s||s.pointer!==e.pointerId)return;if(!s.active&&Math.hypot(e.clientX-s.x,e.clientY-s.y)<5)return;s.active=true;root.current!.dataset.dragging='true';let distance=Infinity;root.current!.querySelectorAll<HTMLElement>('[data-name-chip]').forEach((chip,index)=>{const rect=chip.getBoundingClientRect(),d=Math.hypot(e.clientX-(rect.left+rect.width/2),e.clientY-(rect.top+rect.height/2));chip.removeAttribute('data-drop-target');if(d<distance){distance=d;s.to=index;}});root.current!.querySelectorAll<HTMLElement>('[data-name-chip]')[s.to]?.setAttribute('data-drop-target','true');}}
   onPointerUp={()=>finishDrag()} onPointerCancel={()=>finishDrag(true)} onLostPointerCapture={()=>finishDrag(true)}
  />
  <div className="name-format-insert" onPointerDownCapture={remember}><Select popupAnchor={field} popupAlign="end" popupClassName="name-format-popup" value={null} disabled={disabled||count>=8} aria-label="Insert Name Part" className="name-format-insert-button" onValueChange={field=>insert(field as keyof typeof NAME_FIELDS)}>{Object.entries(NAME_FIELDS).map(([field,label])=><option key={field} value={field}>{label}</option>)}</Select></div>
 </div><span className={message.startsWith('Use At Most')?'form-error':'sr-only'} role="status">{message}</span></div>;
}
