import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {detectPlanarFaces,detectTopologyRegions}=require('../test-build/sketch-engine.cjs');
const line=(id,x,y,w,h,construction=false)=>({id,kind:'line',x,y,w,h,construction});
const sk=(items)=>({dpi:300,items});
const adjacent=[line('a',0,0,10,0),line('b',10,0,10,0),line('c',20,0,0,10),line('d',20,10,-10,0),line('e',10,10,-10,0),line('f',0,10,0,-10),line('g',10,0,0,10)];
test('two cells sharing one edge are both bounded faces',()=>{
 const faces=detectPlanarFaces(sk(adjacent));
 assert.equal(faces.length,2);assert.deepEqual(faces.map(f=>f.area).sort((a,b)=>a-b),[100,100]);
 assert.equal(detectTopologyRegions(sk(adjacent)).length,2);
});
test('branching open tail does not create an extra bounded face',()=>{
 const square=[line('a',0,0,10,0),line('b',10,0,0,10),line('c',10,10,-10,0),line('d',0,10,0,-10),line('tail',10,0,5,-5)];
 assert.equal(detectPlanarFaces(sk(square)).length,1);
});
test('crossing lines must be split before planar face extraction',()=>{
 assert.equal(detectPlanarFaces(sk([...adjacent,line('cross',0,0,20,10)])).length,0);
});
test('unsplit T junction is rejected',()=>{
 assert.equal(detectPlanarFaces(sk([line('a',0,0,20,0),line('b',10,0,0,10)])).length,0);
});
test('nested rings retain their hole semantics in topology regions',()=>{
 const sq=(p,x,y,n)=>[line(p+'a',x,y,n,0),line(p+'b',x+n,y,0,n),line(p+'c',x+n,y+n,-n,0),line(p+'d',x,y+n,0,-n)];
 const regions=detectTopologyRegions(sk([...sq('outer',0,0,20),...sq('inner',5,5,10)]));
 assert.equal(regions.length,1);assert.equal(regions[0].holes.length,1);assert.equal(regions[0].area,300);
});
