import type {Sketch} from './sketch-engine';
import {diagnoseProfileChains} from './sketch-profile-diagnostics';
import {connectSnappedEndpoints} from './sketch-auto-nodes';

export type RepairEndpoint={itemId:string;end:0|1;x:number;y:number};
export type RepairSuggestion={id:string;a:RepairEndpoint;b:RepairEndpoint;distance:number};
/** Suggestions only: no geometry is changed until a user explicitly accepts one. */
export function suggestEndpointRepairs(sketch:Sketch,maxDistance:number,tolerance=0.01):RepairSuggestion[]{
 if(!(maxDistance>tolerance))return [];
 const open=diagnoseProfileChains(sketch,tolerance).filter(d=>d.kind==='open').flatMap(d=>d.points);
 const endpoints:RepairEndpoint[]=[];
 for(const p of open){for(const id of p.itemIds){const item=sketch.items.find(i=>i.id===id&&i.kind==='line'&&!i.construction);if(!item)continue;
  for(const end of [0,1] as const){const x=item.x+(end?item.w:0),y=item.y+(end?item.h:0);if(Math.hypot(x-p.x,y-p.y)<=tolerance&&!endpoints.some(e=>e.itemId===id&&e.end===end))endpoints.push({itemId:id,end,x,y});}
 }}
 const result:RepairSuggestion[]=[];
 for(let i=0;i<endpoints.length;i++)for(let j=i+1;j<endpoints.length;j++){
  const a=endpoints[i],b=endpoints[j];if(a.itemId===b.itemId)continue;
  const distance=Math.hypot(a.x-b.x,a.y-b.y);
  if(distance>tolerance&&distance<=maxDistance)result.push({id:`${a.itemId}:${a.end}|${b.itemId}:${b.end}`,a,b,distance});
 }
 return result.sort((a,b)=>a.distance-b.distance);
}
/** Snap the movable endpoint to the stationary one and create a shared CAD node. */
export function applyEndpointRepair(sketch:Sketch,suggestion:RepairSuggestion):{sketch:Sketch;error?:string}{
 const a=sketch.items.find(i=>i.id===suggestion.a.itemId),b=sketch.items.find(i=>i.id===suggestion.b.itemId);
 if(!a||!b||a.kind!=='line'||b.kind!=='line'||a.id===b.id)return {sketch,error:'Linien nicht mehr vorhanden'};
 const endpoint=(item:typeof a,end:0|1)=>({x:item.x+(end?item.w:0),y:item.y+(end?item.h:0)});
 const pa=endpoint(a,suggestion.a.end),pb=endpoint(b,suggestion.b.end);
 if(Math.hypot(pa.x-pb.x,pa.y-pb.y)<1e-8)return {sketch,error:'Endpunkte liegen bereits zusammen'};
 const nodes=sketch.nodes||[];
 const linked=(id:string,end:0|1)=>nodes.some(n=>n.members.some(m=>m.itemId===id&&m.end===end));
 const moveA=b.constraint==='fixed'||linked(b.id,suggestion.b.end);
 const moving=moveA?a:b,stationary=moveA?b:a;
 const movingEnd=moveA?suggestion.a.end:suggestion.b.end,stationaryEnd=moveA?suggestion.b.end:suggestion.a.end;
 if(moving.constraint==='fixed'||linked(moving.id,movingEnd))return {sketch,error:'Beide Endpunkte sind fixiert oder an CAD-Knoten gebunden'};
 const target=endpoint(stationary,stationaryEnd),old=endpoint(moving,movingEnd);
 const dx=target.x-old.x,dy=target.y-old.y;
 const updated={...moving,...(movingEnd===0?{x:moving.x+dx,y:moving.y+dy,w:moving.w-dx,h:moving.h-dy}:{w:moving.w+dx,h:moving.h+dy})};
 if(Math.hypot(updated.w,updated.h)<1e-8)return {sketch,error:'Verbindung würde eine Linie auf Länge null reduzieren'};
 if(updated.constraint==='horizontal'&&Math.abs(updated.h)>1e-7||updated.constraint==='vertical'&&Math.abs(updated.w)>1e-7)return {sketch,error:'Verbindung widerspricht der Linienausrichtung'};
 if((sketch.dimensions||[]).some(d=>d.itemId===moving.id))return {sketch,error:'Bewegte Linie besitzt ein treibendes Maß'};
 const candidate={...sketch,items:sketch.items.map(i=>i.id===moving.id?updated:i)};
 const connected=connectSnappedEndpoints(candidate,moving.id,movingEnd===0?{sourceId:stationary.id,sourceEnd:stationaryEnd}:null,movingEnd===1?{sourceId:stationary.id,sourceEnd:stationaryEnd}:null);
 return {sketch:connected};
}
