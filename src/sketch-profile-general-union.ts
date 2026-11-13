import {dissolveContourPieces} from './sketch-contour-dissolve';
import {previewGeneralProfileDifference,previewProfileIntersection,triangles,subtractConvex} from './sketch-profile-intersection';
import type {SketchRegion,SketchProfile} from './sketch-engine';
type Point={x:number;y:number};
export type GeneralUnionPreview={ok:true;rings:SketchProfile[];regions:{outer:SketchProfile;holes:SketchProfile[];area:number}[];area:number;holeCount:number}|{ok:false;reason:string};
const signedArea=(p:Point[])=>p.reduce((s,v,i)=>{const q=p[(i+1)%p.length];return s+v.x*q.y-v.y*q.x;},0)/2;
/** Convert a region (including its holes) into interior-disjoint convex pieces. */
function piecesOf(region:{outer:SketchProfile;holes:SketchProfile[]},tol:number):Point[][]|null{
 let pieces=triangles(region.outer.points,tol);if(!pieces)return null;
 for(const hole of region.holes){const cuts=triangles(hole.points,tol);if(!cuts)return null;
  for(const cut of cuts)pieces=pieces.flatMap(piece=>subtractConvex(piece,cut,tol));
 }return pieces;
}
/** Boolean union of two independently selected polygon regions. Works for concave
 * outlines and holes by combining A with B minus A; never changes the sketch. */
export function previewGeneralProfileUnion(a:SketchRegion,b:SketchRegion,tolerance=0.01):GeneralUnionPreview{
 if(a.id===b.id)return {ok:false,reason:'Zwei verschiedene Profile auswählen'};
 if(!Number.isFinite(tolerance)||tolerance<=0)return {ok:false,reason:'Ungültige Geometrietoleranz'};
 const pieces=piecesOf(a,tolerance);if(!pieces)return {ok:false,reason:'Ungültige Grundkontur oder Aussparung'};
 const remainder=previewGeneralProfileDifference(b,a,tolerance);
 // A completely contains B if the remainder is empty and the intersection
 // exists; this is a valid union equal to A.
 if(remainder.ok===false){const intersection=previewProfileIntersection(a,b,tolerance);
  if(intersection.ok===false)return {ok:false,reason:'Vereinigung kann nicht zuverlässig berechnet werden: '+remainder.reason};
 }else for(const region of remainder.regions){const extra=piecesOf(region,tolerance);
  if(!extra)return {ok:false,reason:'Ungültige Restkontur'};pieces.push(...extra);
 }
 const dissolved=dissolveContourPieces(pieces,tolerance);
 if(dissolved.ok===false)return {ok:false,reason:dissolved.reason};
 const make=(points:Point[],id:string):SketchProfile=>({id,itemIds:[],points,area:Math.abs(signedArea(points))});
 return {ok:true,rings:dissolved.rings.map((p,i)=>make(p,'general-union-ring-'+i)),regions:dissolved.regions.map((r,i)=>({outer:make(r.outer,'general-union-outer-'+i),holes:r.holes.map((h,j)=>make(h,'general-union-hole-'+i+'-'+j)),area:r.area})),area:dissolved.area,holeCount:dissolved.holeCount};
}
