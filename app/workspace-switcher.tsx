'use client';
import {guestPath} from '../lib/guest-store';
import Select from './select';
import Modal from './modal';
import {useEffect,useRef,useState} from 'react';
import {Building2,Plus,Settings2,ArrowRightLeft,LogOut,Trash2} from 'lucide-react';
import type {SettingsAccount} from './organization-members';
import type {WorkspaceChoice} from '../lib/organizations';

type Payload={workspaces:WorkspaceChoice[];workspaceId?:string;members?:Member[];error?:string};
type Member={id:string;email:string;joined:boolean};
type Choice={workspace:WorkspaceChoice;kind:'leave'|'delete'|'transfer'};
export const workspacePath=(path:string,id?:string)=>id==='browser-guest'?guestPath(path):path+(id?'?workspace='+encodeURIComponent(id):'');
export default function WorkspaceSwitcher({account,busy,ready,currentName,onOpen=(path:string)=>window.location.assign(path)}:{onOpen?:(path:string)=>void;account:SettingsAccount;busy:boolean;ready:()=>boolean;currentName?:string}){
 const [workspaces,setWorkspaces]=useState(account.workspaces||[]),[name,setName]=useState(''),[working,setWorking]=useState(false),[error,setError]=useState('');
 const [choice,setChoice]=useState<Choice|null>(null),[members,setMembers]=useState<Member[]>([]),[memberId,setMemberId]=useState(''),[confirmation,setConfirmation]=useState('');
 const [opened,setOpened]=useState(false),request=useRef(0);
 useEffect(()=>{setWorkspaces(account.workspaces||[]);},[account.workspaces]);
 useEffect(()=>()=>{request.current++;},[]);
 const refresh=async()=>{try{const response=await fetch('/api/workspaces',{cache:'no-store'});const payload=await response.json() as Payload;if(!response.ok)throw Error(payload.error||'Could Not Load Workspaces.');setWorkspaces(payload.workspaces);}catch(e){setError(e instanceof Error?e.message:'Could Not Load Workspaces.');}};
 const open=()=>{setChoice(null);setError('');setOpened(true);void refresh();};
 const choose=async(workspace:WorkspaceChoice,kind:Choice['kind'])=>{
  const generation=++request.current;setChoice({workspace,kind});setError('');setConfirmation('');setMembers([]);setMemberId('');
  if(kind==='transfer')try{const response=await fetch(workspacePath('/api/organization',workspace.id),{cache:'no-store'});const payload=await response.json() as Payload;if(generation!==request.current)return;if(!response.ok)throw Error(payload.error||'Could Not Load Members.');const joined=(payload.members||[]).filter(member=>member.joined);setMembers(joined);setMemberId(joined[0]?.id||'');}catch(e){if(generation===request.current)setError(e instanceof Error?e.message:'Could Not Load Members.');}
 };
 const change=async(type:string)=>{
  if(working||busy)return;if(!ready()){setError('Save Or Discard Unsaved Changes First.');return;}setWorking(true);setError('');
  try{
   const response=await fetch('/api/workspaces',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId:account.id,workspaceId:choice?.workspace.id,revision:0,action:{type,name,memberId,confirmation}})});
   const payload=await response.json() as Payload;if(!response.ok)throw Error(payload.error||'Could Not Update Workspaces.');setWorkspaces(payload.workspaces);setName('');setChoice(null);
   if(payload.workspaceId)onOpen(workspacePath('/events',payload.workspaceId));
   else if(choice?.workspace.id===account.workspaceId){onOpen(workspacePath('/events',payload.workspaces.some((item:WorkspaceChoice)=>item.id===account.workspaceId)?account.workspaceId:payload.workspaces[0]?.id));}
  }catch(e){setError(e instanceof Error?e.message:'Could Not Update Workspaces.');}finally{setWorking(false);}
 };
 const current=workspaces.find(item=>item.id===account.workspaceId);
 return <><button type="button" className="workspace-switcher" aria-label="Manage Workspaces" onClick={open}><span><small>Workspace</small><strong>{currentName||current?.name||'Choose A Workspace'}</strong></span><Settings2 size={16}/></button>
 {opened&&<Modal dirty={!!(name||confirmation||memberId&&memberId!==(members[0]?.id||''))} title="Workspaces" icon={<Building2 size={20}/>} className="workspace-dialog" close={()=>{request.current++;setOpened(false);setChoice(null);}}>
 <div className="workspace-list">{workspaces.map(item=><div className="workspace-option" key={item.id}><div><strong>{item.name}</strong><small>{item.role==='admin'?'Owner':'Member'}{item.id===account.workspaceId?' · Current':''}</small></div><div className="workspace-option-actions">{item.id!==account.workspaceId&&<button type="button" className="small" disabled={working||busy} onClick={()=>onOpen(workspacePath('/events',item.id))}>Open</button>}{item.role==='admin'?<><button type="button" className="icon" title="Transfer Ownership" aria-label={'Transfer Ownership Of '+item.name} disabled={working||busy} onClick={()=>void choose(item,'transfer')}><ArrowRightLeft size={16}/></button><button type="button" className="icon danger" title="Delete Workspace" aria-label={'Delete '+item.name} disabled={working||busy} onClick={()=>void choose(item,'delete')}><Trash2 size={16}/></button></>:<button type="button" className="icon" title="Leave Workspace" aria-label={'Leave '+item.name} disabled={working||busy} onClick={()=>void choose(item,'leave')}><LogOut size={16}/></button>}</div></div>)}</div>
 {choice&&<form className="workspace-confirm" onSubmit={e=>{e.preventDefault();void change(choice.kind+'-workspace');}}><strong>{choice.kind==='delete'?'Delete':choice.kind==='leave'?'Leave':'Transfer'} {choice.workspace.name}?</strong>{choice.kind==='delete'?<><p>All rosters, events, history, and invitations will be permanently deleted. This cannot be undone.</p><label>Type DELETE<input value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" required pattern="DELETE" disabled={working}/></label></>:choice.kind==='leave'?<p>You’ll need a new invitation to return. Your past changes keep your last display name.</p>:<><p>The new owner controls settings and members. You’ll remain a member.</p><label>New Owner<Select value={memberId} required disabled={working||!members.length} onValueChange={value=>setMemberId(value)}><option value="" disabled>Choose A Joined Member</option>{members.map(member=><option key={member.id} value={member.id}>{member.email}</option>)}</Select></label>{!members.length&&<p>Invite a member and have them sign in first.</p>}</>}<div className="workspace-confirm-actions"><button type="button" className="small" disabled={working} onClick={()=>{request.current++;setChoice(null);}}>Cancel</button><button className={choice.kind==='transfer'?'primary small':'danger small'} disabled={working||busy||(choice.kind==='delete'&&confirmation!=='DELETE')||(choice.kind==='transfer'&&!memberId)}>{choice.kind==='delete'?'Delete Permanently':choice.kind==='leave'?'Leave Workspace':'Transfer Ownership'}</button></div></form>}
 {!choice&&<form className="workspace-create" onSubmit={e=>{e.preventDefault();void change('create-workspace');}}><label>New Workspace<input value={name} maxLength={100} required placeholder="Workspace Name" disabled={working||busy} onChange={e=>setName(e.target.value)}/></label><button className="primary" disabled={working||busy||!name.trim()}><Plus size={16}/>Create</button></form>}{error&&<p className="form-error" role="alert">{error}</p>}
 </Modal>}</>;
}
