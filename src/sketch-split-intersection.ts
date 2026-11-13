import type {Sketch,SketchItem,SketchNode} from './sketch-engine';
import type {SketchIntersection} from './sketch-intersections';
export type SplitResult={ok:true;sketch:Sketch;nodeId:string;splitIds:string[]}|{ok:false;reason:string};
/** Split non-parametric lines at a diagnosed crossing or T junction. No silent loss of constraints. */
export function splitAtIntersection(sketch:Sketch,hit:SketchIntersection,makeId:()=>string,tolerance=1e-5):SplitResult{
 if(hit.kind==='overlap')return {ok:false,reason:'Überlappende Linien zuerst manuell bereinigen'};
 const targets=hit.itemIds.map(id=>sketch.items.find(i=>i.id===id));
 if(targets.some(i=>!i||i.kind!=='line'||i.construction))return {ok:false,reason:'Nur zwei reguläre Linien können geteilt werden'};
 const lines=targets as SketchItem[];
 const endpoint=(i:SketchItem,end:0|1)=>({x:i.x+(end?i.w:0),y:i.y+(end?i.h:0)});
 const dist=(p:{x:number;y:number})=>Math.hypot(p.x-hit.x,p.y-hit.y);
 const splits=lines.filter(i=>dist(endpoint(i,0))>tolerance&&dist(endpoint(i,1))>tolerance);
 if(!splits.length)return {ok:false,reason:'Schnittstelle liegt bereits auf beiden Endpunkten'};
 for(const line of splits){
  if(line.constraint||sketch.dimensions?.some(d=>d.itemId===line.id)||sketch.relations?.some(r=>r.sourceId===line.id||r.targetId===line.id)||sketch.junctions?.some(j=>j.sourceId===line.id||j.targetId===line.id))return {ok:false,reason:'Linie besitzt Abhängigkeiten oder Maße; zuerst diese Beziehungen auflösen'};
 }
 const newIds=new Set(sketch.items.map(i=>i.id).concat((sketch.nodes||[]).map(n=>n.id)));
 const fresh=()=>{let id=makeId(),tries=0;while(newIds.has(id)&&tries++<100)id=makeId();if(newIds.has(id)||!id)throw Error('Keine eindeutige ID');newIds.add(id);return id;};
 const replacements=new Map<string,{first:SketchItem;second:SketchItem}>();
 for(const line of splits){const secondId=fresh();replacements.set(line.id,{first:{...line,w:hit.x-line.x,h:hit.y-line.y},second:{...line,id:secondId,x:hit.x,y:hit.y,w:line.x+line.w-hit.x,h:line.y+line.h-hit.y}});}
 const items=sketch.items.flatMap(i=>{const pair=replacements.get(i.id);return pair?[pair.first,pair.second]:[i];});
 const nodes=(sketch.nodes||[]).map(n=>({...n,members:n.members.map(m=>m.end===1&&replacements.has(m.itemId)?{itemId:replacements.get(m.itemId)!.second.id,end:1 as const}:m)}));
 const members=lines.map(i=>{const pair=replacements.get(i.id);if(pair)return [{itemId:pair.first.id,end:1 as const},{itemId:pair.second.id,end:0 as const}];return [{itemId:i.id,end:dist(endpoint(i,0))<=tolerance?0 as const:1 as const}];}).flat();
 // Reuse a node already at this position, otherwise create a new shared node.
 let node=nodes.find(n=>Math.hypot(n.x-hit.x,n.y-hit.y)<=tolerance);
 if(node){const seen=new Set(node.members.map(m=>m.itemId+':'+m.end));for(const m of members)if(!seen.has(m.itemId+':'+m.end)){node.members.push(m);seen.add(m.itemId+':'+m.end);}}
 else{node={id:fresh(),x:hit.x,y:hit.y,members} as SketchNode;nodes.push(node);}
 // A member must belong to exactly one node; reject conflicting preexisting ownership.
 const owned=new Map<string,string>();for(const n of nodes)for(const m of n.members){const key=m.itemId+':'+m.end;if(owned.has(key)&&owned.get(key)!==n.id)return {ok:false,reason:'Ein Endpunkt ist bereits mit einem anderen CAD-Knoten verbunden'};owned.set(key,n.id);}
 return {ok:true,sketch:{...sketch,items,nodes},nodeId:node.id,splitIds:splits.map(i=>i.id)};
}
