import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {connectSnappedEndpoints}=require('../test-build/sketch-auto-nodes.cjs');
const line=(id,x,y,w,h)=>({id,kind:'line',x,y,w,h,construction:false});
test('new snapped line creates shared CAD node',()=>{
 const s={dpi:300,items:[line('a',0,0,10,0),line('b',10,0,5,5)]};
 const out=connectSnappedEndpoints(s,'b',{sourceId:'a',sourceEnd:1},null);
 assert.equal(out.nodes.length,1);assert.equal(out.nodes[0].members.length,2);
});
test('snapping to existing node attaches member rather than duplicate node',()=>{
 const s={dpi:300,items:[line('a',0,0,10,0),line('b',10,0,5,5)],nodes:[{id:'n',x:10,y:0,members:[{itemId:'a',end:1}]}]};
 const out=connectSnappedEndpoints(s,'b',{nodeId:'n'},null);
 assert.equal(out.nodes.length,1);assert.equal(out.nodes[0].members.length,2);
});
test('snapping both endpoints creates two nodes',()=>{
 const s={dpi:300,items:[line('a',0,0,10,0),line('c',20,0,10,0),line('b',10,0,10,0)]};
 const out=connectSnappedEndpoints(s,'b',{sourceId:'a',sourceEnd:1},{sourceId:'c',sourceEnd:0});
 assert.equal(out.nodes.length,2);
});
