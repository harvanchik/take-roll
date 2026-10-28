'use client';
import DropdownArrow from './dropdown-arrow';
import {Children,isValidElement,useRef,useState,type ReactNode,type ReactElement,type RefObject} from 'react';
import {Select as BaseSelect} from '@base-ui/react/select';
import {Check} from 'lucide-react';

type OptionProps={value?:string|number;children?:ReactNode;disabled?:boolean};
type Props={children:ReactNode;value?:string|number|null;defaultValue?:string|number;onValueChange?:(value:string)=>void;name?:string;required?:boolean;disabled?:boolean;id?:string;'aria-label'?:string;className?:string;popupAnchor?:RefObject<HTMLElement|null>;popupAlign?:'start'|'center'|'end';popupClassName?:string};
export default function Select({children,value,defaultValue,onValueChange,name,required,disabled,id,className='',popupAnchor,popupAlign='end',popupClassName='',...aria}:Props){
 const options=Children.toArray(children).filter(isValidElement).map(child=>{const option=child as ReactElement<OptionProps>;return {value:String(option.props.value??option.props.children??''),label:option.props.children,disabled:option.props.disabled};});
 const trigger=useRef<HTMLButtonElement>(null),[container,setContainer]=useState<HTMLElement|null>(null);
 return <BaseSelect.Root<string> modal={false} name={name} required={required} disabled={disabled} items={options} value={value===null?null:value===undefined?undefined:String(value)} defaultValue={String(defaultValue??options.find(item=>!item.disabled)?.value??'')} onValueChange={next=>{if(next!==null)onValueChange?.(next);}} onOpenChange={open=>{if(open)setContainer(trigger.current?.closest('dialog')||null);}}>
  <BaseSelect.Trigger ref={trigger} id={id} {...aria} className={'app-select-trigger '+className}><BaseSelect.Value className="app-select-value"/><BaseSelect.Icon><DropdownArrow size={14}/></BaseSelect.Icon></BaseSelect.Trigger>
  {/* Undefined uses the document body; null would prevent the popup from mounting. */}
  <BaseSelect.Portal container={container??undefined}><BaseSelect.Positioner anchor={popupAnchor} align={popupAlign} positionMethod="fixed" sideOffset={4} alignItemWithTrigger={false} collisionPadding={8} className="app-select-positioner"><BaseSelect.Popup className={'app-select-popup '+popupClassName}><BaseSelect.List>{options.map(option=><BaseSelect.Item key={option.value} value={option.value} disabled={option.disabled} className="app-select-option"><BaseSelect.ItemText className="app-select-option-text">{option.label}</BaseSelect.ItemText><BaseSelect.ItemIndicator className="app-select-check"><Check size={14}/></BaseSelect.ItemIndicator></BaseSelect.Item>)}</BaseSelect.List></BaseSelect.Popup></BaseSelect.Positioner></BaseSelect.Portal>
 </BaseSelect.Root>;
}
