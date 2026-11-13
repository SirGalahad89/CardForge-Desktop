import type {Sketch,SketchProfile,SketchRegion} from './sketch-engine';

export type UnionPreview={ok:true;rings:SketchProfile[];area:number;sharedEdges:number;outerCount:number;holeCount:number}|{ok:false;reason:string};
type Point={x:number;y:number};
const signedArea=(pts:Point[])=>pts.reduce((a,p,i)=>{const q=pts[(i+1)%pts.length];return a+p.x*q.y-p.y*q.x;},0)/2;
const inside=(p:Point,polygon:Point[])=>{let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;};
/** Read-only planar union of selected regions. Requires existing split edges; never changes sketch geometry. */
export function previewProfileUnion(sketch:Sketch,regions:SketchRegion[],tolerance=0.01):UnionPreview{
 if(regions.length<2)return {ok:false,reason:'Mindestens zwei Profilflächen auswählen'};
 const selectedIds=new Set(regions.map(r=>r.id));if(selectedIds.size!==regions.length)return {ok:false,reason:'Doppelte Profilauswahl'};
 const counts=new Map<string,number>();
 for(const r of regions)for(const ring of [r.outer,...r.holes])for(const id of ring.itemIds)counts.set(id,(counts.get(id)||0)+1);
 if([...counts.values()].some(n=>n>2))return {ok:false,reason:'Mehr als zwei ausgewählte Flächen teilen eine Kante'};
 const sharedEdges=[...counts.values()].filter(n=>n===2).length;
 if(!sharedEdges)return {ok:false,reason:'Ausgewählte Flächen haben keine gemeinsame Kante'};
 const lines=new Map(sketch.items.filter(i=>i.kind==='line').map(i=>[i.id,i]));
 const boundary=[...counts].filter(([,n])=>n===1).map(([id])=>lines.get(id)).filter((x):x is NonNullable<typeof x>=>!!x);
 if(boundary.length!==[...counts.values()].filter(n=>n===1).length)return {ok:false,reason:'Nur aufgetrennte Liniensegmente können vereinigt werden'};
 const verts:Point[]=[];const vertex=(p:Point)=>{let k=verts.findIndex(v=>Math.hypot(v.x-p.x,v.y-p.y)<=tolerance);if(k<0){k=verts.length;verts.push(p);}return k;};
 const edges=boundary.map(l=>({id:l.id,a:vertex({x:l.x,y:l.y}),b:vertex({x:l.x+l.w,y:l.y+l.h})}));
 const adjacent=verts.map(()=>[] as number[]);edges.forEach((e,i)=>{adjacent[e.a].push(i);adjacent[e.b].push(i);});
 if(adjacent.some(a=>a.length!==2))return {ok:false,reason:'Außenkontur ist offen oder verzweigt; gemeinsame Kanten zuerst auftrennen'};
 const seen=new Set<number>(),rings:SketchProfile[]=[];
 for(let start=0;start<edges.length;start++){
  if(seen.has(start))continue;
  const first=edges[start].a;let at=first;let previous=-1;const points:Point[]=[],ids:string[]=[];
  for(let step=0;step<=edges.length;step++){
   if(step>0&&at===first)break;
   const next=adjacent[at].find(i=>i!==previous&&!seen.has(i));
   if(next===undefined)return {ok:false,reason:'Außenkontur konnte nicht geschlossen werden'};
   seen.add(next);points.push(verts[at]);ids.push(edges[next].id);
   at=edges[next].a===at?edges[next].b:edges[next].a;previous=next;
  }
  if(at!==first||points.length<3)return {ok:false,reason:'Ungültige oder offene Kontur'};
  const area=Math.abs(signedArea(points));if(area<=tolerance*tolerance)return {ok:false,reason:'Kontur ohne gültige Fläche'};
  rings.push({id:ids.slice().sort().join(':'),itemIds:ids,points,area});
 }
 // Each hole must be contained by another ring. Nested islands are rejected conservatively.
 const depth=rings.map((r,i)=>rings.reduce((n,other,j)=>i!==j&&other.area>r.area&&inside(r.points[0],other.points)?n+1:n,0));
 if(depth.some(n=>n>1))return {ok:false,reason:'Mehrfach verschachtelte Konturen noch nicht unterstützt'};
 const outerCount=depth.filter(n=>n===0).length,holeCount=depth.filter(n=>n===1).length;
 if(outerCount!==1)return {ok:false,reason:'Ausgewählte Profile bilden keine zusammenhängende Fläche'};
 const area=rings.reduce((n,r,i)=>n+(depth[i]===0?r.area:-r.area),0);
 return {ok:true,rings,area,sharedEdges,outerCount,holeCount};
}
