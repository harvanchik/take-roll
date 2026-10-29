'use client';
import {useNamePreferences} from './name-preferences';
import {attendanceSegments} from '../lib/progress';
import {statusStyle} from './attendance-style';
import type {Event} from '../lib/model';

export default function AttendanceSegments({event,interactive=false}:{event:Event;interactive?:boolean}){
 const {attendance:config}=useNamePreferences();
 return <>{attendanceSegments(event,config).map(segment=><span key={segment.status} tabIndex={interactive&&segment.count?0:undefined} data-tooltip-color={interactive?'true':undefined} data-tooltip={interactive?`${segment.label} · ${segment.count} · ${Math.round(segment.percent)}%`:undefined} aria-label={`${segment.label}: ${segment.count}, ${Math.round(segment.percent)}%`} className={(interactive?'attendance-segment ':'')+segment.tone} style={{...statusStyle(segment.status,config),width:`${segment.percent}%`,background:'var(--tone)',height:'100%',flexShrink:0}}/>)}</>;
}
