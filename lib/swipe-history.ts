import {attendanceLabel,displayEvent,displayName,type Data} from './model.ts';
import type {HistoryMove} from './attendance-queue';

export type SwipeHistoryNavigation={
 token:number;eventId:string;viewKey:string;personId?:string;
 direction:'undo'|'redo';swipeDirection:-1|0|1;message:string;
};

// Use the queue's actual move and resulting data, never the deck's current index.
export function swipeHistoryNavigation(move:HistoryMove,direction:'undo'|'redo',data:Data,token:number,viewKey:string):SwipeHistoryNavigation{
 const action=direction==='undo'?move.backward:move.forward;
 const personId=action.personId||action.changes?.[0]?.personId;
 const event=data.events.find(e=>e.id===move.eventId);
 const person=event?displayEvent(data,event).participants.find(p=>p.id===personId):undefined;
 const verb=direction==='undo'?'Undid':'Redid';
 const detail=action.type==='person-note'?'Note':action.type==='person-flag'?(person?.flag==='flagged'?'Flagged':person?.flag==='complete'?'Follow-up Complete':'Flag Cleared'):person?attendanceLabel(person):'Take Roll Change';
 return {token,eventId:move.eventId,viewKey,personId,direction,
  swipeDirection:move.forward.swipeDirection===-1?-1:move.forward.swipeDirection===1?1:0,
  message:[verb,person?displayName(person):'',detail].filter(Boolean).join(' · ')};
}

export function swipeHistoryPosition(people:ReadonlyArray<{id:string}>,navigation:SwipeHistoryNavigation){
 const index=people.findIndex(p=>p.id===navigation.personId);
 return index<0?null:{index,afterReplay:Math.min(index+1,people.length)};
}
