'use client';
import DropdownArrow from './dropdown-arrow';
import {useRef,useState,type CSSProperties} from 'react';
import {Select as BaseSelect} from '@base-ui/react/select';
import {Check} from 'lucide-react';

type Option={value:string;label:string;style?:CSSProperties};
const ALL='__all__';
/** Shares the app's select shell, with keyboard navigation and persistent multi-selection. */
export default function MultiSelect({value,onValueChange,options,placeholder,label,includeAllOption=true,selectionLabel}:{value:string[];onValueChange:(value:string[])=>void;options:Option[];placeholder:string;label:string;includeAllOption?:boolean;selectionLabel?:string}){
 const trigger=useRef<HTMLButtonElement>(null),[container,setContainer]=useState<HTMLElement|null>(null);
 const items=includeAllOption?[{value:ALL,label:placeholder},...options]:options,selected=options.filter(option=>value.includes(option.value));
 return <BaseSelect.Root<string,true> multiple modal={false} items={items} value={includeAllOption&&!value.length?[ALL]:value} onValueChange={next=>onValueChange(includeAllOption?(next.at(-1)===ALL?[]:next.filter(item=>item!==ALL)):next)} onOpenChange={open=>{if(open)setContainer(trigger.current?.closest('dialog')||null);}}>
  <BaseSelect.Trigger ref={trigger} aria-label={label} className="app-select-trigger app-multi-select-trigger"><BaseSelect.Value className="app-select-value">{()=>selectionLabel??(selected.length?selected.map((option,index)=><span key={option.value}>{index>0&&', '}<span className={option.style?'custom-attendance-cell':undefined} style={option.style}>{option.label}</span></span>):placeholder)}</BaseSelect.Value><BaseSelect.Icon><DropdownArrow size={14}/></BaseSelect.Icon></BaseSelect.Trigger>
  <BaseSelect.Portal container={container??undefined}><BaseSelect.Positioner align="end" positionMethod="fixed" sideOffset={4} alignItemWithTrigger={false} collisionPadding={8} className="app-select-positioner"><BaseSelect.Popup className="app-select-popup"><BaseSelect.List>{items.map(option=><BaseSelect.Item key={option.value} value={option.value} label={option.label} className={'app-select-option app-multi-select-option'+('style' in option&&option.style?' custom-attendance-cell':'')} style={'style' in option?option.style:undefined}><BaseSelect.ItemText className="app-select-option-text">{option.label}</BaseSelect.ItemText><span className="app-option-checkbox" aria-hidden="true"><BaseSelect.ItemIndicator><Check size={12}/></BaseSelect.ItemIndicator></span></BaseSelect.Item>)}</BaseSelect.List></BaseSelect.Popup></BaseSelect.Positioner></BaseSelect.Portal>
 </BaseSelect.Root>;
}
