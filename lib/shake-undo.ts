type Motion={x:number|null;y:number|null;z:number|null};
// Require repeated direction reversals, not a single bump or a change of angle.
export class ShakeDetector{
 private previous:Motion|null=null;
 private lastSample=0;
 private lastPeak=0;
 private cooldownUntil=0;
 private axis=-1;
 private sign=0;
 private peaks=0;
 reset(){this.previous=null;this.lastSample=0;this.lastPeak=0;this.axis=-1;this.sign=0;this.peaks=0;}
 sample(motion:Motion|null,now:number){
  if(!motion||[motion.x,motion.y,motion.z].some(n=>n===null||!Number.isFinite(n))){this.reset();return false;}
  const previous=this.previous;this.previous=motion;
  const gap=now-this.lastSample;this.lastSample=now;
  if(!previous||gap>300||now<this.cooldownUntil)return false;
  const delta=[motion.x!-previous.x!,motion.y!-previous.y!,motion.z!-previous.z!];
  const axis=delta.reduce((a,v,i)=>Math.abs(v)>Math.abs(delta[a])?i:a,0);
  if(Math.abs(delta[axis])<14)return false;
  if(now-this.lastPeak<65)return false;
  const sign=Math.sign(delta[axis]);
  if(now-this.lastPeak>650||axis!==this.axis)this.peaks=1;
  else if(sign!==this.sign)this.peaks++;
  this.axis=axis;this.sign=sign;this.lastPeak=now;
  if(this.peaks<3)return false;
  this.cooldownUntil=now+2200;this.reset();return true;
 }
}
