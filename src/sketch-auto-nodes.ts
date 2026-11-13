import type {Sketch,SketchNode} from './sketch-engine';
export type EndpointSnap={sourceId?:string;sourceEnd?:0|1;nodeId?:string};
export function connectSnappedEndpoints(sketch:Sketch,itemId:string,start:EndpointSnap|null,end:EndpointSnap|null):Sketch{
 const nodes:SketchNode[]=(sketch.nodes||[]).map(n=>({...n,members:[...n.members]}));
 const junctions=[...(sketch.junctions||[])];
 const item=sketch.items.find(i=>i.id===itemId);
 if(!item||item.kind!=='line')return sketch;
 const endpoint=(end:0|1)=>end===0?{x:item.x,y:item.y}:{x:item.x+item.w,y:item.y+item.h};
 const memberNode=(id:string,e:0|1)=>nodes.find(n=>n.members.some(m=>m.itemId===id&&m.end===e));
 for(const [targetEnd,snap] of [[0,start],[1,end]] as const){
  if(!snap)continue;
  const sourceNode=snap.nodeId?nodes.find(n=>n.id===snap.nodeId):snap.sourceId&&snap.sourceEnd!==undefined?memberNode(snap.sourceId,snap.sourceEnd):undefined;
  const existing=memberNode(itemId,targetEnd);
  if(existing){if(sourceNode&&existing.id!==sourceNode.id){for(const m of existing.members)if(!sourceNode.members.some(x=>x.itemId===m.itemId&&x.end===m.end))sourceNode.members.push(m);nodes.splice(nodes.indexOf(existing),1);}continue;}
  if(sourceNode){sourceNode.members.push({itemId,end:targetEnd});continue;}
  if(!snap.sourceId||snap.sourceEnd===undefined||snap.sourceId===itemId)continue;
  const source=sketch.items.find(i=>i.id===snap.sourceId);
  if(!source||source.kind!=='line')continue;
  const p=snap.sourceEnd===0?{x:source.x,y:source.y}:{x:source.x+source.w,y:source.y+source.h};
  nodes.push({id:`node-${itemId}-${targetEnd}`,x:p.x,y:p.y,members:[{itemId:snap.sourceId,end:snap.sourceEnd},{itemId,end:targetEnd}]});
 }
 // Migrate legacy directed links touching newly shared endpoints: a CAD node now owns their position.
 const connected=new Set(nodes.flatMap(n=>n.members.map(m=>`${m.itemId}:${m.end}`)));
 const remaining=junctions.filter(j=>!connected.has(`${j.targetId}:${j.targetEnd}`));
 return {...sketch,nodes,junctions:remaining};
}
