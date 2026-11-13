import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {previewProfileIntersection}=require('../test-build/sketch-profile-intersection.cjs');
const region=(id,x,y,w,h=w)=>({id,outer:{id,points:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],itemIds:[],area:w*h},holes:[],area:w*h});
test('partially overlapping rectangles yield exact intersection',()=>{const a=region('a',0,0,10),b=region('b',8,7,6);const snapshot=JSON.stringify([a,b]);const r=previewProfileIntersection(a,b);assert.equal(r.ok,true);assert.equal(r.area,6);assert.equal(r.rings[0].points.length,4);assert.equal(JSON.stringify([a,b]),snapshot);});
test('contained rectangle yields contained region',()=>{const r=previewProfileIntersection(region('a',0,0,20),region('b',3,4,5));assert.equal(r.ok,true);assert.equal(r.area,25);});
test('disjoint and edge touching rectangles have no positive intersection',()=>{assert.equal(previewProfileIntersection(region('a',0,0,10),region('b',10,0,5)).ok,false);assert.equal(previewProfileIntersection(region('a',0,0,10),region('b',20,20,5)).ok,false);});
test('same region and holes are rejected',()=>{const a=region('a',0,0,10);assert.equal(previewProfileIntersection(a,a).ok,false);const b=region('b',2,2,4);b.holes.push({});assert.equal(previewProfileIntersection(a,b).ok,false);});
test('non-rectangular convex quadrilateral is accepted',()=>{const a=region('a',0,0,10);a.outer.points[2].x=8;const r=previewProfileIntersection(a,region('b',3,3,4));assert.equal(r.ok,true);assert.ok(r.area>0);});

const polygon=(id,points)=>({id,outer:{id,points,itemIds:[],area:0},holes:[],area:0});
test('two triangles intersect in a convex polygon',()=>{const a=polygon('tri-a',[{x:0,y:0},{x:8,y:0},{x:0,y:8}]);const b=polygon('tri-b',[{x:2,y:2},{x:9,y:2},{x:2,y:9}]);const r=previewProfileIntersection(a,b);assert.equal(r.ok,true);assert.ok(Math.abs(r.area-8)<1e-7);});
test('clockwise and counterclockwise contours yield same area',()=>{const a=polygon('tri-a',[{x:0,y:0},{x:8,y:0},{x:0,y:8}]);const b=polygon('tri-b',[{x:2,y:2},{x:9,y:2},{x:2,y:9}]);const f=previewProfileIntersection(a,b),r=previewProfileIntersection({...a,outer:{...a.outer,points:[...a.outer.points].reverse()}},{...b,outer:{...b.outer,points:[...b.outer.points].reverse()}});assert.equal(f.ok,true);assert.equal(r.ok,true);assert.ok(Math.abs(f.area-r.area)<1e-7);});
test('rotated diamond and rectangle have positive intersection',()=>{const a=polygon('diamond',[{x:5,y:0},{x:10,y:5},{x:5,y:10},{x:0,y:5}]);const b=region('rect',2,2,6);const r=previewProfileIntersection(a,b);assert.equal(r.ok,true);assert.ok(Math.abs(r.area-34)<1e-7);});
test('concave L-shaped polygon intersects a rectangle',()=>{const a=polygon('concave',[{x:0,y:0},{x:8,y:0},{x:8,y:2},{x:2,y:2},{x:2,y:8},{x:0,y:8}]);const r=previewProfileIntersection(a,region('rect',1,1,4));assert.equal(r.ok,true);assert.ok(Math.abs(r.area-7)<1e-7);assert.equal(r.rings.length,1);assert.equal(r.rings[0].points.length,6);});
test('polygon inputs are not modified',()=>{const a=polygon('tri',[{x:0,y:0},{x:8,y:0},{x:0,y:8}]),b=region('rect',1,1,5);const snapshot=JSON.stringify([a,b]);previewProfileIntersection(a,b);assert.equal(JSON.stringify([a,b]),snapshot);});

test('concave intersection supports clockwise input and keeps original inputs',()=>{const points=[{x:0,y:0},{x:8,y:0},{x:8,y:2},{x:2,y:2},{x:2,y:8},{x:0,y:8}];const a=polygon('a',points.reverse()),b=region('b',1,1,4);const before=JSON.stringify([a,b]);const r=previewProfileIntersection(a,b);assert.equal(r.ok,true);assert.ok(Math.abs(r.area-7)<1e-7);assert.equal(JSON.stringify([a,b]),before);});
test('concave disconnected intersection returns multiple pieces',()=>{const a=polygon('u',[{x:0,y:0},{x:8,y:0},{x:8,y:8},{x:6,y:8},{x:6,y:2},{x:2,y:2},{x:2,y:8},{x:0,y:8}]);const b=region('bar',0,4,8,2);const r=previewProfileIntersection(a,b);assert.equal(r.ok,true);assert.ok(Math.abs(r.area-8)<1e-7);});
test('self-intersecting bow tie is rejected',()=>{const a=polygon('bow',[{x:0,y:0},{x:5,y:5},{x:0,y:5},{x:5,y:0}]);assert.equal(previewProfileIntersection(a,region('b',0,0,6)).ok,false);});

test('disconnected U intersection dissolves into exactly two contours',()=>{const a=polygon('u',[{x:0,y:0},{x:8,y:0},{x:8,y:8},{x:6,y:8},{x:6,y:2},{x:2,y:2},{x:2,y:8},{x:0,y:8}]);const r=previewProfileIntersection(a,region('bar',0,4,8,2));assert.equal(r.ok,true);assert.equal(r.rings.length,2);assert.equal(r.holeCount,0);assert.equal(r.area,8);});

const withHole=(id,outer,hole)=>({id,outer:{id:id+'-outer',points:outer,itemIds:[],area:0},holes:[{id:id+'-hole',points:hole,itemIds:[],area:0}],area:0});
const square=(x,y,w,h=w)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
test('hole survives intersection with larger polygon',()=>{const a=withHole('donut',square(0,0,10),square(3,3,4)),b=polygon('cover',square(-1,-1,12));const before=JSON.stringify([a,b]);const r=previewProfileIntersection(a,b);assert.equal(r.ok,true,r.reason);assert.equal(r.holeCount,1);assert.equal(r.regions.length,1);assert.ok(Math.abs(r.area-84)<1e-7);assert.equal(JSON.stringify([a,b]),before);});
test('clipping a hole at boundary creates a notch, not a hole',()=>{const a=withHole('donut',square(0,0,10),square(3,3,4)),b=polygon('right',square(5,0,5,10));const r=previewProfileIntersection(a,b);assert.equal(r.ok,true,r.reason);assert.equal(r.holeCount,0);assert.equal(r.regions.length,1);assert.ok(Math.abs(r.area-42)<1e-7);});
test('intersection entirely inside a hole is empty',()=>{const a=withHole('donut',square(0,0,10),square(3,3,4)),b=polygon('inside-hole',square(4,4,2));assert.equal(previewProfileIntersection(a,b).ok,false);});
test('holes in both input polygons are excluded',()=>{const a=withHole('a',square(0,0,12),square(2,2,2)),b=withHole('b',square(0,0,12),square(8,8,2));const r=previewProfileIntersection(a,b);assert.equal(r.ok,true,r.reason);assert.equal(r.holeCount,2);assert.ok(Math.abs(r.area-136)<1e-7);});
