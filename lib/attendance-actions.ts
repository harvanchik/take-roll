import {effectiveEventSettings} from './event-settings.ts';
import {attendanceSettings,reasonFromStatus} from './attendance-settings';
import type {Data} from './model';
/** Deleted choices cannot return through old drafts, undo, redo or reconnects. */
export function usesRemovedChoice(data:Data,action:Record<string,any>):boolean{
 const c=attendanceSettings(effectiveEventSettings(data,data.events.find(e=>e.id===action.eventId)));
 const state=(a:Record<string,any>)=>{
  const reason=reasonFromStatus(a.status);
  return !!(a.status&&(reason?reason!=='unspecified'&&!c.excuses.some(e=>e.active&&e.id===reason):!c.statuses.some(s=>s.active&&s.id===a.status)))||!!(a.excuse&&a.excuse!=='unspecified'&&!c.excuses.some(e=>e.active&&e.id===a.excuse));
 };
 if(action.edit&&usesRemovedChoice(data,action.edit))return true;
 return state(action)||(Array.isArray(action.changes)&&action.changes.some(state));
}
