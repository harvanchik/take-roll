export type PublicStats={organizations:number;rosters:number;events:number;attendance:number;absences:number;tardies:number;present:number};

// Aggregate inside the database: names, IDs, notes, and individual records never leave it.
// Join organizations to avoid counting legacy account stores copied into a workspace.
export const PUBLIC_STATS_SQL=`WITH stores AS (
 SELECT s.data FROM attendance_stores s JOIN organizations o ON o.id=s.user_id
 WHERE json_valid(s.data)
), events AS (
 SELECT e.value FROM stores s, json_each(s.data,'$.events') e
 WHERE COALESCE(json_extract(e.value,'$.subeventDeleted'),0)=0
 AND COALESCE((SELECT json_extract(root.value,'$.settings.testOnly') FROM json_each(s.data,'$.events') root WHERE json_extract(root.value,'$.id')=COALESCE(json_extract(e.value,'$.parentEventId'),json_extract(e.value,'$.id')) LIMIT 1),json_extract(e.value,'$.settings.testOnly'),0)=0
), marks AS (
 SELECT json_extract(p.value,'$.status') AS status FROM events e, json_each(e.value,'$.participants') p
 WHERE COALESCE(json_extract(p.value,'$.removed'),0)=0
)
SELECT
 (SELECT COUNT(*) FROM organizations) AS organizations,
 (SELECT COUNT(*) FROM stores s,json_each(s.data,'$.rosters')) AS rosters,
 (SELECT COUNT(DISTINCT COALESCE(json_extract(value,'$.parentEventId'),json_extract(value,'$.id'))) FROM events) AS events,
 (SELECT COUNT(*) FROM marks WHERE status IS NOT NULL AND status!='') AS attendance,
 (SELECT COUNT(*) FROM marks WHERE status='Absent') AS absences,
 (SELECT COUNT(*) FROM marks WHERE status='Tardy') AS tardies,
 (SELECT COUNT(*) FROM marks WHERE status='Present') AS present`;

export async function readPublicStats(db:D1Database):Promise<PublicStats>{
 const row=await db.prepare(PUBLIC_STATS_SQL).first<PublicStats>();
 if(!row)throw Error('Statistics Unavailable');
 // Explicit allowlist: future query fields must never silently become public.
 return {organizations:row.organizations,rosters:row.rosters,events:row.events,attendance:row.attendance,absences:row.absences,tardies:row.tardies,present:row.present};
}
