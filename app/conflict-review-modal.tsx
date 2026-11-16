'use client';
import {useState} from 'react';
import Modal from './modal';
import {conflictDifferences,type ConflictReview} from '../lib/conflict-review';
import {useDisplayDates} from './personal-preferences';
export default function ConflictReviewModal({conflicts,busy,onResolve,close}:{conflicts:ConflictReview[];busy:boolean;onResolve:(id:string,mine:boolean)=>void;close:()=>void}){
 const [index,setIndex]=useState(0),{formatTimestamp}=useDisplayDates(),item=conflicts[Math.min(index,conflicts.length-1)];
 if(!item)return null;
 const differences=conflictDifferences(item.mine,item.theirs);
 return <Modal title={conflicts.length>1?'View Conflicts':'View Conflict'} className="conflict-review-modal" close={close} dirty={false}><div className="conflict-review-heading"><strong>{item.title}</strong>{conflicts.length>1&&<span>{Math.min(index+1,conflicts.length)} of {conflicts.length}</span>}</div><div className="conflict-review-scroll"><table className="conflict-review-table"><thead><tr><th>Field</th><th>Mine<small>{item.mineAt?formatTimestamp(item.mineAt):'Time unavailable'}</small></th><th>Theirs<small>{item.theirsAt?formatTimestamp(item.theirsAt):'Time unavailable'}</small></th></tr></thead><tbody>{differences.map((diff,i)=><tr key={i}><th>{diff.field}</th><td>{diff.mine}</td><td>{diff.theirs}</td></tr>)}{!differences.length&&<tr><td colSpan={3}>These values now match. Keep mine to retry, or discard this waiting edit.</td></tr>}</tbody></table></div><div className="modal-footer"><button disabled={!index||busy} onClick={()=>setIndex(i=>i-1)}>Previous</button><button disabled={index>=conflicts.length-1||busy} onClick={()=>setIndex(i=>i+1)}>Next</button><button disabled={busy} onClick={()=>onResolve(item.id,false)}>Discard Mine</button><button className="primary" disabled={busy} onClick={()=>onResolve(item.id,true)}>Keep Mine</button></div></Modal>;
}
