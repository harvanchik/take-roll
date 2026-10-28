import {activeStatuses,swipeStatuses,type AttendanceSettings} from './attendance-settings.ts';
import {ValidationError} from './validation-error.ts';
export const SKIP_SWIPE='__skip__';
export type SwipeActions={left?:string;right?:string};
export function validateSwipeActions(input:unknown):SwipeActions{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>key!=='left'&&key!=='right'))throw new ValidationError('Choose Valid Mobile Swipe Actions.');
 const value=input as SwipeActions,out:SwipeActions={};
 for(const side of ['left','right'] as const){const id=value[side];if(id===undefined)continue;if(typeof id!=='string'||id!==''&&id!==SKIP_SWIPE&&!/^(Present|Bit Late|Tardy|Absent|status-[a-zA-Z0-9-]{1,64})$/.test(id))throw new ValidationError('Choose A Valid Swipe Action.');out[side]=id;}
 return out;
}
export function mobileSwipeActions(config:AttendanceSettings,choices:{left?:string;right?:string}={}){
 const defaults=swipeStatuses(config),statuses=activeStatuses(config),resolve=(side:'left'|'right')=>choices[side]===SKIP_SWIPE?{id:SKIP_SWIPE,name:'Skip'}:statuses.find(status=>status.id===choices[side])??defaults[side];
 return {left:resolve('left'),right:resolve('right')};
}
