'use client';
import {Check,Flag} from 'lucide-react';
import {usePersonalPreferences} from './personal-preferences';
import {formatTimestamp} from '../lib/dates';
import {followupChangedAt} from '../lib/followup-time';
import type {Participant} from '../lib/model';
export default function ViewOnlyFollowup({person,className='',size=15}:{person:Participant;className?:string;size?:number}){
 const {timeZone}=usePersonalPreferences();if(!person.flag)return null;const label=person.flag==='flagged'?'Flagged':'Completed',at=followupChangedAt(person),tooltip=at?label+' on '+formatTimestamp(at,{timeZone,dateFormat:'text',timeFormat:'12h'}).replace(', ',' ')+'.':label+' — date unavailable';
 return <span className={'view-only-followup '+className} role="img" aria-label={tooltip} data-tooltip={tooltip} tabIndex={0}>{person.flag==='flagged'?<Flag size={size} fill="currentColor" aria-hidden="true"/>:<Check size={size} aria-hidden="true"/>}</span>;
}
