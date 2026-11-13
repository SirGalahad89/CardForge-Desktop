import {dissolveContourPieces} from './sketch-contour-dissolve';
import type {SketchRegion,SketchProfile} from './sketch-engine';
type Point={x:number;y:number};
export type IntersectionPreview={ok:true;rings:SketchProfile[];regions:{outer:SketchProfile;holes:SketchProfile[];area:number}[];area:number;holeCount:number}|{ok:false;reason:string};
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const signedArea=(points:Point[])=>points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0)/2;
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
function normalized(points:Point[],tol:number):Point[]{
 const result:Point[]=[];
 for(const p of points){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return [];if(!result.length||distance(p,result[result.length-1])>tol)result.push({...p});}
 if(result.length>1&&distance(result[0],result[result.length-1])<=tol)result.pop();
 return result;
}
function convex(points:Point[],tol:number):boolean{
 if(points.length<3||Math.abs(signedArea(points))<=tol*tol)return false;
 const sign=Math.sign(signedArea(points));
 return points.every((p,i)=>cross(p,points[(i+1)%points.length],points[(i+2)%points.length])*sign>=-tol*tol);
}
function simplify(points:Point[],tol:number):Point[]{
 let out=normalized(points,tol);
 for(let pass=0;pass<out.length&&out.length>3;pass++){
  const before=out.length;
  out=out.filter((p,i)=>{const a=out[(i+out.length-1)%out.length],b=out[(i+1)%out.length];return Math.abs(cross(a,p,b))>tol*Math.max(distance(a,b),1);});
  if(out.length===before)break;
 }
 return out;
}
/** Ear clipping of a simple polygon. Rejects degeneracy and self-intersections. */
export function triangles(points:Point[],tol:number):Point[][]|null{
 const p=simplify(points,tol);
 if(p.length<3||Math.abs(signedArea(p))<=tol*tol)return null;
 const orient=Math.sign(signedArea(p));
 const segHit=(a:Point,b:Point,c:Point,d:Point)=>{
  const ab=cross(a,b,c),ab2=cross(a,b,d),cd=cross(c,d,a),cd2=cross(c,d,b);
  return ab*ab2 < -tol*tol && cd*cd2 < -tol*tol;
 };
 for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){
  if(j===i+1||(i===0&&j===p.length-1))continue;
  if(segHit(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length]))return null;
 }
 const indices=p.map((_,i)=>i),out:Point[][]=[];
 const insideTri=(a:Point,b:Point,c:Point,x:Point)=>
  orient*cross(a,b,x)>=-tol*tol&&orient*cross(b,c,x)>=-tol*tol&&orient*cross(c,a,x)>=-tol*tol;
 while(indices.length>3){
  let ear=false;
  for(let k=0;k<indices.length;k++){
   const prev=indices[(k+indices.length-1)%indices.length],cur=indices[k],next=indices[(k+1)%indices.length];
   if(orient*cross(p[prev],p[cur],p[next])<=tol*tol)continue;
   if(indices.some(i=>i!==prev&&i!==cur&&i!==next&&insideTri(p[prev],p[cur],p[next],p[i])))continue;
   out.push([p[prev],p[cur],p[next]]);indices.splice(k,1);ear=true;break;
  }
  if(!ear)return null;
 }
 out.push(indices.map(i=>p[i]));return out;
}
/** Convex clipping of one triangle against another. */
function clipConvex(subject:Point[],clip:Point[],tol:number):Point[]{
 const orientation=Math.sign(signedArea(clip));let output=subject;
 for(let i=0;i<clip.length;i++){
  const start=clip[i],end=clip[(i+1)%clip.length],input=output;output=[];
  if(!input.length)break;
  const inside=(p:Point)=>orientation*cross(start,end,p)>=-tol*Math.max(distance(start,end),1);
  const intersection=(p:Point,q:Point):Point=>{
   const fp=cross(start,end,p),fq=cross(start,end,q),denom=fp-fq;
   if(Math.abs(denom)<1e-12)return {...q};
   const t=Math.max(0,Math.min(1,fp/denom));return {x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t};
  };
  for(let j=0;j<input.length;j++){
   const p=input[(j+input.length-1)%input.length],q=input[j],pin=inside(p),qin=inside(q);
   if(qin){if(!pin)output.push(intersection(p,q));output.push(q);}
   else if(pin)output.push(intersection(p,q));
  }
  output=normalized(output,tol);
 }
 return simplify(output,tol);
}
/** Partition a convex piece into portions outside a convex cutter.
 * Each emitted polygon is disjoint in its interior; the remaining inside
 * portion is passed to the next cutter edge. */
export function subtractConvex(piece:Point[],cutter:Point[],tol:number):Point[][]{
 let remaining=piece;const outside:Point[][]=[];
 const orientation=Math.sign(signedArea(cutter));
 for(let i=0;i<cutter.length;i++){
  if(remaining.length<3)break;
  const a=cutter[i],b=cutter[(i+1)%cutter.length];
  const clipHalf=(subject:Point[],keepInside:boolean):Point[]=>{
   const input=subject,output:Point[]=[];
   const side=(p:Point)=>orientation*cross(a,b,p);
   const valid=(v:number)=>keepInside?v>=0:v<=0;
   for(let j=0;j<input.length;j++){
    const p=input[(j+input.length-1)%input.length],q=input[j];
    const sp=side(p),sq=side(q),pin=valid(sp),qin=valid(sq);
    const hit=()=>{const t=sp/(sp-sq);return {x:p.x+t*(q.x-p.x),y:p.y+t*(q.y-p.y)};};
    if(qin){if(!pin&&Math.abs(sp-sq)>1e-12)output.push(hit());output.push(q);}
    else if(pin&&Math.abs(sp-sq)>1e-12)output.push(hit());
   }
   return simplify(output,tol);
  };
  const cut=clipHalf(remaining,false);
  if(cut.length>=3&&Math.abs(signedArea(cut))>tol*tol)outside.push(cut);
  remaining=clipHalf(remaining,true);
 }
 return outside;
}

