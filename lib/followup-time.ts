import type {Participant} from './model.ts';
/** Only the latest flag transition can establish when the current state began. */
export function followupChangedAt(person:Pick<Participant,'flag'|'history'>):string|undefined{
 if(!person.flag)return;const last=[...(person.history??[])].reverse().find(entry=>entry.kind.replace(/^(Undo|Redo) · /,'')==='Flag');
 const label=person.flag==='flagged'?'Flagged':'Complete';if(!last||last.to!==label||!Number.isFinite(Date.parse(last.at)))return;return last.at;
}
