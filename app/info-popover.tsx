'use client';
import {Popover} from '@base-ui/react/popover';
import {Info} from 'lucide-react';
import {useRef,useState} from 'react';

export default function InfoPopover({label,children}:{label:string;children:string}){
 const trigger=useRef<HTMLButtonElement>(null),[container,setContainer]=useState<HTMLElement|null>(null);
 return <Popover.Root modal={false} onOpenChange={open=>{if(open)setContainer(trigger.current?.closest<HTMLElement>('dialog,[popover]')??null);}}><Popover.Trigger ref={trigger} type="button" className="info-popover-trigger" openOnHover delay={200} closeDelay={100} aria-label={label}><Info size={12} aria-hidden="true"/></Popover.Trigger><Popover.Portal container={container??undefined}><Popover.Positioner side="top" sideOffset={7} collisionPadding={8} className="info-popover-positioner"><Popover.Popup className="info-popover-popup" initialFocus={false}><Popover.Title className="sr-only">{label}</Popover.Title><Popover.Description>{children}</Popover.Description></Popover.Popup></Popover.Positioner></Popover.Portal></Popover.Root>;
}