/** Non-mutating intersection of simple concave or convex polygons.
 * Triangulates the outer boundaries and subtracts triangulated holes before
 * dissolving the non-overlapping intersection pieces into contour rings.
 */
export function previewProfileIntersection(a:SketchRegion,b:SketchRegion,tolerance=0.01):IntersectionPreview{
 if(a.id===b.id)return {ok:false,reason:'Zwei verschiedene Profile auswählen'};

 const ta=triangles(a.outer.points,tolerance),tb=triangles(b.outer.points,tolerance);
 if(!ta||!tb)return {ok:false,reason:'Ungültige oder selbstschneidende Polygonkontur'};
 const holes=[...a.holes,...b.holes];
 const holeTriangles:Point[][]=[];
 for(const hole of holes){
  if(!Array.isArray(hole.points))return {ok:false,reason:'Ungültige Aussparungskontur'};
  const tris=triangles(hole.points,tolerance);
  if(!tris)return {ok:false,reason:'Ungültige Aussparungskontur'};
  holeTriangles.push(...tris);
 }
 let pieces:Point[][]=[];
 for(const x of ta)for(const y of tb){
  const points=clipConvex(x,y,tolerance),partArea=Math.abs(signedArea(points));
  if(points.length<3||partArea<=tolerance*tolerance)continue;
  pieces.push(points);
 }
 if(!pieces.length)return {ok:false,reason:'Keine positive Schnittfläche vorhanden'};
 for(const hole of holeTriangles){
  pieces=pieces.flatMap(piece=>subtractConvex(piece,hole,tolerance));
  if(!pieces.length)return {ok:false,reason:'Aussparungen entfernen die gesamte Schnittfläche'};
 }
 const dissolved=dissolveContourPieces(pieces,tolerance);
 if(dissolved.ok===false)return {ok:false,reason:dissolved.reason};
 const rings:SketchProfile[]=dissolved.rings.map((points,i)=>({id:'intersection-contour-'+i,itemIds:[],points,area:signedArea(points)}));
 const profileFor=(points:Point[]):SketchProfile=>({id:'intersection-ring-'+rings.length,itemIds:[],points,area:signedArea(points)});
 const regions=dissolved.regions.map(r=>({outer:profileFor(r.outer),holes:r.holes.map(profileFor),area:r.area}));
 return {ok:true,rings,regions,area:dissolved.area,holeCount:dissolved.holeCount};
}

/** Boolean difference of simple polygon regions, including existing holes.
 * All operations are read-only and fail closed for invalid contours. */
export function previewGeneralProfileDifference(base:SketchRegion,cutter:SketchRegion,tolerance=0.01):IntersectionPreview{
 if(base.id===cutter.id)return {ok:false,reason:'Grundfläche und Ausschnitt müssen verschieden sein'};
 const baseTriangles=triangles(base.outer.points,tolerance),cutTriangles=triangles(cutter.outer.points,tolerance);
 if(!baseTriangles||!cutTriangles)return {ok:false,reason:'Ungültige oder selbstschneidende Polygonkontur'};
 let pieces:Point[][]=baseTriangles;
 // Remove the entire cutter outer region, one convex triangle at a time.
 for(const cut of cutTriangles)pieces=pieces.flatMap(piece=>subtractConvex(piece,cut,tolerance));
 // Existing base holes are excluded from the remainder.
 for(const hole of base.holes){const ts=triangles(hole.points,tolerance);if(!ts)return {ok:false,reason:'Ungültige Aussparung der Grundfläche'};
  for(const tri of ts)pieces=pieces.flatMap(piece=>subtractConvex(piece,tri,tolerance));
 }
 // A hole in the cutter is material again, but only where it intersects the base.
 for(const hole of cutter.holes){const ts=triangles(hole.points,tolerance);if(!ts)return {ok:false,reason:'Ungültige Aussparung im Ausschnitt'};
  for(const tri of ts)for(const b of baseTriangles){const overlap=clipConvex(b,tri,tolerance);if(overlap.length>=3&&Math.abs(signedArea(overlap))>tolerance*tolerance)pieces.push(overlap);}
 }
 // Reapply base holes to restored cutter-hole material.
 if(cutter.holes.length&&base.holes.length){for(const hole of base.holes){const ts=triangles(hole.points,tolerance)!;for(const tri of ts)pieces=pieces.flatMap(piece=>subtractConvex(piece,tri,tolerance));}}
 if(!pieces.length)return {ok:false,reason:'Keine positive Restfläche vorhanden'};
 const dissolved=dissolveContourPieces(pieces,tolerance);
 if(dissolved.ok===false)return {ok:false,reason:dissolved.reason};
 const make=(points:Point[],id:string):SketchProfile=>({id,itemIds:[],points,area:signedArea(points)});
 return {ok:true,rings:dissolved.rings.map((r,i)=>make(r,'difference-ring-'+i)),regions:dissolved.regions.map((r,i)=>({outer:make(r.outer,'difference-outer-'+i),holes:r.holes.map((h,j)=>make(h,'difference-hole-'+i+'-'+j)),area:r.area})),area:dissolved.area,holeCount:dissolved.holeCount};
}
