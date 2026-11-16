'use client';
import {useEffect,useState} from 'react';
import {Volume2} from 'lucide-react';
let speaking=false;const listeners=new Set<()=>void>();const notify=()=>listeners.forEach(fn=>fn());
export default function PronunciationAudio({text}:{text:string}){
 const [busy,setBusy]=useState(speaking),[voices,setVoices]=useState<SpeechSynthesisVoice[]>([]);
 useEffect(()=>{if(!('speechSynthesis' in window))return;const update=()=>setVoices(speechSynthesis.getVoices().filter(v=>v.localService));const changed=()=>setBusy(speaking);listeners.add(changed);update();speechSynthesis.addEventListener('voiceschanged',update);return()=>{listeners.delete(changed);speechSynthesis.removeEventListener('voiceschanged',update);};},[]);
 if(!text.trim())return null;
 const play=(event:React.MouseEvent)=>{event.preventDefault();event.stopPropagation();if(speaking||!voices.length)return;const speech=new SpeechSynthesisUtterance(text.replace(/[·|]/g,' ').replace(/[-‐]/g,'').toLocaleLowerCase());const score=(v:SpeechSynthesisVoice)=>(/^en/i.test(v.lang)?10:0)+(/natural|enhanced|premium/i.test(v.name)?5:0)+(v.default?1:0);speech.voice=[...voices].sort((a,b)=>score(b)-score(a))[0];speech.lang=speech.voice.lang;speech.rate=.85;let ended=false;let timeout:ReturnType<typeof setTimeout>|undefined;const finish=()=>{if(ended)return;ended=true;if(timeout)clearTimeout(timeout);speaking=false;notify();};speech.onend=finish;speech.onerror=finish;speaking=true;notify();try{speechSynthesis.speak(speech);timeout=setTimeout(()=>{speechSynthesis.cancel();finish();},30000);}catch{finish();}};
 return <button type="button" className="icon pronunciation-audio" aria-label="Hear Name Pronunciation" disabled={busy||!voices.length} data-tooltip={!voices.length?'No On-device Speech Voice Available':busy?'Reading Pronunciation':'Hear Name Pronunciation'} onPointerDown={e=>e.stopPropagation()} onClick={play}><Volume2 size={13}/></button>;
}
