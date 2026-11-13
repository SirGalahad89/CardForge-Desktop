import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {resolveRelations,hasCycle,inspectSketch,validSketch,measureRelations,verifyRelations}=require('../test-build/sketch-engine.cjs');
const line=(id,x=0,y=0,w=10,h=0)=>({id,kind:'line',x,y,w,h,construction:false});
const circle=(id,x=0,y=0,w=10)=>({id,kind:'circle',x,y,w,h:0,construction:false});
const rel=(id,kind,sourceId,targetId)=>({id,kind,sourceId,targetId});
test('detects cycles',()=>assert.equal(hasCycle([rel('1','equal','a','b'),rel('2','equal','b','a')]),true));
test('propagates equal length through chain',()=>{const s=resolveRelations({dpi:300,items:[line('a',0,0,40,0),line('b',0,0,0,10),line('c',0,0,0,5)],relations:[rel('1','equal','a','b'),rel('2','equal','b','c')]});assert.equal(Math.round(s.items[2].h),40);});
test('combines center and radius constraints',()=>{const s=resolveRelations({dpi:300,items:[circle('a',20,30,12),circle('b',100,100,44),circle('c',0,0,3)],relations:[rel('1','concentric','a','c'),rel('2','equalRadius','b','c')]});assert.deepEqual([s.items[2].x,s.items[2].y,s.items[2].w],[20,30,44]);});
test('diagnoses conflicting channels',()=>{const s={dpi:300,items:[circle('a'),circle('b'),circle('c')],relations:[rel('1','equalRadius','a','c'),rel('2','equalRadius','b','c')]};assert.ok(inspectSketch(s).some(x=>x.includes('Mehrere Bedingungen')));});
test('rejects invalid relation endpoint',()=>{const s={dpi:300,items:[line('a'),line('b')],relations:[{...rel('1','coincident','a','b'),sourceEnd:4}]};assert.equal(validSketch(s),false);});

test('verifies a resolved three-channel line constraint',()=>{
 const s=resolveRelations({dpi:300,items:[line('anchor',5,5,30,0),line('direction',0,0,0,20),line('length',0,0,25,0),line('target',0,0,3,4)],relations:[{...rel('p','coincident','anchor','target'),sourceEnd:1,targetEnd:1},rel('d','parallel','direction','target'),rel('l','equal','length','target')]});
 assert.equal(verifyRelations(s).length,0);
 assert.ok(Math.abs(s.items[3].x-35)<1e-8);
 assert.ok(Math.abs(s.items[3].y-(-20))<1e-8);
});
test('reports deviation in an inconsistent saved sketch',()=>{
 const s={dpi:300,items:[circle('a',0,0,10),circle('b',20,0,4)],relations:[rel('r','concentric','a','b')]};
 assert.equal(verifyRelations(s).length,1);
 assert.ok(measureRelations(s)[0].error>19);
 assert.equal(verifyRelations(resolveRelations(s)).length,0);
});
test('checks angular residual independently of sketch dpi',()=>{
 const s={dpi:600,items:[line('a',0,0,10,0),line('b',0,0,10,1)],relations:[rel('r','parallel','a','b')]};
 assert.equal(measureRelations(s)[0].unit,'angle');
 assert.equal(verifyRelations(s).length,1);
 assert.equal(verifyRelations(resolveRelations(s)).length,0);
});
const {solveSketch}=require('../test-build/sketch-engine.cjs');
test('iterative solver converges on chained relations',()=>{
 const report=solveSketch({dpi:300,items:[line('a',0,0,30,0),line('b',0,0,0,3),line('c',0,0,0,2)],relations:[rel('1','equal','a','b'),rel('2','equal','b','c')]});
 assert.equal(report.converged,true);assert.equal(report.sketch.items[2].h,30);
});
test('solver reports cyclic relations without modifying input',()=>{
 const sketch={dpi:300,items:[line('a'),line('b')],relations:[rel('1','equal','a','b'),rel('2','equal','b','a')]};
 const report=solveSketch(sketch);assert.equal(report.converged,false);assert.equal(report.sketch,sketch);assert.match(report.reason,/Zyklische/);
});
test('solver handles invalid numeric propagation without emitting NaN',()=>{
 const sketch={dpi:300,items:[line('a',0,0,1.7e308,1.7e308),line('b',0,0,1,0)],relations:[rel('1','equal','a','b')]};
 const report=solveSketch(sketch);assert.equal(report.converged,false);assert.equal(report.sketch,sketch);
});

