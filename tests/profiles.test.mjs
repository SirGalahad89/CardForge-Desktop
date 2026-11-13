import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {detectClosedProfiles}=require('../test-build/sketch-engine.cjs');
const line=(id,x,y,w,h,construction=false)=>({id,kind:'line',x,y,w,h,construction});
test('closed square produces one profile with area 100',()=>{
 const s={dpi:300,items:[line('a',0,0,10,0),line('b',10,0,0,10),line('c',10,10,-10,0),line('d',0,10,0,-10)]};
 assert.equal(detectClosedProfiles(s).length,1);assert.equal(detectClosedProfiles(s)[0].area,100);
});
test('open and construction-only loops are ignored',()=>{
 const s={dpi:300,items:[line('a',0,0,10,0),line('b',10,0,0,10),line('c',10,10,-10,0),line('d',0,10,0,-10,true)]};
 assert.equal(detectClosedProfiles(s).length,0);
});
test('self crossing loop is ignored',()=>{
 const s={dpi:300,items:[line('a',0,0,10,10),line('b',10,10,-10,0),line('c',0,10,10,-10),line('d',10,0,-10,0)]};
 assert.equal(detectClosedProfiles(s).length,0);
});
const {detectProfileRegions}=require('../test-build/sketch-engine.cjs');
const square=(prefix,x,y,size)=>[line(prefix+'a',x,y,size,0),line(prefix+'b',x+size,y,0,size),line(prefix+'c',x+size,y+size,-size,0),line(prefix+'d',x,y+size,0,-size)];
test('nested loop produces one region with a hole and net area',()=>{
 const sk={dpi:300,items:[...square('outer',0,0,20),...square('inner',5,5,10)]};
 const regions=detectProfileRegions(sk);
 assert.equal(regions.length,1);assert.equal(regions[0].holes.length,1);assert.equal(regions[0].area,300);
});
test('two separate loops produce two selectable regions',()=>{
 const regions=detectProfileRegions({dpi:300,items:[...square('one',0,0,10),...square('two',20,0,10)]});
 assert.equal(regions.length,2);assert.equal(regions.reduce((a,r)=>a+r.area,0),200);
});
test('three nested loops preserve island as separate region',()=>{
 const regions=detectProfileRegions({dpi:300,items:[...square('a',0,0,30),...square('b',5,5,20),...square('c',10,10,10)]});
 assert.equal(regions.length,2);assert.equal(regions.reduce((a,r)=>a+r.area,0),600);
});
