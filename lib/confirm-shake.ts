export function confirmShakeHistory({canUndo,canRedo,confirm,undo,redo}:{canUndo:boolean;canRedo:boolean;confirm:(message:string)=>boolean;undo:()=>void;redo:()=>void}){
 const direction=canUndo?'Undo':canRedo?'Redo':null;
 if(!direction||!confirm(direction+' the Last Take Roll Change?'))return false;
 if(direction==='Undo')undo();else redo();
 return true;
}
