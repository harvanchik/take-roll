type Roster={id:string;createdAt:string};
/** Pinned rosters lead; each group follows the personal order, then creation date. */
export function orderedRosters<T extends Roster>(rosters:T[],pinned:string[],order:string[]){
 const rank=new Map(order.map((id,index)=>[id,index])),pins=new Set(pinned);
 return [...rosters].sort((a,b)=>Number(pins.has(b.id))-Number(pins.has(a.id))||(rank.get(a.id)??Number.MAX_SAFE_INTEGER)-(rank.get(b.id)??Number.MAX_SAFE_INTEGER)||a.createdAt.localeCompare(b.createdAt));
}

/** Keep other workspaces' ordering when saving the current workspace's chips. */
export function mergeRosterOrder(localIds:string[],existingOrder:string[]){const current=new Set(localIds);return [...localIds,...existingOrder.filter(id=>!current.has(id))];}
