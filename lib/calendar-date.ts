/** Calendar dates stay local; converting through UTC can move a selected day. */
export function calendarDate(value:string):Date|undefined{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return;
 const [year,month,day]=value.split('-').map(Number),date=new Date(2000,month-1,day,12);
 date.setFullYear(year);
 if(year<1||date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day)return;
 return date;
}
export function calendarValue(date:Date):string{
 return `${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function calendarMonth(year:number,month:number):Date{
 const date=new Date(2000,month,1,12);date.setFullYear(year+(date.getFullYear()-2000));return date;
}
