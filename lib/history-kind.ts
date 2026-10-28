/** Operation and change type are displayed separately; persisted audit kinds stay unchanged. */
export function historyOperation(kind:string){return kind.match(/^(Undo|Redo) · /)?.[1];}
export function historyKindLabel(kind:string){
 const type=kind.replace(/^(Undo|Redo) · /,'');
 if(/^Subevent(?: Created| Name| Renamed| Deleted)?$/i.test(type))return 'Subevent';
 if(/^Event(?: Created| Name| Renamed| Deleted| Settings)?$/i.test(type))return 'Event';
 return type==='Status'?'Attendance':type.replace(/\bMembership\b/g,'Roster');
}
