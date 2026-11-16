'use client';
import {useEffect,useState} from 'react';
export default function SettingsValidation(){
 const [error,setError]=useState('');
 useEffect(()=>{let showing=false;
 const invalid=(e:Event)=>{const input=e.target;if(!(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement)||!input.closest('.settings-page'))return;e.preventDefault();input.classList.add('validation-error');input.setAttribute('aria-invalid','true');if(showing)return;showing=true;setTimeout(()=>showing=false,100);input.closest('details')?.setAttribute('open','');const label=input.getAttribute('aria-label')||input.closest('label')?.querySelector('span')?.textContent||'This field';setError(label.startsWith('Short Label')?'Enter a unique short label for this excuse.':label+': '+(input.validity.valueMissing?'enter a value.':'check this value.'));requestAnimationFrame(()=>{input.scrollIntoView({block:'center',behavior:'smooth'});input.focus({preventScroll:true});});};
 const clear=(e:Event)=>{const input=e.target;if(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement){input.classList.remove('validation-error');input.removeAttribute('aria-invalid');setError('');}};
 document.addEventListener('invalid',invalid,true);document.addEventListener('input',clear);return()=>{document.removeEventListener('invalid',invalid,true);document.removeEventListener('input',clear);};},[]);
 return error?<div className="save-dock save-error" role="alert"><span className="status-dot bad"/><span>{error}</span><button className="icon" aria-label="Dismiss Error" onClick={()=>setError('')}>×</button></div>:null;
}
