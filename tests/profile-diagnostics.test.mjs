import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';const require=createRequire(import.meta.url);const {diagnoseProfileChains}=require('../test-build/sketch-profile-diagnostics.cjs');
const line=(id,x,y,w,h)=>({id,kind:'line',x,y,w,h,construction:false});
test('open chain exposes exactly two endpoints',()=>{const d=diagnoseProfileChains({dpi:300,items:[line('a',0,0,10,0),line('b',10,0,0,10)]});assert.equal(d.length,1);assert.equal(d[0].kind,'open');assert.equal(d[0].points.length,2);});
test('closed triangle has no open ends',()=>{const d=diagnoseProfileChains({dpi:300,items:[line('a',0,0,10,0),line('b',10,0,-5,10),line('c',5,10,-5,-10)]});assert.equal(d.length,0);});
test('branch is reported',()=>{const d=diagnoseProfileChains({dpi:300,items:[line('a',0,0,10,0),line('b',10,0,0,10),line('c',10,0,10,0)]});assert.ok(d.some(x=>x.kind==='branch'));});
test('construction lines ignored',()=>{const l=line('a',0,0,10,0);l.construction=true;assert.equal(diagnoseProfileChains({dpi:300,items:[l]}).length,0);});
