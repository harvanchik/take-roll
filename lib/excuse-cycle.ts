import type {Excuse} from './model.ts';
export const EXCUSE_SETTLE_MS=700;
export class ExcuseCycle{
 private draft:Excuse;private committed:Excuse;private dirty=false;private timer:ReturnType<typeof setTimeout>|undefined;
 private save:(value:Excuse)=>void;private changed:(value:Excuse)=>void;private schedule:typeof setTimeout;private cancel:typeof clearTimeout;
 constructor(value:Excuse,save:(value:Excuse)=>void,changed:(value:Excuse)=>void,schedule:typeof setTimeout=setTimeout,cancel:typeof clearTimeout=clearTimeout){this.draft=this.committed=value;this.save=save;this.changed=changed;this.schedule=schedule;this.cancel=cancel;}
 reset(value:Excuse){if(this.timer!==undefined)this.cancel.call(globalThis,this.timer);this.timer=undefined;this.dirty=false;this.draft=this.committed=value;this.changed(value);}
 sync(value:Excuse){if(this.dirty)return;this.draft=this.committed=value;this.changed(value);}
 cycle(choices:string[]=['work','academic','other']){this.draft=choices[choices.indexOf(this.draft??'')+1]??null;this.dirty=true;this.changed(this.draft);if(this.timer!==undefined)this.cancel.call(globalThis,this.timer);this.timer=this.schedule.call(globalThis,()=>this.flush(),EXCUSE_SETTLE_MS);}
 flush(){if(this.timer!==undefined)this.cancel.call(globalThis,this.timer);this.timer=undefined;if(!this.dirty)return;this.dirty=false;if(this.draft===this.committed)return;this.committed=this.draft;this.save(this.draft);}
}
