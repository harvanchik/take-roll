'use client';
import {Undo2,Redo2} from 'lucide-react';
export default function HistoryButtons({canUndo,canRedo,onUndo,onRedo}:{canUndo:boolean;canRedo:boolean;onUndo:()=>void;onRedo:()=>void}){
 return <><button className="small icon-history" disabled={!canUndo} data-tooltip="Undo Move" aria-label="Undo Last Roll-Call Move" onClick={onUndo}><Undo2 size={15}/><span>Undo</span></button><button className="small icon-history" disabled={!canRedo} data-tooltip="Redo Move" aria-label="Redo Last Roll-Call Move" onClick={onRedo}><Redo2 size={15}/><span>Redo</span></button></>;
}
