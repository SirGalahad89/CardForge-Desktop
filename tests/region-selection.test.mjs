import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {detectTopologyRegions,regionAtPoint}=require('../test-build/sketch-engine.cjs');
const line=(id,x,y,w,h)=>({id,kind:'line',x,y,w,h,construction:false});
const sq=(p,x,y,n)=>[line(p+'a',x,y,n,0),line(p+'b',x+n,y,0,n),line(p+'c',x+n,y+n,-n,0),line(p+'d',x,y+n,0,-n)];
test('click selects the correct one of adjacent faces',()=>{const items=[line('a',0,0,10,0),line('b',10,0,10,0),line('c',20,0,0,10),line('d',20,10,-10,0),line('e',10,10,-10,0),line('f',0,10,0,-10),line('g',10,0,0,10)];const faces=detectTopologyRegions({dpi:300,items});assert.equal(faces.length,2);assert.notEqual(regionAtPoint(faces,{x:5,y:5})?.id,regionAtPoint(faces,{x:15,y:5})?.id);assert.equal(regionAtPoint(faces,{x:25,y:5}),undefined);});
test('holes do not select the surrounding region',()=>{const faces=detectTopologyRegions({dpi:300,items:[...sq('outer',0,0,20),...sq('hole',5,5,10)]});assert.equal(regionAtPoint(faces,{x:2,y:2})?.id,faces[0].id);assert.equal(regionAtPoint(faces,{x:10,y:10}),undefined);});
