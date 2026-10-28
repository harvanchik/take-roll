/** Right-align when possible, then shift, flip and constrain to the visible viewport. */
export function menuPlacement(anchor:{left:number;right:number;top:number;bottom:number},size:{width:number;height:number},viewport:{left:number;top:number;width:number;height:number},padding=8,gap=4){
 const left=viewport.left+padding,right=viewport.left+viewport.width-padding,top=viewport.top+padding,bottom=viewport.top+viewport.height-padding;
 const width=Math.max(0,Math.min(size.width,right-left)),below=Math.max(0,bottom-Math.max(top,anchor.bottom)-gap),above=Math.max(0,Math.min(bottom,anchor.top)-gap-top),flip=size.height>below&&above>below,maxHeight=flip?above:below,height=Math.min(size.height,maxHeight);
 return {left:Math.max(left,Math.min(anchor.right-width,right-width)),top:Math.max(top,Math.min(flip?anchor.top-gap-height:anchor.bottom+gap,bottom-height)),width,maxHeight};
}
