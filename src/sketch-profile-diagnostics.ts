import type {Sketch} from './sketch-engine';
export type OpenEndpoint={x:number;y:number;itemIds:string[]};
export type ProfileDiagnostic={kind:'open'|'branch'|'degenerate';message:string;points:OpenEndpoint[];itemIds:string[]};
/** Inspect line connectivity without modifying geometry or inventing closed faces. */
export function diagnoseProfileChains(sk:Sketch,tolerance=0.01):ProfileDiagnostic[]{
 const lines=sk.items.filter(i=>i.kind==='line'&&!i.construction);
 const vertices:{x:number;y:number;edges:number[]}[]=[];
 const vertex=(x:number,y:number)=>{let j=vertices.findIndex(v=>Math.hypot(v.x-x,v.y-y)<=tolerance);if(j<0){j=vertices.length;vertices.push({x,y,edges:[]});}return j;};
 const edges:{id:string;a:number;b:number}[]=[];
 const diagnostics:ProfileDiagnostic[]=[];
 for(const l of lines){if(Math.hypot(l.w,l.h)<=tolerance){diagnostics.push({kind:'degenerate',message:'Linie ohne ausreichende Länge',points:[{x:l.x,y:l.y,itemIds:[l.id]}],itemIds:[l.id]});continue;}
 const a=vertex(l.x,l.y),b=vertex(l.x+l.w,l.y+l.h),index=edges.length;edges.push({id:l.id,a,b});vertices[a].edges.push(index);vertices[b].edges.push(index);}
 const visited=new Set<number>();
 for(let i=0;i<edges.length;i++){
  if(visited.has(i))continue;
  const component:number[]=[],stack=[i];visited.add(i);
  while(stack.length){const e=stack.pop()!;component.push(e);for(const v of [edges[e].a,edges[e].b])for(const neighbor of vertices[v].edges)if(!visited.has(neighbor)){visited.add(neighbor);stack.push(neighbor);}}
  const vertexIds=[...new Set(component.flatMap(e=>[edges[e].a,edges[e].b]))];
  const endpoints=vertexIds.filter(v=>vertices[v].edges.length===1);
  const branches=vertexIds.filter(v=>vertices[v].edges.length>2);
  const point=(v:number):OpenEndpoint=>({x:vertices[v].x,y:vertices[v].y,itemIds:vertices[v].edges.map(e=>edges[e].id)});
  const ids=component.map(e=>edges[e].id);
  if(branches.length)diagnostics.push({kind:'branch',message:`Verzweigung an ${branches.length} Knoten – keine einfache geschlossene Kontur`,points:branches.map(point),itemIds:ids});
  if(endpoints.length)diagnostics.push({kind:'open',message:`${endpoints.length} offene Endpunkte`,points:endpoints.map(point),itemIds:ids});
 }
 return diagnostics;
}
