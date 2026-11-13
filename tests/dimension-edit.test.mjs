import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {applyDrivingDimension}=require('../test-build/sketch-dimension-edit.cjs');
const mk=(kind,w,h=0)=>({dpi:25.4,items:[{id:'a',kind,x:0,y:0,w,h,construction:false}]});
for(const [kind,w,h,value] of [['line',10,0,25],['rect',10,5,30],['circle',10,0,15]]){
 test(`${kind}: updated dimension persists through solve`,()=>{
  const r=applyDrivingDimension(mk(kind,w,h),'a',value);
  assert.equal(r.ok,true,JSON.stringify(r));
  assert.equal(r.sketch.dimensions[0].valueMM,value);
  assert.ok(Math.abs(r.sketch.items[0].w-value)<1e-8);
 });
}
test('repeated edit replaces driving dimension instead of accumulating',()=>{
 const first=applyDrivingDimension(mk('rect',10,5),'a',20);
 assert.equal(first.ok,true);
 const next=applyDrivingDimension(first.sketch,'a',32);
 assert.equal(next.ok,true);
 assert.equal(next.sketch.dimensions.length,1);
 assert.equal(next.sketch.items[0].w,32);
});
test('fixed item cannot accept driving dimension; input remains unchanged',()=>{
 const original=mk('line',10);original.items[0].constraint='fixed';
 const r=applyDrivingDimension(original,'a',20);
 assert.equal(r.ok,false);
 assert.equal(original.items[0].w,10);
});
