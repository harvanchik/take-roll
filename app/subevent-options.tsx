'use client';
import {ContextMenu} from '@base-ui/react/context-menu';
import {Pencil,Trash2} from 'lucide-react';
import type {ReactElement} from 'react';
export default function SubeventOptions({children,rename,remove,canDelete,busy}:{children:ReactElement;rename:()=>void;remove:()=>void;canDelete:boolean;busy:boolean}){
 if(busy)return children;
 return <ContextMenu.Root><ContextMenu.Trigger render={children}/><ContextMenu.Portal><ContextMenu.Positioner sideOffset={4} collisionPadding={8}><ContextMenu.Popup className="subevent-options-popup"><ContextMenu.Item className="subevent-option" onClick={()=>requestAnimationFrame(rename)}><Pencil size={14}/>Rename</ContextMenu.Item><ContextMenu.Item className="subevent-option danger" disabled={!canDelete} onClick={remove}><Trash2 size={14}/>Delete</ContextMenu.Item></ContextMenu.Popup></ContextMenu.Positioner></ContextMenu.Portal></ContextMenu.Root>;
}
