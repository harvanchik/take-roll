import {test} from 'node:test';
import assert from 'node:assert/strict';
import {statCountAt,STAT_COUNT_DURATION} from '../lib/stat-count.ts';
test('stat totals finish at five seconds regardless of magnitude',()=>{
 assert.equal(STAT_COUNT_DURATION,5000);
 for(const total of [0,6,8,258,255000,Number.MAX_SAFE_INTEGER]){assert.equal(statCountAt(total,0),0);assert.equal(statCountAt(total,-1),0);assert.equal(statCountAt(total,5000),total);assert.equal(statCountAt(total,6000),total);let previous=0;for(let ms=0;ms<=5000;ms+=10){const value=statCountAt(total,ms);assert.ok(value>=previous&&value<=total);previous=value;}}
});
test('the final second progressively slows without a jump at four seconds',()=>{
 const total=900000;
 assert.equal(statCountAt(total,1000),200000);assert.equal(statCountAt(total,2000),400000);assert.equal(statCountAt(total,4000),800000);
 const gains=[4000,4200,4400,4600,4800].map(ms=>statCountAt(total,ms+200)-statCountAt(total,ms));for(let i=1;i<gains.length;i++)assert.ok(gains[i]<gains[i-1]);assert.equal(statCountAt(total,4001)-statCountAt(total,4000),199);
});
