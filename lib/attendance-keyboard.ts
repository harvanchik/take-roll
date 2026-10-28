type Row={id:string;status:string|null;removed?:boolean};
import {activeExcuses,activeStatuses,excuseStatus,reasonFromStatus,type AttendanceSettings} from './attendance-settings.ts';
import {excuseFor,type Participant} from './model.ts';
export function keyboardChoices(config:AttendanceSettings){const excuses=activeExcuses(config);return [...activeStatuses(config).slice(0,excuses.length?8:9),...(excuses.length?[{id:'Excused',name:config.excusedLabel,color:excuses[0].color}]:[])];}
export function keyboardExcuseChanges(rows:Participant[],config:AttendanceSettings){
 const choices=activeExcuses(config).map(e=>e.id);
 if(!choices.length)return [];
 return rows.filter(p=>!p.removed&&(!p.status||!!reasonFromStatus(p.status)||config.statuses.find(s=>s.id===p.status)?.allowExcuse)).map(p=>{
  const excuse=choices[choices.indexOf(excuseFor(p)??'')+1]??null;
  const status=p.status&&!reasonFromStatus(p.status)?p.status:excuse?excuseStatus(excuse):null;
  return {personId:p.id,status,excuse};
 });
}
export function nextUnmarkedId(rows:Row[],current:string,direction=1){
 const index=rows.findIndex(row=>row.id===current),start=index<0?(direction<0?0:-1):index;
 for(let step=1;step<=rows.length;step++){const row=rows[(start+step*direction+rows.length)%rows.length];if(!row.removed&&!row.status)return row.id;}
 return '';
}
export function adjacentPersonId(rows:Row[],current:string,direction:number){
 const visible=rows.filter(row=>!row.removed);if(!visible.length)return '';
 const index=visible.findIndex(row=>row.id===current);
 return visible[index<0?(direction<0?visible.length-1:0):(index+direction%visible.length+visible.length)%visible.length].id;
}
/** An anchored range can cross either end of the visible list without selecting hidden rows. */
export function keyboardSelection(rows:Row[],anchor:string,offset:number){
 const visible=rows.filter(row=>!row.removed),start=visible.findIndex(row=>row.id===anchor);if(start<0)return [];
 const length=Math.min(Math.abs(offset),visible.length-1),direction=offset<0?-1:1;
 return Array.from({length:length+1},(_,step)=>visible[(start+step*direction+visible.length)%visible.length].id);
}
export function keyboardStatus(key:string,statuses:Array<{id:string}>){return key==='0'?null:/^[1-9]$/.test(key)?statuses[Number(key)-1]?.id:undefined;}

/** Contiguous mouse and boundary selections follow the visible table order. */
export function contiguousSelection(rows:Row[],anchor:string,target:string){
 const visible=rows.filter(row=>!row.removed),start=visible.findIndex(row=>row.id===anchor),end=visible.findIndex(row=>row.id===target);
 if(end<0)return [];if(start<0)return [target];return visible.slice(Math.min(start,end),Math.max(start,end)+1).map(row=>row.id);
}

export type AttendanceSelectionRange={anchor:string;offset:number;base:string[]};
/** Keep completed groups while the range from the current anchor grows or shrinks. */
export function mergeSelection(rows:Row[],range:string[],base:string[]){
 const ids=new Set([...base,...range]);return rows.filter(row=>!row.removed&&ids.has(row.id)).map(row=>row.id);
}
export function clickPersonSelection(rows:Row[],previous:AttendanceSelectionRange,selected:string[],target:string,extend:boolean,add:boolean){
 const visible=rows.filter(row=>!row.removed),end=visible.findIndex(row=>row.id===target);
 if(end<0)return {range:previous,ids:selected};
 if(extend){const anchor=visible.some(row=>row.id===previous.anchor)?previous.anchor:target;return {range:{...previous,anchor,offset:end-visible.findIndex(row=>row.id===anchor)},ids:mergeSelection(visible,contiguousSelection(visible,anchor,target),previous.base)};}
 const ids=add?(selected.includes(target)?selected.filter(id=>id!==target):mergeSelection(visible,selected,[target])):[target];return {range:{anchor:target,offset:0,base:add?ids:[]},ids};
}

export type AttendanceSelectionState={active:string;ids:string[];range:AttendanceSelectionRange};
export type BoundarySelection={direction:1|-1;before:AttendanceSelectionState};
/** An opposite boundary shortcut restores the selection that preceded it. */
export function boundaryPersonSelection(rows:Row[],state:AttendanceSelectionState,boundary:BoundarySelection|null,direction:1|-1){
 if(boundary){if(boundary.direction!==direction)return {...boundary.before,boundary:null};return {...state,boundary};}
 const visible=rows.filter(row=>!row.removed),anchor=state.active||state.range.anchor,target=(direction<0?visible[0]:visible.at(-1))?.id,start=visible.findIndex(row=>row.id===anchor);
 if(!target||start<0)return {...state,boundary:null};
 const before={active:state.active,ids:[...state.ids],range:{...state.range,base:[...state.range.base]}};
 return {active:target,ids:mergeSelection(visible,contiguousSelection(visible,anchor,target),state.ids),range:{anchor,offset:visible.findIndex(row=>row.id===target)-start,base:[...state.ids]},boundary:{direction,before}};
}
