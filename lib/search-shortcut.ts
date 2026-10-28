export const DEFAULT_SEARCH_SHORTCUT='Mod+K';
type KeyInput={key:string;ctrlKey:boolean;metaKey:boolean;altKey:boolean;shiftKey:boolean};
const namedKeys=['Space','Plus','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown','Delete','Backspace','Insert'];
const validKey=(key:string)=>/^[A-Z0-9,./;\[\]\\'`=\-]$/.test(key)||/^F([1-9]|1[0-2])$/.test(key)||namedKeys.includes(key);
export function validSearchShortcut(value:unknown):value is string{if(typeof value!=='string')return false;const parts=value.split('+'),key=parts.pop()||'';return /^(Mod|Alt)(\+Alt)?(\+Shift)?$/.test(parts.join('+'))&&!value.startsWith('Alt+Alt')&&validKey(key);}
export function recordSearchShortcut(event:KeyInput):string|null{
 const key=event.key===' '?'Space':event.key==='+'?'Plus':event.key.length===1?event.key.toUpperCase():event.key;
 if(!validKey(key)||!(event.ctrlKey||event.metaKey||event.altKey))return null;
 return [(event.ctrlKey||event.metaKey)?'Mod':'Alt',...((event.ctrlKey||event.metaKey)&&event.altKey?['Alt']:[]),...(event.shiftKey?['Shift']:[]),key].join('+');
}
export function matchesSearchShortcut(event:KeyInput,value:string){return recordSearchShortcut(event)===value;}
export function displaySearchShortcut(value:string,mac=false){return value.replace('Mod',mac?'Cmd':'Ctrl').replaceAll('+',' + ');}
