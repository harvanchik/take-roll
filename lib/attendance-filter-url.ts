import type {PersonAttendanceFilter} from './person-attendance';
export const emptyAttendanceFilters=():PersonAttendanceFilter=>({from:'',to:'',roster:[],status:[],excuse:[],search:''});
export function readAttendanceFilters(query:string):PersonAttendanceFilter{
 const q=new URLSearchParams(query),date=(key:string)=>/^\d{4}-\d{2}-\d{2}$/.test(q.get(key)||'')?q.get(key)!:'';
 return {from:date('from'),to:date('to'),roster:q.getAll('roster'),status:q.getAll('status'),excuse:q.getAll('excuse'),search:q.get('search')||''};
}
export function writeAttendanceFilters(query:string,filters:PersonAttendanceFilter){
 const q=new URLSearchParams(query);
 for(const key of ['from','to','roster','status','excuse','search'] as const){q.delete(key);const value=filters[key];for(const item of Array.isArray(value)?value:[value])if(item)q.append(key,item);}
 return q.toString();
}

/** Remember the page and compared people, without persisting attendance filters. */
export function attendanceBookmarkPath(path:string){const [page,query='']=path.split('?');if(!/^\/(person\/|compare$)/.test(page))return path;const q=writeAttendanceFilters(query,emptyAttendanceFilters());return page+(q?'?'+q:'');}
