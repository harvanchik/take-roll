'use client';
import {useEffect} from 'react';
/** Do not show textarea scrollbars for subpixel rounding or an empty focused field. */
export default function TextareaOverflow(){
 useEffect(()=>{const fields=new Set<HTMLTextAreaElement>();let frame=0;
 const measure=(field:HTMLTextAreaElement)=>{if(!field.isConnected||!field.getClientRects().length)return;const top=field.scrollTop;field.style.overflowY='hidden';field.style.overflowX='hidden';if(field.scrollHeight>field.clientHeight+1)field.style.overflowY='auto';field.scrollTop=top;};
 const resize=new ResizeObserver(entries=>entries.forEach(entry=>measure(entry.target as HTMLTextAreaElement)));
 const scan=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{document.querySelectorAll('textarea').forEach(field=>{if(!fields.has(field)){fields.add(field);resize.observe(field);}measure(field);});for(const field of fields)if(!field.isConnected){resize.unobserve(field);fields.delete(field);}});};
 const edit=(event:Event)=>{if(event.target instanceof HTMLTextAreaElement)measure(event.target);};
 const observer=new MutationObserver(scan);observer.observe(document.body,{childList:true,subtree:true,characterData:true});document.addEventListener('input',edit);document.addEventListener('focusin',edit);document.fonts.ready.then(scan);scan();return()=>{observer.disconnect();resize.disconnect();cancelAnimationFrame(frame);document.removeEventListener('input',edit);document.removeEventListener('focusin',edit);};
 },[]);return null;
}
