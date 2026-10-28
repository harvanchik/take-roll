import assert from 'node:assert/strict';
import {test} from 'node:test';
import {scrollbarGeometry,scrollbarPositionToScroll} from '../lib/overlay-scrollbar.ts';

test('overlay thumb follows document scrolling and dragging reaches either end',()=>{
 const start=scrollbarGeometry(800,2400,0),middle=scrollbarGeometry(800,2400,800),end=scrollbarGeometry(800,2400,1600);
 assert.equal(start.max,1600);assert.equal(start.offset,0);assert.equal(middle.offset,middle.travel/2);assert.equal(end.offset,end.travel);
 assert.equal(scrollbarPositionToScroll(0,end.travel,end.max),0);assert.equal(scrollbarPositionToScroll(end.travel,end.travel,end.max),1600);
 assert.equal(scrollbarPositionToScroll(-100,end.travel,end.max),0);assert.equal(scrollbarPositionToScroll(end.travel+100,end.travel,end.max),1600);
});
test('short or extremely long pages produce bounded geometry',()=>{
 assert.deepEqual(scrollbarGeometry(800,600,0),{max:0,thumb:800,travel:0,offset:0});
 const long=scrollbarGeometry(400,100000,999999);assert.equal(long.thumb,32);assert.equal(long.offset,long.travel);assert.ok(long.offset+long.thumb<=400);
 assert.equal(scrollbarPositionToScroll(10,0,0),0);
});
