type Bounds={top:number;bottom:number};
/** Scroll the smallest distance that reveals a section; long sections show their heading. */
export function settingsRevealOffset(section:Bounds,viewport:Bounds):number{
 const height=section.bottom-section.top,available=viewport.bottom-viewport.top;
 if(available<=0||(section.top>=viewport.top&&section.bottom<=viewport.bottom))return 0;
 if(height>available)return section.top-viewport.top-12;
 const margin=Math.min(12,(available-height)/2);
 return section.top<viewport.top?section.top-viewport.top-margin:section.bottom-viewport.bottom+margin;
}
export function revealSettingsGroup(group:HTMLDetailsElement){
 const doc=group.ownerDocument,win=doc.defaultView;
 if(!win||!group.isConnected||!group.open||!group.getClientRects().length)return;
 let scroller:HTMLElement|null=null;
 for(let parent=group.parentElement;parent&&parent!==doc.body&&parent!==doc.documentElement;parent=parent.parentElement){
  if(/^(auto|scroll)$/.test(win.getComputedStyle(parent).overflowY)&&parent.scrollHeight>parent.clientHeight){scroller=parent;break;}
 }
 const top=win.visualViewport?.offsetTop??0,viewport={top,bottom:top+(win.visualViewport?.height??win.innerHeight)};
 if(scroller){const rect=scroller.getBoundingClientRect();viewport.top=Math.max(viewport.top,rect.top+scroller.clientTop);viewport.bottom=Math.min(viewport.bottom,rect.top+scroller.clientTop+scroller.clientHeight);}
 const header=group.closest('.settings-page')?.querySelector<HTMLElement>('.settings-sticky-header')?.getBoundingClientRect();
 if(header&&header.top<=viewport.top&&header.bottom>viewport.top)viewport.top=Math.min(header.bottom,viewport.bottom);
 // The organization Save bar can cover the bottom of the scrollable area.
 const footer=group.closest('form')?.querySelector<HTMLElement>(':scope > .settings-actions')?.getBoundingClientRect();
 if(footer&&footer.bottom>viewport.top&&footer.top<viewport.bottom&&footer.top>viewport.top)viewport.bottom=footer.top;
 const distance=settingsRevealOffset(group.getBoundingClientRect(),viewport);
 if(Math.abs(distance)<1)return;
 const options:ScrollToOptions={top:distance,behavior:(group.ownerDocument.documentElement?.dataset?.reduceMotion==='true'||win.matchMedia('(prefers-reduced-motion: reduce)').matches)?'auto':'smooth'};
 if(scroller)scroller.scrollBy(options);else win.scrollBy(options);
}
