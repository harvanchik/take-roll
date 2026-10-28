import type {CSSProperties} from 'react';
import {tone,choiceColor,type AttendanceSettings} from '../lib/attendance-settings';
export const colorStyle=(color:string):CSSProperties=>({'--tone':tone(color)} as CSSProperties);
export const statusStyle=(id:string|null|undefined,c:AttendanceSettings):CSSProperties=>({'--tone':choiceColor(id,c)} as CSSProperties);
const iconInk=(color:string)=>['flag','check'].includes(color)?tone(color):`color-mix(in srgb,${tone(color)} var(--attendance-ink-share),#18212b)`;
export const flagStyle=(c:AttendanceSettings):CSSProperties=>({'--followup-red':iconInk(c.flagColor),'--followup-green':iconInk(c.checkColor)} as CSSProperties);
export function gradientStyle(colors:string[]):CSSProperties{
 const stops=(amount:string,base:string)=>(colors.length>1?colors:colors.length?[colors[0],colors[0]]:['gray','gray']).map(color=>`color-mix(in srgb,${tone(color)} ${amount},${base})`).join(',');
 return {'--attendance-fill':`linear-gradient(90deg,${stops('var(--gradient-fill)','var(--panel)')})`,'--attendance-edge':`linear-gradient(90deg,${stops('var(--gradient-edge)','var(--border)')})`,'--tone':tone(colors[0])} as CSSProperties;
}
