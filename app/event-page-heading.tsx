'use client';
import type {ReactNode} from 'react';
import {ArrowLeft,Settings} from 'lucide-react';
export default function EventPageHeading({name,eyebrow,title,settings=false,testOnly=false,onNavigate}:{name:string;eyebrow:ReactNode;title?:ReactNode;settings?:boolean;testOnly?:boolean;onNavigate?:()=>void}){
 return <div className="page-heading event-heading event-page-heading"><div><div className="eyebrow">{eyebrow}</div><div className="event-title-line">{title??<h1 className="editable-event-title">{name}</h1>}{testOnly&&<span className="event-test-badge">TEST ONLY</span>}</div></div>{onNavigate&&<button type="button" className="small event-page-navigation" onClick={onNavigate}>{settings?<ArrowLeft size={15}/>:<Settings size={15}/>}<span>{settings?'Back To Event':'Event Settings'}</span></button>}</div>;
}
