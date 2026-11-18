'use client';
import {CalendarDays} from 'lucide-react';
import type {Event} from '../lib/model';
import {counts} from '../lib/model';
import {useDisplayDates} from './personal-preferences';
import AttendanceSegments from './attendance-segments';
export default function EventCardContent({event,summary,subevents,badge}:{event:Event;summary:Event;subevents:number;badge:string}){
 const {formatDay}=useDisplayDates(),stats=counts(summary),marked=stats.total-stats.unmarked;
 return <><div className="event-card-heading"><h3><CalendarDays size={20} aria-hidden="true"/><span className="event-card-title-text">{event.name}</span></h3><span className={'tag'+(badge==='Completed'?' complete':'')}>{badge}</span></div><p className="event-card-details"><time dateTime={event.date}>{formatDay(event.date)}</time> <span className="subevent-count-badge" data-tooltip={subevents+' Subevents'} aria-label={subevents+' Subevents'}>{subevents}</span><span> · </span>{event.rosterName}</p><div className="event-card-progress-row"><div className="card-progress segmented-progress"><AttendanceSegments event={summary}/></div><span>{stats.total?Math.round(marked/stats.total*100):100}% marked ({marked}/{stats.total})</span></div></>;
}
