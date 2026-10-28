import {ArrowUp,ChevronDown} from 'lucide-react';
/** One persistent icon lets CSS animate both disclosure and sort direction changes. */
export default function DropdownArrow({size=14,variant='chevron',flipped}:{size?:number;variant?:'chevron'|'sort';flipped?:boolean}){
 const Icon=variant==='sort'?ArrowUp:ChevronDown;
 return <Icon size={size} className="dropdown-arrow" aria-hidden="true" data-flipped={flipped}/>;
}
