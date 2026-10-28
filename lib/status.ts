export const STATUSES=['Present','Bit Late','Tardy','Absent','Excused (work)','Excused (Academic)','Excused (Other)'] as const;
export type Status=string;
export function renameStatusText(value:string):string{return value==='N/A'?'Unmarked':value.replace(/^Exempt\b/,'Excused');}
