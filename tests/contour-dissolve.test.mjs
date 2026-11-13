import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {dissolveContourPieces}=require('../test-build/sketch-contour-dissolve.cjs');
const poly=(...pairs)=>pairs.map(([x,y])=>({x,y}));
test('two triangles dissolve into a square without the diagonal',()=>{
 const a=poly([0,0],[4,0],[4,4]),b=poly([0,0],[4,4],[0,4]);const r=dissolveContourPieces([a,b]);assert.equal(r.ok,true);assert.equal(r.rings.length,1);assert.equal(r.rings[0].length,4);assert.equal(r.area,16);
});
test('collinear T-junction is split and removed',()=>{
 const a=poly([0,0],[4,0],[4,2],[0,2]),b=poly([0,2],[2,2],[2,4],[0,4]),c=poly([2,2],[4,2],[4,4],[2,4]);const r=dissolveContourPieces([a,b,c]);assert.equal(r.ok,true);assert.equal(r.rings.length,1);assert.equal(r.rings[0].length,4);assert.equal(r.area,16);
});
test('separate islands remain separate',()=>{
 const r=dissolveContourPieces([poly([0,0],[1,0],[1,1],[0,1]),poly([3,0],[4,0],[4,1],[3,1])]);assert.equal(r.ok,true);assert.equal(r.rings.length,2);assert.equal(r.area,2);
});
test('source pieces remain unchanged',()=>{
 const pieces=[poly([0,0],[4,0],[4,4]),poly([0,4],[4,4],[0,0])],before=JSON.stringify(pieces);dissolveContourPieces(pieces);assert.equal(JSON.stringify(pieces),before);
});
test('ring-shaped tiled pieces create one outer region with a hole',()=>{
 const tiles=[];for(let y=0;y<3;y++)for(let x=0;x<3;x++){if(x===1&&y===1)continue;tiles.push(poly([x,y],[x+1,y],[x+1,y+1],[x,y+1]));}
 const r=dissolveContourPieces(tiles,0.0001);assert.equal(r.ok,true);assert.equal(r.holeCount,1);assert.equal(r.regions.length,1);assert.equal(r.regions[0].holes.length,1);assert.equal(r.area,8);assert.equal(r.regions[0].area,8);
});
test('two separate ring-shaped components retain independent holes',()=>{
 const tiles=[];for(const offset of [0,5])for(let y=0;y<3;y++)for(let x=0;x<3;x++){if(x===1&&y===1)continue;tiles.push(poly([x+offset,y],[x+offset+1,y],[x+offset+1,y+1],[x+offset,y+1]));}
 const r=dissolveContourPieces(tiles,0.0001);assert.equal(r.ok,true);assert.equal(r.regions.length,2);assert.equal(r.holeCount,2);assert.ok(r.regions.every(x=>x.holes.length===1&&x.area===8));
});
