/** Keep local edits separate from their saved baseline and newest live value. */
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export class ValueDraft<T,S=T>{
 source:S;
 value:T;
 private latest:S;
 private normalize:(source:S)=>T;
 private saving?:{submitted:T};
 private preserveEdit=false;
 constructor(source:S,normalize:(source:S)=>T){
  this.source=this.latest=source;this.normalize=normalize;this.value=normalize(source);
 }
 get dirty(){return this.preserveEdit||!same(this.value,this.normalize(this.source))||!!this.saving&&!same(this.value,this.saving.submitted);}
 private adopt(source:S){this.source=source;this.value=this.normalize(source);this.preserveEdit=false;}
 sync(source:S){
  const previous=this.value,baseline=this.source,wasDirty=this.dirty;
  this.latest=source;
  const editedDuringSave=this.saving&&!same(this.value,this.saving.submitted);
  if(!editedDuringSave&&(!this.dirty||same(this.value,this.normalize(source))))this.adopt(source);
  return !same(previous,this.value)||!same(baseline,this.source)||wasDirty!==this.dirty;
 }
 update(value:T){
  this.value=value;
  // Reverting an ordinary draft adopts live updates that arrived while editing.
  if(!this.saving&&(!this.dirty||same(value,this.normalize(this.latest))))this.adopt(this.latest);
 }
 beginSave(){this.saving={submitted:this.value};}
 cancelSave(){
  // A lost response must not erase an intentional edit made after clicking Save.
  this.preserveEdit=!!this.saving&&!same(this.value,this.saving.submitted)&&!same(this.value,this.normalize(this.latest));
  this.saving=undefined;
  return this.sync(this.latest);
 }
 commit(submitted:T,source:S){
  const unchanged=same(this.value,submitted);
  this.saving=undefined;this.preserveEdit=false;this.source=this.latest=source;
  if(unchanged)this.value=this.normalize(source);
 }
}
