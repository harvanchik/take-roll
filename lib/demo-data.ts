import {withSlugs} from './navigation';
import {applyAction,personFromFields,type Data,type Participant} from './model';

// Illustrative attendance for retired hockey players, recreated for each mounted demo. Never read or persisted.
export function createDemoData(now=new Date()):Data{
 const date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 const season=now.getMonth()<6?'Spring':'Fall';
 const at=new Date(now.getFullYear(),now.getMonth(),now.getDate(),13).toISOString();
 const names=[['Wayne','Gretzky','WAYN','GRET-skee',''],['Mario','Lemieux','MAR-ee-oh','luh-MYOO',''],['Gordie','Howe','GOR-dee','HOW',''],['Bobby','Orr','BOB-ee','OR',''],['Mark','Messier','MARK','MESS-ee-ay',''],['Joe','Sakic','JOH','SAK-ik',''],['Teemu','Selänne','TAY-moo','seh-LAH-nee',''],['Nicklas','Lidström','NIK-las','LID-strum','']];
 const people=names.map(([firstName,lastName,firstPronunciation,lastPronunciation,preferredFirstName],i)=>personFromFields({firstName,lastName,firstPronunciation,lastPronunciation,preferredFirstName},'demo-person-'+i));
 const participants:Participant[]=people.map((p,i)=>({...p,status:i===7?null:i===1?'Bit Late':i===2?'Tardy':i===3?'Absent':'Present',excuse:i===1?'academic':i===3?'work':null,note:i===1?'Class ran late':i===2?'Follow up after training':i===3?'Shift at the library':'',flag:i===2?'flagged':null,updatedAt:i===7?null:at,removed:false,history:[]}));
 const parent={id:'demo-day-1',slug:'all-staff-training',subeventName:'Day 1',subeventSlug:'day-1',name:season+' All-Staff Training',date,rosterId:'demo-roster',rosterName:'Program Staff',note:'Training room · 6 PM',participants,createdAt:at,updatedAt:at,history:[]};
 return {rosters:[{id:'demo-roster',name:'Program Staff',people,createdAt:at,updatedAt:at}],events:[parent,{...parent,id:'demo-day-2',slug:undefined,parentEventId:parent.id,subeventName:'Day 2',subeventSlug:'day-2',date,participants:participants.map(p=>({...p,status:null,excuse:null,note:'',flag:null,updatedAt:null,history:[]}))}]};
}

export function applyDemoAction(data:Data,action:Record<string,unknown>):Data{
 const next=withSlugs(applyAction(data,action));
 for(const event of next.events){event.history=[];for(const person of event.participants)person.history=[];}
 return next;
}
