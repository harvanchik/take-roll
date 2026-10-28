'use client';
import {useDisplayDates} from './personal-preferences';
import {useId,useRef,useState} from 'react';
import {Popover} from '@base-ui/react/popover';
import {DayPicker} from 'react-day-picker';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import {calendarDate,calendarMonth,calendarValue} from '../lib/calendar-date';
import Select from './select';

const months=Array.from({length:12},(_,month)=>new Intl.DateTimeFormat('en-GB',{month:'long'}).format(new Date(2000,month,1)));
export default function DatePicker({label,value,onChange,placeholder='Select Date',min,max}:{label:string;value:string;onChange:(value:string)=>void;placeholder?:string;min?:string;max?:string}){
 const {formatDay,formatTimestamp}=useDisplayDates();
 const id=useId(),trigger=useRef<HTMLButtonElement>(null),[open,setOpen]=useState(false),[container,setContainer]=useState<HTMLElement|null>(null);
 const selected=calendarDate(value),minimum=min?calendarDate(min):undefined,maximum=max?calendarDate(max):undefined;
 const [month,setMonth]=useState(()=>selected??new Date());
 const today=new Date(),todayValue=calendarValue(today),todayDisabled=!!(min&&todayValue<min||max&&todayValue>max);
 const choose=(date:Date|undefined)=>{onChange(date?calendarValue(date):'');setOpen(false);};
 const years=Array.from({length:121},(_,index)=>month.getFullYear()-100+index).filter(year=>year>=1&&year<=9999);
 return <div className="date-picker-field"><label htmlFor={id}>{label}</label><Popover.Root modal={false} open={open} onOpenChange={next=>{if(next){setContainer(trigger.current?.closest('dialog')??null);let start=selected??today;if(minimum&&start<minimum)start=minimum;if(maximum&&start>maximum)start=maximum;setMonth(calendarMonth(start.getFullYear(),start.getMonth()));}setOpen(next);}}><Popover.Trigger ref={trigger} id={id} type="button" className={'date-picker-trigger'+(!value?' date-picker-empty':'')} aria-label={label+': '+(value?formatDay(value):placeholder)}><span>{value?formatDay(value):placeholder}</span><CalendarDays size={15} aria-hidden="true"/></Popover.Trigger><Popover.Portal container={container??undefined}><Popover.Positioner side="bottom" align="end" sideOffset={5} collisionPadding={8} className="date-picker-positioner"><Popover.Popup className="date-picker-popup" initialFocus={false}><Popover.Title className="sr-only">{label} Date</Popover.Title><div className="date-picker-heading"><button type="button" className="icon" aria-label="Previous Month" disabled={month.getFullYear()===1&&month.getMonth()===0} onClick={()=>setMonth(calendarMonth(month.getFullYear(),month.getMonth()-1))}><ChevronLeft size={16}/></button><Select value={month.getMonth()} aria-label="Calendar Month" onValueChange={value=>setMonth(calendarMonth(month.getFullYear(),Number(value)))}>{months.map((name,index)=><option key={name} value={index}>{name}</option>)}</Select><Select value={month.getFullYear()} aria-label="Calendar Year" onValueChange={value=>setMonth(calendarMonth(Number(value),month.getMonth()))}>{years.map(year=><option key={year} value={year}>{year}</option>)}</Select><button type="button" className="icon" aria-label="Next Month" disabled={month.getFullYear()===9999&&month.getMonth()===11} onClick={()=>setMonth(calendarMonth(month.getFullYear(),month.getMonth()+1))}><ChevronRight size={16}/></button></div><DayPicker className="app-calendar" mode="single" required selected={selected} onSelect={choose} month={month} onMonthChange={setMonth} hideNavigation showOutsideDays fixedWeeks autoFocus disabled={[...(minimum?[{before:minimum}]:[]),...(maximum?[{after:maximum}]:[])]}/><div className="date-picker-footer"><button type="button" className="text-button" onClick={()=>choose(undefined)}>Clear</button><button type="button" className="text-button" disabled={todayDisabled} onClick={()=>choose(today)}>Today</button></div></Popover.Popup></Popover.Positioner></Popover.Portal></Popover.Root></div>;
}
