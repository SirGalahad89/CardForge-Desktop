import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {detectTopologyRegions,regionAtPoint}=require('../test-build/sketch-engine.cjs');
const rect=(id,x,y,w,h,construction=false)=>({id,kind:'rect',x,y,w,h,construction});
const sk=items=>({dpi:96,items});
test('native rectangle creates a selectable closed region',()=>{
 const regions=detectTopologyRegions(sk([rect('a',10,20,40,30)]));
 assert.equal(regions.length,1);assert.equal(regions[0].id,'rect:a');assert.equal(regions[0].area,1200);
 assert.equal(regionAtPoint(regions,{x:20,y:30})?.id,'rect:a');
});
test('negative rectangle dimensions normalize correctly',()=>{
 const regions=detectTopologyRegions(sk([rect('a',50,50,-40,-30)]));
 assert.equal(regions[0].area,1200);assert.equal(regionAtPoint(regions,{x:20,y:30})?.id,'rect:a');
});
test('two overlapping native rectangles remain separately selectable',()=>{
 const regions=detectTopologyRegions(sk([rect('a',0,0,50,50),rect('b',25,25,50,50)]));
 assert.deepEqual(regions.map(r=>r.id),['rect:a','rect:b']);
});
test('construction and zero-area rectangles do not create profiles',()=>{
 assert.equal(detectTopologyRegions(sk([rect('a',0,0,50,50,true),rect('b',0,0,0,50)])).length,0);
});
test('native rectangle and closed line loop coexist',()=>{
 const lines=[[0,0,20,0],[20,0,0,20],[20,20,-20,0],[0,20,0,-20]].map(([x,y,w,h],i)=>({id:'l'+i,kind:'line',x,y,w,h,construction:false}));
 const regions=detectTopologyRegions(sk([...lines,rect('a',30,0,20,20)]));
 assert.equal(regions.length,2);
});
