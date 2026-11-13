import type {SketchRegion,SketchProfile} from './sketch-engine';
export type DifferencePreview={ok:true;rings:SketchProfile[];area:number;holeCount:number}|{ok:false;reason:string};
type Point={x:number;y:number};
const inside=(p:Point,poly:Point[])=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const onSegment=(a:Point,b:Point,p:Point,t:number)=>Math.abs(cross(a,b,p))<=t*Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))&&p.x>=Math.min(a.x,b.x)-t&&p.x<=Math.max(a.x,b.x)+t&&p.y>=Math.min(a.y,b.y)-t&&p.y<=Math.max(a.y,b.y)+t;
const touch=(a:Point[],b:Point[],t:number)=>a.some((p,i)=>{const q=a[(i+1)%a.length];return b.some((r,j)=>{const s=b[(j+1)%b.length];const c1=cross(p,q,r),c2=cross(p,q,s),c3=cross(r,s,p),c4=cross(r,s,q);return (c1*c2<0&&c3*c4<0)||onSegment(p,q,r,t)||onSegment(p,q,s,t)||onSegment(r,s,p,t)||onSegment(r,s,q,t);});});
/** Conservative read-only subtraction: only a strictly enclosed, non-intersecting cutter is supported. */
export function previewProfileDifference(base:SketchRegion,cutter:SketchRegion,tolerance=0.01):DifferencePreview{
 if(base.id===cutter.id)return {ok:false,reason:'Grundfläche und Ausschnitt müssen verschieden sein'};
 if(cutter.holes.length)return {ok:false,reason:'Ausschnitte mit eigenen Löchern werden noch nicht unterstützt'};
 const outer=base.outer.points,cut=cutter.outer.points;
 if(outer.length<3||cut.length<3)return {ok:false,reason:'Ungültige Profilkontur'};
 if(touch(outer,cut,tolerance))return previewOverlappingRectangleDifference(base,cutter,tolerance);
 if(!cut.every(p=>inside(p,outer)))return {ok:false,reason:'Ausschnitt muss vollständig innerhalb der Grundfläche liegen'};
 for(const hole of base.holes){if(touch(hole.points,cut,tolerance)||cut.some(p=>inside(p,hole.points))||hole.points.some(p=>inside(p,cut)))return {ok:false,reason:'Ausschnitt überschneidet eine vorhandene Öffnung'};}
 const area=base.area-cutter.area;
 if(area<=tolerance*tolerance)return {ok:false,reason:'Keine positive Restfläche'};
 return {ok:true,rings:[base.outer,...base.holes,cutter.outer],area,holeCount:base.holes.length+1};
}

/** Exact rectangular difference for overlapping axis-aligned, hole-free regions.
 * The original sketch is not mutated. Unsupported polygons fail closed.
 */
export function previewOverlappingRectangleDifference(base:SketchRegion,cutter:SketchRegion,tolerance=0.01):DifferencePreview{
 if(base.id===cutter.id)return {ok:false,reason:'Grundfläche und Ausschnitt müssen verschieden sein'};
 if(base.holes.length||cutter.holes.length)return {ok:false,reason:'Überlappende Rechtecke mit vorhandenen Löchern noch nicht unterstützt'};
 const bounds=(pts:Point[])=>({x0:Math.min(...pts.map(p=>p.x)),x1:Math.max(...pts.map(p=>p.x)),y0:Math.min(...pts.map(p=>p.y)),y1:Math.max(...pts.map(p=>p.y))});
 const rectangle=(pts:Point[])=>{if(pts.length!==4)return false;const b=bounds(pts);return b.x1-b.x0>tolerance&&b.y1-b.y0>tolerance&&pts.every(p=>(Math.abs(p.x-b.x0)<=tolerance||Math.abs(p.x-b.x1)<=tolerance)&&(Math.abs(p.y-b.y0)<=tolerance||Math.abs(p.y-b.y1)<=tolerance))&&new Set(pts.map(p=>`${Math.round((p.x-b.x0)/tolerance)},${Math.round((p.y-b.y0)/tolerance)}`)).size===4;};
 const bp=base.outer.points,cp=cutter.outer.points;
 if(!rectangle(bp)||!rectangle(cp))return {ok:false,reason:'Überlappende Differenz unterstützt derzeit nur achsenparallele Rechtecke'};
 const b=bounds(bp),c=bounds(cp),ox=Math.min(b.x1,c.x1)-Math.max(b.x0,c.x0),oy=Math.min(b.y1,c.y1)-Math.max(b.y0,c.y0);
 if(ox<=tolerance||oy<=tolerance)return {ok:false,reason:'Rechtecke besitzen keine positive Schnittfläche'};
 const xs=[...new Set([b.x0,b.x1,c.x0,c.x1])].sort((a,z)=>a-z),ys=[...new Set([b.y0,b.y1,c.y0,c.y1])].sort((a,z)=>a-z);
 const filled=(i:number,j:number)=>{if(i<0||j<0||i>=xs.length-1||j>=ys.length-1)return false;const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;return x>b.x0&&x<b.x1&&y>b.y0&&y<b.y1&&!(x>c.x0&&x<c.x1&&y>c.y0&&y<c.y1);};
 type Edge={a:Point;b:Point};const edges:Edge[]=[];
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++)if(filled(i,j)){
  const x=xs[i],X=xs[i+1],y=ys[j],Y=ys[j+1];
  if(!filled(i,j-1))edges.push({a:{x,y},b:{x:X,y}});
  if(!filled(i+1,j))edges.push({a:{x:X,y},b:{x:X,y:Y}});
  if(!filled(i,j+1))edges.push({a:{x:X,y:Y},b:{x,y:Y}});
  if(!filled(i-1,j))edges.push({a:{x,y:Y},b:{x,y}});
 }
 if(!edges.length)return {ok:false,reason:'Der Ausschnitt entfernt die gesamte Grundfläche'};
 const key=(p:Point)=>`${p.x},${p.y}`,byStart=new Map(edges.map((e,i)=>[key(e.a),i]));const seen=new Set<number>(),rings:SketchProfile[]=[];
 for(let start=0;start<edges.length;start++){
  if(seen.has(start))continue;let at=start;const pts:Point[]=[];
  for(let steps=0;steps<=edges.length;steps++){
   if(seen.has(at))break;seen.add(at);pts.push(edges[at].a);const next=byStart.get(key(edges[at].b));if(next===undefined)return {ok:false,reason:'Restkontur konnte nicht geschlossen werden'};at=next;
  }
  if(at!==start)return {ok:false,reason:'Mehrdeutige Restkontur'};
  const simplified=pts.filter((p,i)=>Math.abs(cross(pts[(i+pts.length-1)%pts.length],p,pts[(i+1)%pts.length]))>tolerance*tolerance);
  if(simplified.length<4)return {ok:false,reason:'Degenerierte Restkontur'};
  const area=Math.abs(simplified.reduce((s,p,i)=>{const q=simplified[(i+1)%simplified.length];return s+p.x*q.y-p.y*q.x;},0)/2);
  rings.push({id:`difference-rectangle-${rings.length}`,itemIds:[],points:simplified,area});
 }
 if(rings.length!==1)return {ok:false,reason:'Mehrere getrennte Restflächen werden noch nicht unterstützt'};
 const area=(b.x1-b.x0)*(b.y1-b.y0)-ox*oy;
 if(area<=tolerance*tolerance)return {ok:false,reason:'Keine positive Restfläche'};
 return {ok:true,rings,area,holeCount:0};
}
