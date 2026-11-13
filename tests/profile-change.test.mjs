import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {profileChangeFeedback}=require('../test-build/sketch-profile-change.cjs');
const line=(id,x,y,w,h)=>({id,kind:'line',x,y,w,h,construction:false});
const sketch=items=>({items,dpi:300});
const almost=sketch([line('a',0,0,10,0),line('b',10,0,0,10),line('c',10,10,-10,0),line('d',0,10,0,-9)]);
const closed=sketch([line('a',0,0,10,0),line('b',10,0,0,10),line('c',10,10,-10,0),line('d',0,10,0,-10)]);
test('closing contour highlights all four boundary lines',()=>{
 const r=profileChangeFeedback(almost,closed,.01);
 assert.equal(r.changed,true);assert.equal(r.kind,'closed');assert.deepEqual(new Set(r.edgeIds),new Set(['a','b','c','d']));
 assert.ok(r.affectedPoints.length>0);
});
test('opening contour highlights all four boundary lines',()=>{
 const r=profileChangeFeedback(closed,almost,.01);
 assert.equal(r.changed,true);assert.equal(r.kind,'opened');assert.deepEqual(new Set(r.edgeIds),new Set(['a','b','c','d']));
});
test('unchanged topology does not mark a change',()=>{
 const r=profileChangeFeedback(closed,closed,.01);
 assert.equal(r.changed,false);assert.deepEqual(r.edgeIds,[]);
});
