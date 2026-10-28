'use client';
import type {ReactNode} from 'react';
import DropdownArrow from './dropdown-arrow';
import Select from './select';
import {defaultSort,SORT_CRITERIA} from '../lib/default-sort';
import NameFormatEditor from './name-format-editor';
import SettingsGroup from './settings-group';
import AttendanceSettingsEditor from './attendance-settings-editor';
import {attendanceSettings,activeStatuses} from '../lib/attendance-settings';
import {mobileSwipeActions,SKIP_SWIPE} from '../lib/mobile-swipe-actions';
import type {OrganizationSettings} from '../lib/workspace-settings';

/** Roll-call configuration stays separate from workspace identity, retention and members. */
export default function RollCallSettingsFields({value,onChange,disabled,scope='global',beforePreview}:{beforePreview?:ReactNode;value:OrganizationSettings;onChange:(value:OrganizationSettings)=>void;disabled:boolean;scope?:'global'|'event'}){
 const sorting=defaultSort(value);
 const attendance=attendanceSettings(value),editor=(section:'statuses'|'display'|'preview')=><AttendanceSettingsEditor section={section} disabled={disabled} scope={scope} organization={value} displayControls={<label className="settings-check"><input type="checkbox" checked={value.showPronunciation} disabled={disabled} onChange={e=>onChange({...value,showPronunciation:e.target.checked})}/>Show Name Pronunciation In Roll Call</label>} value={attendance} onChange={attendance=>onChange({...value,attendance})}/>;
 return <div className="roll-call-settings-sections">
  <SettingsGroup title="Names & Sorting" open>
   <div className="name-settings-fields"><NameFormatEditor disabled={disabled} value={value.nameDisplay} onChange={nameDisplay=>onChange({...value,nameDisplay})}/>
   <div className="default-sort-field"><label htmlFor={scope+'-default-sort'}>Default Sort</label><div className="default-sort-controls"><Select id={scope+'-default-sort'} disabled={disabled} value={sorting.key} onValueChange={key=>onChange({...value,defaultSort:{...sorting,key}})}>{SORT_CRITERIA.map(key=><option key={key} value={key}>{key==='#'?'Row Number':key}</option>)}{activeStatuses(attendanceSettings(value)).map(status=><option key={status.id} value={'status:'+status.id}>{status.name} Count</option>)}</Select><button type="button" disabled={disabled} className="sort-direction" aria-label={'Default Sort Direction: '+sorting.direction.toUpperCase()} onClick={()=>onChange({...value,defaultSort:{...sorting,direction:sorting.direction==='asc'?'desc':'asc'}})}><DropdownArrow variant="sort" flipped={sorting.direction==='desc'} size={15}/><span>{sorting.direction.toUpperCase()}</span></button></div></div>
   </div>
  </SettingsGroup>
  {editor('statuses')}{editor('display')}
  <SettingsGroup title="Mobile" open><div className="settings-fields two mobile-swipe-settings">{(['left','right'] as const).map(side=>{
   const saved=value.mobileSwipe?.[side]??'',available=saved===SKIP_SWIPE||activeStatuses(attendance).some(status=>status.id===saved),automatic=mobileSwipeActions(attendance)[side];
   return <label key={side} htmlFor={scope+'-swipe-'+side}>{side==='left'?'Swipe Left':'Swipe Right'}<Select id={scope+'-swipe-'+side} aria-label={side==='left'?'Default Swipe Left Action':'Default Swipe Right Action'} disabled={disabled} value={available?saved:''} onValueChange={action=>onChange({...value,mobileSwipe:{...value.mobileSwipe,[side]:action}})}><option value="">Default{automatic?' ('+automatic.name+')':''}</option>{activeStatuses(attendance).map(status=><option key={status.id} value={status.id}>{status.name}</option>)}<option value={SKIP_SWIPE}>Skip</option></Select></label>;
  })}</div><p className="settings-hint">Changes made on a swipe card last until refresh.</p></SettingsGroup>
  {beforePreview}{editor('preview')}</div>;
}
