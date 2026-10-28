'use client';
import {useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
/** Only make overflowing text a keyboard stop. */
export default function HorizontalScrollText({children,className,style,label}:{children:ReactNode;className?:string;style?:CSSProperties;label:string}){
 const ref=useRef<HTMLSpanElement>(null),[overflow,setOverflow]=useState(false);
 useLayoutEffect(()=>{const node=ref.current;if(!node)return;const measure=()=>setOverflow(node.scrollWidth>node.clientWidth+1);measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[children]);
 return <span ref={ref} className={className} style={style} tabIndex={overflow?0:undefined} aria-label={overflow?label:undefined}>{children}</span>;
}
