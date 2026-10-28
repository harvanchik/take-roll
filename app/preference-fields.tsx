'use client';
import {useEffect,useId,useState,type ReactNode} from 'react';
import {displaySearchShortcut,recordSearchShortcut} from '../lib/search-shortcut';
import {timeZoneOffset} from '../lib/dates';
import Select from './select';
import InfoPopover from './info-popover';
import SettingsGroup from './settings-group';
import {type Preferences} from '../lib/workspace-settings';
export default function PreferenceFields({value:p,onChange,canHaptic,disabled}:{value:Required<Preferences>;onChange:(value:Required<Preferences>)=>void;canHaptic:boolean;disabled:boolean}){
 const [zones,setZones]=useState(['UTC','America/Chicago','America/New_York','America/Denver','America/Los_Angeles','Europe/London','Europe/Paris','Asia/Tokyo','Australia/Sydney']);
 useEffect(()=>{const api=Intl as typeof Intl&{supportedValuesOf?:(key:string)=>string[]};if(api.supportedValuesOf)setZones([...new Set(['UTC',...api.supportedValuesOf('timeZone')])]);},[]);
 const [offsets,setOffsets]=useState<Record<string,string>>({});
 useEffect(()=>{const at=new Date();setOffsets(Object.fromEntries([...new Set(['device',...zones,p.timeZone])].map(zone=>[zone,timeZoneOffset(zone,at)])));},[zones,p.timeZone]);
 const id=useId();
 const [mac,setMac]=useState(false);useEffect(()=>setMac(/Mac|iPhone|iPad/.test(navigator.platform)),[]);
 const help:Partial<Record<keyof Preferences,string>>={
 theme:'Choose a light or dark appearance. Device follows your system theme.',
 tableDensity:'Compact reduces table row spacing so more people fit on screen. Comfortable gives each row more room.',
 sidebarBehavior:'Choose how the sidebar opens when you enter the app. Remember Last State restores whether you left it expanded or collapsed. On small screens, it starts closed.',
 reduceMotion:'Reduce interface animations and transitions. Your device’s reduced-motion preference is also respected.',
 haptics:'Use vibration feedback for supported actions on devices that support haptics.',
 startingPage:'Choose the page shown when you enter the app. Last Visited Page returns to your most recent page. Direct links still open their requested page.',
 defaultEventView:'Choose whether events open in Roll Call for marking attendance or Attendance Overview for comparing subevents.',
 rememberFilters:'Remember searches, filters, and selected overview subevents in this browser for your account and workspace. Turning this off clears remembered filters for the current workspace.',
 showPersonIds:'Show each person’s seven-character ID beside their name in Roll Call. Click an ID to copy it. This does not change or create person identities.',
 timeZone:'Choose the time zone used to display saved timestamps, such as Last Changed. The UTC offset shown is current and includes daylight saving where applicable. Device uses your device’s time zone. Event calendar dates and stored timestamps stay unchanged.',
 autoSave:'Auto saves attendance changes as you make them. Manual keeps attendance changes pending until you use Save. Preferences still use the Save button at the top of Settings.',
 confirmBulkChanges:'Ask for confirmation before marking remaining attendance in bulk. Turning this off applies that action immediately. Destructive actions still keep their confirmation warnings.',
 shortcutHints:'Show keyboard shortcuts in supported tooltips and hints. Hiding the hints does not turn off the shortcuts.'
 };
 const field=(key:keyof Preferences,label:string,choices:Array<[string,ReactNode]>,value=String(p[key]),update=(value:string)=>onChange({...p,[key]:value}))=><div className="preference-field"><div className="preference-field-label"><label htmlFor={`${id}-${key}`} data-tooltip={key==='theme'&&p.shortcutHints?'Toggle Theme (Ctrl/Cmd + Shift + L)':undefined}>{label}</label>{help[key]&&<InfoPopover label={`About ${label}`}>{help[key]}</InfoPopover>}</div><Select id={`${id}-${key}`} aria-label={label} value={value} disabled={disabled} onValueChange={update}>{choices.map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select></div>;
 const select=(key:keyof Preferences,label:string,choices:Array<[string,ReactNode]>)=>field(key,label,choices);
 const boolean=(key:'reduceMotion'|'haptics'|'rememberFilters'|'showPersonIds'|'confirmBulkChanges'|'shortcutHints',label:string)=>field(key,label,[['true','On'],['false','Off']],String(p[key]),value=>onChange({...p,[key]:value==='true'}));
 return <fieldset className="settings-controls" disabled={disabled}>
 <SettingsGroup title="Appearance" open><div className="preference-fields">
 {select('theme','Theme',[['light','Light'],['dark','Dark'],['device','Device']])}
 {select('tableDensity','Table Density',[['comfortable','Comfortable'],['compact','Compact']])}
 {select('sidebarBehavior','Sidebar',[['remember','Remember Last State'],['expanded','Start Expanded'],['collapsed','Start Collapsed']])}
 {boolean('reduceMotion','Reduce Motion')}{canHaptic&&boolean('haptics','Enable Haptics')}
 </div></SettingsGroup>
 <SettingsGroup title="Navigation & Tables" open><div className="preference-fields">
 {select('startingPage','Starting Page',[['events','Events'],['rosters','Rosters'],['last','Last Visited Page']])}
 {select('defaultEventView','Default Event View',[['roll-call','Roll Call'],['overview','Attendance Overview']])}
 <div className="preference-field"><div className="preference-field-label"><label htmlFor={id+'-search-shortcut'}>App Search Shortcut</label><InfoPopover label="About App Search Shortcut">Click the field, then press your preferred keys with Ctrl/Cmd or Alt. Shift is optional.</InfoPopover></div><input id={id+'-search-shortcut'} data-shortcut-recorder readOnly aria-label="App Search Shortcut" value={displaySearchShortcut(p.globalSearchShortcut,mac)} onKeyDown={event=>{if(['Tab','Escape'].includes(event.key))return;event.preventDefault();event.stopPropagation();const shortcut=recordSearchShortcut(event);if(shortcut)onChange({...p,globalSearchShortcut:shortcut});}}/></div>
 {boolean('rememberFilters','Remember Search & Filters')}{boolean('showPersonIds','Show Person IDs In Roll Call')}
 </div></SettingsGroup>
 <SettingsGroup title="Dates & Time" open><div className="preference-fields">
 {select('dateFormat','Date Format',[['text','24 Oct 2026'],['mdy','10/24/2026'],['dmy','24/10/2026'],['iso','2026-10-24']])}
 {select('timeFormat','Time Format',[['12h','12-Hour'],['24h','24-Hour']])}
 {select('timeZone','Time Zone',[...new Set(['device',...zones,...(p.timeZone!=='device'?[p.timeZone]:[])])].map(zone=>[zone,<span className="time-zone-label" key={zone}>{zone==='device'?'Device':zone.replaceAll('_',' ')}{offsets[zone]&&<span className="time-zone-offset">{offsets[zone]}</span>}</span>]))}
 </div></SettingsGroup>
 <SettingsGroup title="Editing & Shortcuts" open><div className="preference-fields">
 {field('autoSave','Save Mode',[['auto','Auto'],['manual','Manual']],p.autoSave===false?'manual':'auto',value=>onChange({...p,autoSave:value==='auto'}))}
 {boolean('confirmBulkChanges','Confirm Bulk Attendance Changes')}{boolean('shortcutHints','Show Keyboard Shortcut Hints')}
 </div>{p.autoSave===false&&<p className="settings-hint">{p.shortcutHints?"Save with Ctrl/Cmd + S or the Save button.":"Use Save to apply pending attendance changes."}</p>}</SettingsGroup>
 </fieldset>;
}
