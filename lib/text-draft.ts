export const NOTE_SETTLE_MS=1200;
/** One editing buffer; only a settled or explicitly committed value is saved. */
export class TextDraft{
 private value:string;private original:string;private timer:ReturnType<typeof setTimeout>|undefined;private composing=false;
 private save:(value:string,before:string)=>void;private changed:(value:string,dirty:boolean)=>void;private delay:number;private schedule:typeof setTimeout;private cancelTimer:typeof clearTimeout;
 constructor(value:string,save:(value:string,before:string)=>void,changed:(value:string,dirty:boolean)=>void,delay=NOTE_SETTLE_MS,schedule:typeof setTimeout=setTimeout,cancelTimer:typeof clearTimeout=clearTimeout){this.value=this.original=value;this.save=save;this.changed=changed;this.delay=delay;this.schedule=schedule;this.cancelTimer=cancelTimer;}
 get dirty(){return this.value!==this.original;}
 private clear(){if(this.timer!==undefined)this.cancelTimer.call(globalThis,this.timer);this.timer=undefined;}
 sync(value:string){if(this.dirty)return;this.value=this.original=value;this.changed(value,false);}
 update(value:string){this.clear();this.value=value;this.changed(value,this.dirty);if(this.dirty&&!this.composing)this.timer=this.schedule.call(globalThis,()=>this.flush(),this.delay);}
 composition(active:boolean){this.composing=active;this.clear();if(!active&&this.dirty)this.timer=this.schedule.call(globalThis,()=>this.flush(),this.delay);}
 flush(){this.clear();if(this.composing||!this.dirty)return;const before=this.original;this.original=this.value;this.changed(this.value,false);this.save(this.value,before);}
 reset(value:string){this.clear();this.composing=false;this.value=this.original=value;this.changed(value,false);}
}
