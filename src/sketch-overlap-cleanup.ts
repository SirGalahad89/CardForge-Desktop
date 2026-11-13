import type {Sketch,SketchItem} from './sketch-engine';
import type {SketchIntersection} from './sketch-intersections';
export type OverlapPreview={start:{x:number;y:number};end:{x:number;y:number};length:number;exactDuplicate:boolean};
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const ends=(l:SketchItem)=>[{x:l.x,y:l.y},{x:l.x+l.w,y:l.y+l.h}];
/** Pure geometric preview: interval common to two collinear line segments. */
export function previewOverlap(sk:Sketch,hit:SketchIntersection,tolerance=1e-5):OverlapPreview|null{
 if(hit.kind!=='overlap')return null;
 const [a,b]=hit.itemIds.map(id=>sk.items.find(i=>i.id===id));
 if(!a||!b||a.kind!=='line'||b.kind!=='line')return null;
 const aa=ends(a),bb=ends(b),length=dist(aa[0],aa[1]);if(length<=tolerance)return null;
 const ux=(aa[1].x-aa[0].x)/length,uy=(aa[1].y-aa[0].y)/length;
 if(Math.abs((bb[0].x-aa[0].x)*uy-(bb[0].y-aa[0].y)*ux)>tolerance||Math.abs((bb[1].x-aa[0].x)*uy-(bb[1].y-aa[0].y)*ux)>tolerance)return null;
 const project=(p:{x:number;y:number})=>(p.x-aa[0].x)*ux+(p.y-aa[0].y)*uy;
 const t0=project(bb[0]),t1=project(bb[1]);const lo=Math.max(0,Math.min(t0,t1)),hi=Math.min(length,Math.max(t0,t1));if(hi-lo<=tolerance)return null;
 const same=(dist(aa[0],bb[0])<=tolerance&&dist(aa[1],bb[1])<=tolerance)||(dist(aa[0],bb[1])<=tolerance&&dist(aa[1],bb[0])<=tolerance);
 return {start:{x:aa[0].x+ux*lo,y:aa[0].y+uy*lo},end:{x:aa[0].x+ux*hi,y:aa[0].y+uy*hi},length:hi-lo,exactDuplicate:same};
}
/** Only remove an exact redundant copy when absolutely no constraints reference it. */
export function removeExactOverlap(sk:Sketch,hit:SketchIntersection,tolerance=1e-5):{ok:true;sketch:Sketch;removedId:string}|{ok:false;reason:string}{
 const p=previewOverlap(sk,hit,tolerance);if(!p?.exactDuplicate)return {ok:false,reason:'Nur vollständig deckungsgleiche Linien können sicher entfernt werden'};
 const id=hit.itemIds[1],line=sk.items.find(i=>i.id===id);
 if(!line||line.constraint||sk.dimensions?.some(d=>d.itemId===id)||sk.relations?.some(r=>r.sourceId===id||r.targetId===id)||sk.junctions?.some(j=>j.sourceId===id||j.targetId===id)||sk.nodes?.some(n=>n.members.some(m=>m.itemId===id)))return {ok:false,reason:'Die zweite Linie besitzt Maße, Abhängigkeiten oder CAD-Knoten und darf nicht entfernt werden'};
 return {ok:true,sketch:{...sk,items:sk.items.filter(i=>i.id!==id)},removedId:id};
}

