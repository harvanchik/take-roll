'use client';
import {useEffect,useState,useRef,type CSSProperties} from 'react';
import {Tabs} from '@base-ui/react/tabs';
import {Save,UserRound,Building2,SlidersHorizontal} from 'lucide-react';
import PreferenceFields from './preference-fields';
import SettingsGroup from './settings-group';
import RollCallSettingsFields from './roll-call-settings-fields';
import useValueDraft from './use-value-draft';
import LegalLinks from './legal-links';
import {type Data} from '../lib/model';
import {organizationSettings,defaultPreferences,profileName,purgeExpiredArchives,type Preferences,type ArchiveRetention} from '../lib/workspace-settings';
import {usesIosHapticTaps,hapticsEnabled,feedback} from '../lib/haptics';
import OrganizationMembers,{type SettingsAccount} from './organization-members';
export const RETENTION_OPTIONS:Array<{value:ArchiveRetention;label:string}>=[{value:'1d',label:'1 Day'},{value:'7d',label:'1 Week'},{value:'30d',label:'30 Days'},{value:'3m',label:'3 Months'},{value:'6m',label:'6 Months'}];
type Section='profile'|'preferences'|'organization';
const sections=[{id:'profile',label:'Profile',Icon:UserRound},{id:'preferences',label:'Preferences',Icon:SlidersHorizontal},{id:'organization',label:'Organization',Icon:Building2}] as const;
export default function SettingsPanel({data,account,busy,onAction,onDirtyChange,guest=false}:{data:Data;account:SettingsAccount;busy:boolean;guest?:boolean;onDirtyChange:(dirty:boolean)=>void;onAction:(action:Record<string,unknown>)=>Promise<unknown>}){
 const parts=(account.name||'').split(' '),admin=account.organizationRole!=='member';
 const profileDraft=useValueDraft(data.profile,value=>value||{firstName:parts[0]||'',lastName:parts.slice(1).join(' '),preferredName:''});
 const orgDraft=useValueDraft(data.organization,value=>organizationSettings(value));
 const preferenceDefaults=useRef({...defaultPreferences});
 const preferenceDraft=useValueDraft(data.preferences,value=>({...preferenceDefaults.current,...value}));
 const {value:profile,setValue:setProfile}=profileDraft,{value:org,setValue:setOrg}=orgDraft,{value:preferences,setValue:setPreferences}=preferenceDraft;
 const formRefs=useRef<Partial<Record<Section,HTMLFormElement>>>({}),savingRef=useRef(false),[saving,setSaving]=useState(false),[allSaved,setAllSaved]=useState(false);
 const [section,setSection]=useState<Section>('profile'),[canHaptic,setCanHaptic]=useState(false);
 const drafts={profile:profileDraft,preferences:preferenceDraft,organization:orgDraft};
 const guardedSave=async(action:Record<string,unknown>)=>{
  const field=action.type==='update-organization'?'organization':action.type==='update-profile'?'profile':'preferences';
  const submitted={profile,organization:org,preferences},source={profile:profileDraft.source,organization:orgDraft.source,preferences:preferenceDraft.source};
  const draft=drafts[field];draft.beginSave();
  const result=await onAction({...action,expected:JSON.stringify(source[field]??null)}) as Data|false;
  if(result){if(field==='organization')orgDraft.commit(submitted.organization,result.organization);else if(field==='profile')profileDraft.commit(submitted.profile,result.profile);else preferenceDraft.commit(submitted.preferences,result.preferences);}
  else draft.cancelSave();
  return result;
 };
 const dirty=profileDraft.dirty||orgDraft.dirty||preferenceDraft.dirty;
 const dirtyCallback=useRef(onDirtyChange);dirtyCallback.current=onDirtyChange;
 useEffect(()=>{dirtyCallback.current(dirty);return()=>dirtyCallback.current(false);},[dirty]);
 useEffect(()=>{if(!data.preferences){preferenceDefaults.current.haptics=hapticsEnabled();setPreferences(p=>({...p,haptics:preferenceDefaults.current.haptics}));}setCanHaptic(window.matchMedia('(any-pointer: coarse)').matches&&(/iPhone|iPod/.test(navigator.userAgent)||(!usesIosHapticTaps()&&typeof navigator.vibrate==='function')));},[]);
 const expired=data.events.filter(e=>!e.parentEventId).length-purgeExpiredArchives({...data,organization:org}).events.filter(e=>!e.parentEventId).length;
 const retentionIndex=Math.max(0,RETENTION_OPTIONS.findIndex(option=>option.value===org.archiveRetention));
 const changeRetention=(index:number)=>{const value=RETENTION_OPTIONS[index]?.value;if(value&&value!==org.archiveRetention){setOrg({...org,archiveRetention:value});feedback('selection');}};
 const saveAll=async()=>{
  if(busy||savingRef.current)return;
  const changed=sections.filter(({id})=>drafts[id].dirty&&(id!=='organization'||admin));
  for(const {id} of changed){const form=formRefs.current[id];if(form&&!form.checkValidity()){setSection(id);requestAnimationFrame(()=>form.reportValidity());return;}}
  savingRef.current=true;setSaving(true);setAllSaved(false);
  try{for(const {id} of changed){const action=id==='profile'?{type:'update-profile',profile}:id==='preferences'?{type:'update-preferences',preferences}:{type:'update-organization',organization:org};if(!await guardedSave(action))return;}setAllSaved(true);}finally{savingRef.current=false;setSaving(false);}
 };
 return <div className="settings-page">
  <Tabs.Root value={section} onValueChange={value=>setSection(value as Section)}>
   <header className="settings-sticky-header">
  <div className="page-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h1>Settings</h1></div></div>

   <div className="settings-tabs-row"><Tabs.List className="settings-tabs" aria-label="Settings Sections">{sections.map(({id,label,Icon})=><Tabs.Tab key={id} value={id} className="settings-tab"><Icon size={15} aria-hidden="true"/>{label}{drafts[id].dirty&&<><span className="settings-tab-unsaved" aria-hidden="true">*</span><span className="sr-only">Unsaved Changes</span></>}</Tabs.Tab>)}</Tabs.List><div className="settings-save-controls"><span role="status">{saving?"Saving…":dirty&&admin&&orgDraft.dirty&&expired?`${expired} Archived ${expired===1?"Event":"Events"} Will Be Deleted`:dirty?"Unsaved Changes":allSaved?"Saved.":""}</span><button type="button" className="primary settings-save-all" disabled={busy||saving||!dirty} onClick={()=>void saveAll()}><Save size={15}/>Save</button></div></div>
   </header>
   {/* Keep panels mounted: switching tabs never throws away a form or formatter draft. */}
   <Tabs.Panel value="profile" keepMounted className="settings-tab-panel personal-settings">
    <form ref={node=>{if(node)formRefs.current.profile=node;}} className="settings-card" onSubmit={e=>{e.preventDefault();void saveAll();}}>
     <h2>Profile</h2>
     <div className="settings-fields two"><label>First Name<input autoComplete="given-name" value={profile.firstName} maxLength={100} onChange={e=>setProfile({...profile,firstName:e.target.value})}/></label><label>Last Name<input autoComplete="family-name" value={profile.lastName} maxLength={100} onChange={e=>setProfile({...profile,lastName:e.target.value})}/></label></div>
     {!guest&&<div className="settings-fields two"><label>Preferred Name<input autoComplete="nickname" value={profile.preferredName} maxLength={100} onChange={e=>setProfile({...profile,preferredName:e.target.value})}/></label><label>Email<input type="email" value={account.email} readOnly/></label></div>}

    </form>
    <section className="settings-card legal-settings"><h2>Privacy & Legal</h2><LegalLinks/></section>
   </Tabs.Panel>
   <Tabs.Panel value="preferences" keepMounted className="settings-tab-panel personal-settings">
    <form ref={node=>{if(node)formRefs.current.preferences=node;}} className="settings-card" onSubmit={e=>{e.preventDefault();void saveAll();}}>
     <h2>Preferences</h2>
     <PreferenceFields value={preferences} onChange={setPreferences} canHaptic={canHaptic} disabled={busy||saving}/>
    </form>
   </Tabs.Panel>
   <Tabs.Panel value="organization" keepMounted className="settings-tab-panel">
    <form ref={node=>{if(node)formRefs.current.organization=node;}} className="settings-card organization-settings" onInvalidCapture={e=>{e.currentTarget.querySelectorAll<HTMLDetailsElement>('details.settings-group').forEach(group=>{if(group.contains(e.target as Node))group.open=true;});}} onSubmit={e=>{e.preventDefault();void saveAll();}}>
     <h2>Organization</h2>
     <fieldset className="settings-controls" disabled={!admin||busy||saving}>
      {!guest&&<label className="workspace-name-field">Organization Name<input value={org.name} maxLength={100} onChange={e=>setOrg({...org,name:e.target.value})}/></label>}
      <h2 className="settings-scope-title">Global Settings</h2><RollCallSettingsFields value={org} onChange={setOrg} disabled={!admin||busy||saving} beforePreview={<SettingsGroup title="Archived Records">
       <div className="retention-control"><div className="retention-heading"><label htmlFor="archive-retention">Keep Archived Records</label><output htmlFor="archive-retention">{RETENTION_OPTIONS[retentionIndex].label}</output></div><input id="archive-retention" className="retention-slider" type="range" min={0} max={4} step={1} value={retentionIndex} aria-valuetext={RETENTION_OPTIONS[retentionIndex].label} style={{'--range-progress':(retentionIndex/4*100)+'%'} as CSSProperties} onChange={e=>changeRetention(Number(e.target.value))}/><div className="retention-ticks">{RETENTION_OPTIONS.map((option,index)=><button type="button" key={option.value} aria-pressed={index===retentionIndex} onClick={()=>changeRetention(index)}>{option.label}</button>)}</div></div>
       <p className="settings-hint">Expired archived records are permanently deleted.</p>
      </SettingsGroup>}/>

     </fieldset>
     {admin&&expired>0&&<p className="settings-expiry" role="status">{expired} Archived {expired===1?'Event':'Events'} Will Be Permanently Deleted.</p>}
     {!admin&&<p className="settings-hint">Managed By The Workspace Owner.</p>}
    </form>
    {guest?<p className="settings-hint">Browser-only workspace. Sign in to use shared workspaces and live collaboration.</p>:admin&&account.id&&<OrganizationMembers enabled={section==='organization'} account={account} name={profileName(data.profile,account.name||'You')} busy={busy}/>}
   </Tabs.Panel>
  </Tabs.Root>
 </div>;
}