test('shared endpoint follows reference while preserving target vector',()=>{
 const sketch={dpi:300,items:[line('a',10,20,30,0),line('b',2,3,0,15)],junctions:[{id:'j',sourceId:'a',sourceEnd:1,targetId:'b',targetEnd:0}]};
 const report=solveSketch(sketch);
 assert.equal(report.converged,true);
 assert.deepEqual([report.sketch.items[1].x,report.sketch.items[1].y,report.sketch.items[1].w,report.sketch.items[1].h],[40,20,0,15]);
 assert.equal(verifyRelations(report.sketch).length,0);
});
test('shared endpoint survives JSON validation and rejects missing reference',()=>{
 const sketch={dpi:300,items:[line('a'),line('b')],junctions:[{id:'j',sourceId:'a',sourceEnd:1,targetId:'b',targetEnd:0}]};
 assert.equal(validSketch(sketch),true);
 assert.equal(validSketch({...sketch,junctions:[{...sketch.junctions[0],sourceId:'missing'}]}),false);
});
test('shared endpoint refuses cyclic links',()=>{
 const sketch={dpi:300,items:[line('a'),line('b')],junctions:[{id:'j1',sourceId:'a',sourceEnd:1,targetId:'b',targetEnd:0},{id:'j2',sourceId:'b',sourceEnd:1,targetId:'a',targetEnd:0}]};
 assert.ok(inspectSketch(sketch).some(x=>x.includes('Zyklische')));
});
test('independent CAD node positions multiple connected line endpoints',()=>{
 const s={dpi:300,items:[line('a',0,0,10,0),line('b',40,30,0,12),line('c',15,15,5,5)],nodes:[{id:'n',x:80,y:70,members:[{itemId:'a',end:1},{itemId:'b',end:0},{itemId:'c',end:0}]}]};
 const r=solveSketch(s);assert.equal(r.converged,true);assert.deepEqual([r.sketch.items[0].x+r.sketch.items[0].w,r.sketch.items[0].y+r.sketch.items[0].h],[80,70]);assert.deepEqual([r.sketch.items[1].x,r.sketch.items[1].y],[80,70]);assert.equal(verifyRelations(r.sketch).length,0);
});
test('a line with both endpoints bound updates its vector',()=>{
 const s={dpi:300,items:[line('a',0,0,1,1)],nodes:[{id:'n1',x:10,y:20,members:[{itemId:'a',end:0}]},{id:'n2',x:40,y:50,members:[{itemId:'a',end:1}]}]};
 const r=solveSketch(s);assert.equal(r.converged,true);assert.deepEqual([r.sketch.items[0].x,r.sketch.items[0].y,r.sketch.items[0].w,r.sketch.items[0].h],[10,20,30,30]);
});
test('node validation rejects duplicate endpoint ownership',()=>{
 const s={dpi:300,items:[line('a')],nodes:[{id:'n1',x:0,y:0,members:[{itemId:'a',end:0}]},{id:'n2',x:2,y:2,members:[{itemId:'a',end:0}]}]};
 assert.equal(validSketch(s),false);
});

test('driving length stays fixed when the line is changed',()=>{
 const sk={dpi:25.4,items:[line('a',0,0,7,0)],dimensions:[{id:'d',itemId:'a',kind:'length',valueMM:20}]};
 const result=resolveRelations(sk);
 assert.equal(Math.round(Math.hypot(result.items[0].w,result.items[0].h)),20);
 assert.equal(verifyRelations(result).length,0);
});
test('driving length preserves an anchored end node',()=>{
 const sk={dpi:25.4,items:[line('a',0,0,7,0)],nodes:[{id:'n',x:7,y:0,members:[{itemId:'a',end:1}]}],dimensions:[{id:'d',itemId:'a',kind:'length',valueMM:20}]};
 const result=resolveRelations(sk);
 assert.equal(result.items[0].x,-13);
 assert.equal(result.items[0].x+result.items[0].w,7);
});
test('driving dimensions reject conflicting double node anchors',()=>{
 const sk={dpi:25.4,items:[line('a',0,0,7,0)],nodes:[{id:'n1',x:0,y:0,members:[{itemId:'a',end:0}]},{id:'n2',x:7,y:0,members:[{itemId:'a',end:1}]}],dimensions:[{id:'d',itemId:'a',kind:'length',valueMM:20}]};
 assert.ok(inspectSketch(sk).some(x=>x.includes('zwei CAD-Knoten')));
});
test('invalid driving dimensions are rejected on import',()=>{
 assert.equal(validSketch({dpi:300,items:[line('a')],dimensions:[{id:'d',itemId:'a',kind:'radius',valueMM:10}]}),false);
});
