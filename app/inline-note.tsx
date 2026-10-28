'use client';
import useTextDraft from './use-text-draft';
export default function InlineNote({value,name,onSave,flushRef,isolated=false}:{isolated?:boolean;value:string;name:string;onSave:(note:string,before:string)=>Promise<unknown>;flushRef:{current:()=>void}}){
 const text=useTextDraft(value,onSave,undefined,isolated);flushRef.current=text.flush;
 return <textarea className="inline-person-note" aria-label={`Note for ${name}`} value={text.draft} onChange={e=>text.change(e.target.value)} onBlur={text.flush} onCompositionStart={()=>text.composition(true)} onCompositionEnd={()=>text.composition(false)} maxLength={2000} rows={2} placeholder="Note…" spellCheck={true}/>;
}
