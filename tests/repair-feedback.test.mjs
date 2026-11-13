import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {repairFeedback}=require('../test-build/sketch-repair-feedback.cjs');
const line=(id,x,y,w,h)=>({id,kind:'line',x,y,w,h,construction:false});
const sk=items=>({items,dpi:300});
test('closed contour is reported after endpoint repair',()=>{
 const before=sk([line('a',0,0,10,0),line('b',10,0,0,10),line('c',10,10,-10,-9)]);
 const after=sk([line('a',0,0,10,0),line('b',10,0,0,10),line('c',10,10,-10,-10)]);
 const result=repairFeedback(before,after,.01);
 assert.equal(result.closed,true);assert.equal(result.openAfter,0);
});
test('remaining open ends are not called closed',()=>{
 const before=sk([line('a',0,0,10,0),line('b',10.5,0,0,10)]);
 const after=sk([line('a',0,0,10,0),line('b',10,0,0,10)]);
 const result=repairFeedback(before,after,.01);
 assert.equal(result.closed,false);assert.equal(result.openAfter,2);assert.equal(result.improved,true);
});
test('branch is never reported as closed',()=>{
 const before=sk([line('a',0,0,10,0),line('b',10,0,0,10),line('c',10,10,-10,-9),line('d',10,0,10,0)]);
 const after=sk([line('a',0,0,10,0),line('b',10,0,0,10),line('c',10,10,-10,-10),line('d',10,0,10,0)]);
 assert.equal(repairFeedback(before,after,.01).closed,false);
});