export type PartialOverlapPlan={segments:SketchItem[];removedIds:[string,string];overlap:OverlapPreview};
/** Preview a canonical non-overlapping partition of the union of two collinear segments. */
export function previewPartialOverlapCleanup(sk:Sketch,hit:SketchIntersection,tolerance=1e-5):{ok:true;plan:PartialOverlapPlan}|{ok:false;reason:string}{
 const overlap=previewOverlap(sk,hit,tolerance);
 if(!overlap||overlap.exactDuplicate)return {ok:false,reason:'Nur teilweise überlappende Linien werden hier aufgeteilt'};
 const ids=hit.itemIds;
 const pair=ids.map(id=>sk.items.find(i=>i.id===id));
 if(pair.some(i=>!i||i.kind!=='line'||i.construction))return {ok:false,reason:'Nur reguläre Linien können bereinigt werden'};
 for(const id of ids){const item=sk.items.find(i=>i.id===id)!;
  if(item.constraint||sk.dimensions?.some(d=>d.itemId===id)||sk.relations?.some(r=>r.sourceId===id||r.targetId===id)||sk.junctions?.some(j=>j.sourceId===id||j.targetId===id)||sk.nodes?.some(n=>n.members.some(m=>m.itemId===id)))
   return {ok:false,reason:'Mindestens eine Linie besitzt Maße, Abhängigkeiten oder CAD-Knoten. Die Aufteilung wurde zum Schutz der Parametrik abgelehnt'};
 }
 const a=pair[0]!,b=pair[1]!;const length=Math.hypot(a.w,a.h),ux=a.w/length,uy=a.h/length;
 const scalar=(x:number,y:number)=>(x-a.x)*ux+(y-a.y)*uy;
 const bounds=[0,length,scalar(b.x,b.y),scalar(b.x+b.w,b.y+b.h)].sort((x,y)=>x-y);
 const unique=bounds.filter((v,i)=>i===0||v-bounds[i-1]>tolerance);
 const occupied=(mid:number,l:SketchItem)=>{const t0=scalar(l.x,l.y),t1=scalar(l.x+l.w,l.y+l.h);return mid>=Math.min(t0,t1)-tolerance&&mid<=Math.max(t0,t1)+tolerance;};
 const segments:SketchItem[]=[];
 for(let i=0;i<unique.length-1;i++){
  const lo=unique[i],hi=unique[i+1];if(hi-lo<=tolerance||!occupied((lo+hi)/2,a)&&!occupied((lo+hi)/2,b))continue;
  const id=`${a.id}-merge-${i+1}`;if(sk.items.some(item=>item.id===id))return {ok:false,reason:'Segment-ID bereits vorhanden; Bereinigung abgebrochen'};
  segments.push({...a,id,x:a.x+lo*ux,y:a.y+lo*uy,w:(hi-lo)*ux,h:(hi-lo)*uy,constraint:undefined});
 }
 if(segments.length<2)return {ok:false,reason:'Keine gültige Teilsegmentierung möglich'};
 return {ok:true,plan:{segments,removedIds:ids,overlap}};
}
/** Apply only a previously validated, constraint-free plan; shared boundary nodes are explicit. */
export function cleanupPartialOverlap(sk:Sketch,hit:SketchIntersection,tolerance=1e-5):{ok:true;sketch:Sketch;segments:number}|{ok:false;reason:string}{
 const result=previewPartialOverlapCleanup(sk,hit,tolerance);if('reason' in result)return {ok:false,reason:result.reason};
 const {segments,removedIds}=result.plan;
 const nodes=[...(sk.nodes||[])];
 for(let i=0;i<segments.length-1;i++){
  const first=segments[i],second=segments[i+1];
  const id=`overlap-node-${first.id}-${second.id}`;
  if(nodes.some(n=>n.id===id))return {ok:false,reason:'CAD-Knoten-ID bereits vorhanden'};
  nodes.push({id,x:first.x+first.w,y:first.y+first.h,members:[{itemId:first.id,end:1},{itemId:second.id,end:0}]});
 }
 return {ok:true,sketch:{...sk,items:[...sk.items.filter(i=>!removedIds.includes(i.id)),...segments],nodes},segments:segments.length};
}

/** Read-only display model for a partial-overlap cleanup. No sketch mutation. */
export function previewPartialOverlapGeometry(sk:Sketch,hit:SketchIntersection,tolerance=1e-5):
 {ok:true;segments:{start:{x:number;y:number};end:{x:number;y:number};shared:boolean}[];nodes:{x:number;y:number}[];removedIds:[string,string]}|{ok:false;reason:string}{
 const result=previewPartialOverlapCleanup(sk,hit,tolerance);
 if(!result.ok)return {ok:false,reason:'reason' in result?result.reason:'Keine Vorschau verfügbar'};
 const {segments,removedIds,overlap}=result.plan;
 const between=(p:{x:number;y:number})=>{
  const dx=overlap.end.x-overlap.start.x,dy=overlap.end.y-overlap.start.y;
  const len2=dx*dx+dy*dy;
  if(len2<=tolerance*tolerance)return false;
  const t=((p.x-overlap.start.x)*dx+(p.y-overlap.start.y)*dy)/len2;
  return t>=-tolerance/Math.sqrt(len2)&&t<=1+tolerance/Math.sqrt(len2)&&Math.abs((p.x-overlap.start.x)*dy-(p.y-overlap.start.y)*dx)/Math.sqrt(len2)<=tolerance;
 };
 return {ok:true,removedIds,segments:segments.map(s=>{
  const start={x:s.x,y:s.y},end={x:s.x+s.w,y:s.y+s.h};
  return {start,end,shared:between({x:(start.x+end.x)/2,y:(start.y+end.y)/2})};
 }),nodes:segments.slice(0,-1).map(s=>({x:s.x+s.w,y:s.y+s.h}))};
}
