'use client';
import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
import {setTheme} from '../lib/theme';
export default function ThemeToggle(){
 const [dark,setDark]=useState(false);
 useEffect(()=>{const sync=()=>setDark(document.documentElement.dataset.theme==='dark');sync();window.addEventListener('theme:change',sync);return()=>window.removeEventListener('theme:change',sync);},[]);
 function toggle(){const next=document.documentElement.dataset.theme!=='dark';setDark(next);setTheme(next?'dark':'light');}
 return <div className="device-preferences"><button type="button" className="theme-toggle" onClick={toggle} aria-label="Dark Mode" aria-pressed={dark} data-tooltip={dark?'Light Mode':'Dark Mode'}>{dark?<Sun size={14}/>:<Moon size={14}/>}<span>{dark?'Light Mode':'Dark Mode'}</span></button></div>;
}
