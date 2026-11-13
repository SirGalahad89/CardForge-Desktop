export type Kind='line'|'rect'|'circle'|'ellipse'|'point';
export type Constraint='horizontal'|'vertical'|'fixed';
export type Relation={id:string;kind:'parallel'|'perpendicular'|'coincident'|'equal'|'concentric'|'equalRadius'|'tangentCircles';sourceId:string;targetId:string;sourceEnd?:0|1;targetEnd?:0|1};
export type SketchItem={id:string;kind:Kind;x:number;y:number;w:number;h:number;construction:boolean;constraint?:Constraint;cornerRadius?:number};
export type Junction={id:string;sourceId:string;sourceEnd:0|1;targetId:string;targetEnd:0|1};
export type NodeMember={itemId:string;end:0|1};
export type SketchNode={id:string;x:number;y:number;members:NodeMember[]};
export type DrivingDimension={id:string;itemId:string;kind:'length'|'radius'|'width';valueMM:number};
export type Sketch={items:SketchItem[];dpi:number;dimensions?:DrivingDimension[];relations?:Relation[];junctions?:Junction[];nodes?:SketchNode[];dimensionOffsets?:Record<string,{x:number;y:number}>};
export const relationNames:Record<Relation['kind'],string>={parallel:'Parallel',perpendicular:'Senkrecht',coincident:'Endpunkt',equal:'Gleiche Länge',concentric:'Konzentrisch',equalRadius:'Gleicher Radius',tangentCircles:'Tangential'};
export const validSketch=(v:unknown):v is Sketch=>{
 if(!v||typeof v!=='object')return false;
 const s=v as Partial<Sketch>;
 if(!Number.isFinite(s.dpi)||!s.dpi||s.dpi<30||s.dpi>2400||!Array.isArray(s.items)||s.items.length>10000)return false;
 if(!s.items.every(i=>i&&typeof i.id==='string'&&['line','rect','circle','ellipse','point'].includes(i.kind)&&[i.x,i.y,i.w,i.h].every(n=>typeof n==='number'&&Number.isFinite(n))))return false;
 const ids=new Set(s.items.map(i=>i.id));if(ids.size!==s.items.length)return false;
 if(s.relations!==undefined){if(!Array.isArray(s.relations)||s.relations.length>10000)return false;
  const validKinds=['parallel','perpendicular','coincident','equal','concentric','equalRadius','tangentCircles'];
  if(!s.relations.every(r=>r&&typeof r.id==='string'&&validKinds.includes(r.kind)&&ids.has(r.sourceId)&&ids.has(r.targetId)&&r.sourceId!==r.targetId&&(r.sourceEnd===undefined||r.sourceEnd===0||r.sourceEnd===1)&&(r.targetEnd===undefined||r.targetEnd===0||r.targetEnd===1)))return false;
  if(new Set(s.relations.map(r=>r.id)).size!==s.relations.length)return false;
 }
 if(s.dimensions!==undefined){
  if(!Array.isArray(s.dimensions)||s.dimensions.length>10000)return false;
  const used=new Set<string>();
  for(const d of s.dimensions){
   const item=s.items.find(i=>i.id===d?.itemId);
   if(!d||typeof d.id!=='string'||!d.id||!item||!Number.isFinite(d.valueMM)||d.valueMM<=0||
      !((d.kind==='length'&&item.kind==='line')||(d.kind==='radius'&&item.kind==='circle')||(d.kind==='width'&&item.kind==='rect'))||used.has(d.itemId+':'+d.kind))return false;
   used.add(d.itemId+':'+d.kind);
  }
  if(new Set(s.dimensions.map(d=>d.id)).size!==s.dimensions.length)return false;
 }
 if(s.dimensionOffsets!==undefined){
  if(!s.dimensionOffsets||typeof s.dimensionOffsets!=='object'||Array.isArray(s.dimensionOffsets)||Object.keys(s.dimensionOffsets).length>10000)return false;
  for(const [id,offset] of Object.entries(s.dimensionOffsets)){
   if(!s.items.some(i=>i.id===id)||!offset||!Number.isFinite(offset.x)||!Number.isFinite(offset.y))return false;
  }
 }
 if(s.nodes!==undefined){
  if(!Array.isArray(s.nodes)||s.nodes.length>10000)return false;
  const nodeIds=new Set<string>(),members=new Set<string>();
  for(const n of s.nodes){
   if(!n||typeof n.id!=='string'||!n.id||nodeIds.has(n.id)||!Number.isFinite(n.x)||!Number.isFinite(n.y)||!Array.isArray(n.members)||n.members.length===0||n.members.length>10000)return false;
   nodeIds.add(n.id);
   for(const m of n.members){const key=m?.itemId+':'+m?.end;
    if(!m||!ids.has(m.itemId)||(m.end!==0&&m.end!==1)||s.items.find(i=>i.id===m.itemId)?.kind!=='line'||members.has(key))return false;
    members.add(key);
   }
  }
 }
 if(s.junctions!==undefined){
  if(!Array.isArray(s.junctions)||s.junctions.length>10000)return false;
  if(!s.junctions.every(j=>j&&typeof j.id==='string'&&ids.has(j.sourceId)&&ids.has(j.targetId)&&j.sourceId!==j.targetId&&(j.sourceEnd===0||j.sourceEnd===1)&&(j.targetEnd===0||j.targetEnd===1)&&s.items!.find(i=>i.id===j.sourceId)?.kind==='line'&&s.items!.find(i=>i.id===j.targetId)?.kind==='line'))return false;
  if(new Set(s.junctions.map(j=>j.id)).size!==s.junctions.length)return false;
 }
 return true;
};
export const rnd=(n:number)=>Math.round(n*100)/100;
export const constrain=(s:SketchItem):SketchItem=>s.constraint==='horizontal'&&s.kind==='line'?{...s,h:0}:s.constraint==='vertical'&&s.kind==='line'?{...s,w:0}:s;
// Directed constraint graph: evaluate sources before their dependent targets.
// Reject cyclic relationships when creating them; older cyclic documents remain safe.
export const hasCycle=(relations:Relation[]):boolean=>{
 const adj=new Map<string,string[]>();
 for(const r of relations)adj.set(r.sourceId,[...(adj.get(r.sourceId)||[]),r.targetId]);
 const active=new Set<string>(),done=new Set<string>();
 const visit=(id:string):boolean=>{if(active.has(id))return true;if(done.has(id))return false;active.add(id);for(const next of adj.get(id)||[])if(visit(next))return true;active.delete(id);done.add(id);return false;};
 return [...adj.keys()].some(visit);
};
// Topological ordering by OBJECT, then stable property order for each target.
// Position is resolved before direction, then length. This allows three
// independent incoming constraints on a line without overwriting each other.
export const relationChannel=(kind:Relation['kind'])=>
 kind==='coincident'?'position':kind==='parallel'||kind==='perpendicular'?'direction':kind==='equal'?'length':
 kind==='equalRadius'?'radius':'center';
export const orderedRelations=(relations:Relation[]):Relation[]=>{
 const nodes=new Set(relations.flatMap(r=>[r.sourceId,r.targetId]));
 const indegree=new Map([...nodes].map(id=>[id,0]));
 const outgoing=new Map<string,Relation[]>(),incoming=new Map<string,Relation[]>();
 for(const r of relations){indegree.set(r.targetId,(indegree.get(r.targetId)||0)+1);outgoing.set(r.sourceId,[...(outgoing.get(r.sourceId)||[]),r]);incoming.set(r.targetId,[...(incoming.get(r.targetId)||[]),r]);}
 const queue=[...nodes].filter(id=>indegree.get(id)===0),ordered:Relation[]=[];
 const priority=(r:Relation)=>({position:0,center:0,direction:1,length:2,radius:2}[relationChannel(r.kind)]);
 while(queue.length){const id=queue.shift()!;const outgoingRelations=outgoing.get(id)||[];
  for(const r of outgoingRelations){indegree.set(r.targetId,(indegree.get(r.targetId)||0)-1);if(indegree.get(r.targetId)===0){
   ordered.push(...(incoming.get(r.targetId)||[]).sort((a,b)=>priority(a)-priority(b)));
   queue.push(r.targetId);
  }}
 }
 return ordered;
};
// Lightweight diagnostics for directed constraints. This does not claim to solve
// general CAD systems, but prevents contradictory definitions from being accepted.
export const inspectSketch=(sk:Sketch):string[]=>{
 const problems:string[]=[];const relations=sk.relations||[];
 const byId=new Map(sk.items.map(i=>[i.id,i]));
 if(hasCycle(relations))problems.push('Zyklische Beziehungen erkannt');
 const channels=new Set<string>();
 const junctionTargets=new Set<string>();
 const nodeMembers=new Set<string>();
 for(const node of sk.nodes||[]){
  for(const member of node.members){
   const line=byId.get(member.itemId);
   if(!line||line.kind!=='line')problems.push('Knoten verweist auf ungültige Linie');
   if(line?.constraint==='fixed')problems.push('Fixierte Linie ist mit einem beweglichen Knoten verbunden');
   const key=member.itemId+':'+member.end;
   if(nodeMembers.has(key))problems.push('Linienendpunkt gehört zu mehreren Knoten');
   nodeMembers.add(key);
  }
 }
 for(const j of sk.junctions||[]){if(nodeMembers.has(j.targetId+':'+j.targetEnd))problems.push('Knoten und gerichtete Punktverbindung überschneiden sich');}
 for(const r of relations){if(r.kind==='coincident'&&nodeMembers.has(r.targetId+':'+(r.targetEnd||0)))problems.push('Knoten und Endpunkt-Abhängigkeit überschneiden sich');}
 for(const j of sk.junctions||[]){
  const a=byId.get(j.sourceId),b=byId.get(j.targetId);
  if(!a||!b||a.kind!=='line'||b.kind!=='line'){problems.push('Ungültige gemeinsame Punktgeometrie');continue;}
  const key=j.targetId+':'+j.targetEnd;
  if(junctionTargets.has(key))problems.push('Endpunkt besitzt mehrere Punktverbindungen');
  junctionTargets.add(key);
  if(b.constraint==='fixed')problems.push('Fixierter Zielendpunkt in Punktverbindung');
  if((sk.relations||[]).some(r=>r.kind==='coincident'&&r.targetId===j.targetId))problems.push('Punktverbindung und Endpunkt-Abhängigkeit überschneiden sich');
 }
 const junctionEdges=(sk.junctions||[]).map(j=>({id:j.id,kind:'coincident' as const,sourceId:j.sourceId,targetId:j.targetId}));
 if(hasCycle([...(sk.relations||[]),...junctionEdges]))problems.push('Zyklische Punktverbindungen erkannt');
 for(const d of sk.dimensions||[]){
  const item=byId.get(d.itemId);
  if(!item)continue;
  if(item.constraint==='fixed')problems.push('Fixiertes Objekt besitzt treibendes Maß');
  if(d.kind==='length'&&item.kind==='line'){
   const anchors=(sk.nodes||[]).filter(n=>n.members.some(m=>m.itemId===item.id));
   if(anchors.some(n=>n.members.some(m=>m.itemId===item.id&&m.end===0))&&anchors.some(n=>n.members.some(m=>m.itemId===item.id&&m.end===1)))
    problems.push('Linienlänge durch zwei CAD-Knoten festgelegt');
   if(relations.some(r=>r.targetId===item.id&&r.kind==='equal'))problems.push('Gleiche Länge und festes Maß widersprechen sich');
  }
  if(d.kind==='radius'&&relations.some(r=>r.targetId===item.id&&r.kind==='equalRadius'))problems.push('Gleicher Radius und festes Maß widersprechen sich');
 }
 for(const r of relations){
  const a=byId.get(r.sourceId),b=byId.get(r.targetId);
  if(!a||!b){problems.push('Verwaiste Beziehung');continue;}
  const key=r.targetId+':'+relationChannel(r.kind);
  if(channels.has(key))problems.push('Mehrere Bedingungen für dieselbe Eigenschaft von Objekt '+(sk.items.indexOf(b)+1));
  channels.add(key);
  if(b.constraint==='fixed')problems.push('Fixiertes Objekt '+(sk.items.indexOf(b)+1)+' besitzt eingehende Beziehungen');
  if((r.kind==='parallel'||r.kind==='perpendicular')&&b.constraint&&b.constraint!=='fixed'){
   const angle=Math.atan2(a.h,a.w)+(r.kind==='perpendicular'?Math.PI/2:0);
   if(b.constraint==='horizontal'&&Math.abs(Math.sin(angle))>1e-6||b.constraint==='vertical'&&Math.abs(Math.cos(angle))>1e-6)
    problems.push('Widersprüchliche Richtung bei Objekt '+(sk.items.indexOf(b)+1));
  }
  if((r.kind==='parallel'||r.kind==='perpendicular'||r.kind==='equal'||r.kind==='coincident')&&(a.kind!=='line'||b.kind!=='line'))problems.push('Linienbeziehung auf ungeeigneter Geometrie');
  if((r.kind==='concentric'||r.kind==='equalRadius'||r.kind==='tangentCircles')&&(a.kind!=='circle'||b.kind!=='circle'))problems.push('Kreisbeziehung auf ungeeigneter Geometrie');
 }
 for(const i of sk.items){if(i.kind==='line'&&Math.hypot(i.w,i.h)<1e-7)problems.push('Linie '+(sk.items.indexOf(i)+1)+' hat Länge 0');}
 return [...new Set(problems)];
};
export const resolveRelations=(sk:Sketch):Sketch=>{
 const items=sk.items.map(x=>({...x}));const get=(id:string)=>items.find(x=>x.id===id);
 for(const r of orderedRelations(sk.relations||[])){
  const a=get(r.sourceId),b=get(r.targetId);
  if(!a||!b||b.constraint==='fixed')continue;
  if(r.kind==='concentric'||r.kind==='equalRadius'||r.kind==='tangentCircles'){
   if(a.kind!=='circle'||b.kind!=='circle')continue;
   if(r.kind==='concentric'){b.x=a.x;b.y=a.y;}
   else if(r.kind==='equalRadius'){b.w=Math.abs(a.w);}
   else {const dx=b.x-a.x,dy=b.y-a.y;const theta=Math.hypot(dx,dy)>1e-8?Math.atan2(dy,dx):0;const distance=Math.abs(a.w)+Math.abs(b.w);b.x=a.x+distance*Math.cos(theta);b.y=a.y+distance*Math.sin(theta);}
   continue;
  }
  if(a.kind!=='line'||b.kind!=='line')continue;
  if(r.kind==='coincident'){
   const ax=a.x+(r.sourceEnd?a.w:0),ay=a.y+(r.sourceEnd?a.h:0);
   // Translate the whole target line, preserving length and direction.
   if(r.targetEnd){b.x=ax-b.w;b.y=ay-b.h;}else{b.x=ax;b.y=ay;}
  }else{
   const len=r.kind==='equal'?Math.hypot(a.w,a.h):Math.hypot(b.w,b.h);
   const base=Math.hypot(b.w,b.h)>1e-8?Math.atan2(b.h,b.w):Math.atan2(a.h,a.w);
   const theta=r.kind==='equal'?base:Math.atan2(a.h,a.w)+(r.kind==='perpendicular'?Math.PI/2:0);
   const nextW=len*Math.cos(theta),nextH=len*Math.sin(theta);
   // A target-end coincidence must stay anchored after changing its vector.
   const endAnchored=(sk.relations||[]).some(x=>x.targetId===b.id&&x.kind==='coincident'&&x.targetEnd===1);
   if(endAnchored){b.x+=b.w-nextW;b.y+=b.h-nextH;}
   b.w=nextW;b.h=nextH;
  }
  Object.assign(b,constrain(b));
 }
 // Shared endpoint nodes: the source endpoint is authoritative. The target
 // line is translated as a rigid segment, preserving its direction and length.
 for(const j of sk.junctions||[]){
  const a=get(j.sourceId),b=get(j.targetId);
  if(!a||!b||a.kind!=='line'||b.kind!=='line'||b.constraint==='fixed')continue;
  const px=a.x+(j.sourceEnd?a.w:0),py=a.y+(j.sourceEnd?a.h:0);
  b.x=px-(j.targetEnd?b.w:0);b.y=py-(j.targetEnd?b.h:0);
 }
 // Independent point objects are authoritative. Each attached endpoint is
 // moved onto its node while preserving the line vector; a line may attach
 // both ends, in which case its vector follows the two node positions.
 for(const node of sk.nodes||[]){
  for(const member of node.members){
   const line=get(member.itemId);
   if(!line||line.kind!=='line'||line.constraint==='fixed')continue;
   if(member.end===0){
    const endNode=(sk.nodes||[]).find(n=>n.members.some(m=>m.itemId===line.id&&m.end===1));
    if(endNode){line.x=node.x;line.y=node.y;line.w=endNode.x-node.x;line.h=endNode.y-node.y;}
    else {line.x=node.x;line.y=node.y;}
   }else{
    const startNode=(sk.nodes||[]).find(n=>n.members.some(m=>m.itemId===line.id&&m.end===0));
    if(startNode){line.x=startNode.x;line.y=startNode.y;line.w=node.x-startNode.x;line.h=node.y-startNode.y;}
    else {line.x=node.x-line.w;line.y=node.y-line.h;}
   }
  }
 }
 // Driving dimensions are projected after directed relations. CAD nodes are
 // authoritative anchors; a free end is moved while the anchored end stays put.
 for(const d of sk.dimensions||[]){
  const item=get(d.itemId);if(!item||item.constraint==='fixed')continue;
  const value=d.valueMM*sk.dpi/25.4;
  if(d.kind==='radius'&&item.kind==='circle')item.w=value;
  if(d.kind==='width'&&item.kind==='rect')item.w=Math.sign(item.w||1)*value;
  if(d.kind==='length'&&item.kind==='line'){
   const old=Math.hypot(item.w,item.h),theta=old>1e-9?Math.atan2(item.h,item.w):0;
   const w=value*Math.cos(theta),h=value*Math.sin(theta);
   const endAnchored=(sk.nodes||[]).some(n=>n.members.some(m=>m.itemId===item.id&&m.end===1));
   if(endAnchored){item.x+=item.w-w;item.y+=item.h-h;}
   item.w=w;item.h=h;
  }
 }
 return {...sk,items};
};

// Numerical verification after directed constraint propagation. Values are
// expressed in the sketch's own units (pixels); the UI converts to mm.
export type RelationResidual={id:string;kind:Relation['kind'];error:number;unit:'length'|'angle';message:string};
export const measureRelations=(sk:Sketch):RelationResidual[]=>{
 const byId=new Map(sk.items.map(i=>[i.id,i]));const result:RelationResidual[]=[];
 const norm=(x:number,y:number)=>Math.hypot(x,y);
 for(const r of sk.relations||[]){
  const a=byId.get(r.sourceId),b=byId.get(r.targetId);
  if(!a||!b)continue;
  let error=0,unit:RelationResidual['unit']='length';
  if(r.kind==='coincident'&&a.kind==='line'&&b.kind==='line'){
   error=norm(a.x+(r.sourceEnd?a.w:0)-b.x-(r.targetEnd?b.w:0),a.y+(r.sourceEnd?a.h:0)-b.y-(r.targetEnd?b.h:0));
  }else if((r.kind==='parallel'||r.kind==='perpendicular')&&a.kind==='line'&&b.kind==='line'){
   const al=norm(a.w,a.h),bl=norm(b.w,b.h);unit='angle';
   if(al<1e-9||bl<1e-9){error=180;}else{
    const dot=(a.w*b.w+a.h*b.h)/(al*bl),cross=(a.w*b.h-a.h*b.w)/(al*bl);
    error=r.kind==='parallel'?Math.asin(Math.min(1,Math.abs(cross)))*180/Math.PI:Math.asin(Math.min(1,Math.abs(dot)))*180/Math.PI;
   }
  }else if(r.kind==='equal'&&a.kind==='line'&&b.kind==='line')error=Math.abs(norm(a.w,a.h)-norm(b.w,b.h));
  else if(r.kind==='concentric'&&a.kind==='circle'&&b.kind==='circle')error=norm(a.x-b.x,a.y-b.y);
  else if(r.kind==='equalRadius'&&a.kind==='circle'&&b.kind==='circle')error=Math.abs(Math.abs(a.w)-Math.abs(b.w));
  else if(r.kind==='tangentCircles'&&a.kind==='circle'&&b.kind==='circle')error=Math.abs(norm(a.x-b.x,a.y-b.y)-Math.abs(a.w)-Math.abs(b.w));
  else continue;
  result.push({id:r.id,kind:r.kind,error,unit,message:relationNames[r.kind]});
 }
 for(const j of sk.junctions||[]){
  const a=byId.get(j.sourceId),b=byId.get(j.targetId);
  if(!a||!b)continue;
  result.push({id:j.id,kind:'coincident',error:norm(a.x+(j.sourceEnd?a.w:0)-b.x-(j.targetEnd?b.w:0),a.y+(j.sourceEnd?a.h:0)-b.y-(j.targetEnd?b.h:0)),unit:'length',message:'Gemeinsamer Punkt'});
 }
 for(const node of sk.nodes||[]){for(const m of node.members){
  const line=byId.get(m.itemId);if(!line)continue;
  result.push({id:node.id+':'+m.itemId+':'+m.end,kind:'coincident',error:norm(node.x-line.x-(m.end?line.w:0),node.y-line.y-(m.end?line.h:0)),unit:'length',message:'CAD-Knoten'});
 }}
 for(const d of sk.dimensions||[]){
  const item=byId.get(d.itemId);if(!item)continue;
  const measured=d.kind==='length'?Math.hypot(item.w,item.h):Math.abs(item.w);
  result.push({id:d.id,kind:'equal',error:Math.abs(measured-d.valueMM*sk.dpi/25.4),unit:'length',message:'Treibendes Maß'});
 }
 return result;
};
export const verifyRelations=(sk:Sketch,toleranceMM=0.01,angleToleranceDeg=0.01):RelationResidual[]=>
 measureRelations(sk).filter(r=>r.error>(r.unit==='angle'?angleToleranceDeg:toleranceMM*sk.dpi/25.4));

// Bounded, deterministic projection loop for the existing directed relations.
// This is intentionally NOT a bidirectional nonlinear CAD solver.
export type SolveReport={sketch:Sketch;iterations:number;converged:boolean;maxLengthErrorMM:number;maxAngleErrorDeg:number;reason?:string};
export const solveSketch=(input:Sketch,maxIterations=12,toleranceMM=0.01,angleToleranceDeg=0.01):SolveReport=>{
 const problems=inspectSketch(input);
 if(input.items.some(i=>!Number.isFinite(Math.hypot(i.w,i.h))||!Number.isFinite(Math.hypot(i.x,i.y))))problems.unshift('Numerisch ungültige Eingabegeometrie');
 if(problems.length)return {sketch:input,iterations:0,converged:false,maxLengthErrorMM:0,maxAngleErrorDeg:0,reason:problems[0]};
 const limit=Math.max(1,Math.min(100,Math.floor(maxIterations)||1));
 let current:Sketch={...input,items:input.items.map(i=>({...i})),relations:(input.relations||[]).map(r=>({...r})),junctions:(input.junctions||[]).map(j=>({...j})),nodes:(input.nodes||[]).map(n=>({...n,members:n.members.map(m=>({...m}))}))};
 for(let iteration=1;iteration<=limit;iteration++){
  const next=resolveRelations(current);
  if(!next.items.every(i=>[i.x,i.y,i.w,i.h].every(Number.isFinite)))
   return {sketch:input,iterations:iteration,converged:false,maxLengthErrorMM:0,maxAngleErrorDeg:0,reason:'Numerisch ungültige Geometrie'};
  const residuals=measureRelations(next);
  const maxLengthErrorMM=Math.max(0,...residuals.filter(r=>r.unit==='length').map(r=>r.error*25.4/next.dpi));
  const maxAngleErrorDeg=Math.max(0,...residuals.filter(r=>r.unit==='angle').map(r=>r.error));
  if(maxLengthErrorMM<=toleranceMM&&maxAngleErrorDeg<=angleToleranceDeg)
   return {sketch:next,iterations:iteration,converged:true,maxLengthErrorMM,maxAngleErrorDeg};
  current=next;
 }
 const residuals=measureRelations(current);
 return {sketch:current,iterations:limit,converged:false,
  maxLengthErrorMM:Math.max(0,...residuals.filter(r=>r.unit==='length').map(r=>r.error*25.4/current.dpi)),
  maxAngleErrorDeg:Math.max(0,...residuals.filter(r=>r.unit==='angle').map(r=>r.error)),
  reason:'Toleranz nach maximaler Iterationszahl nicht erreicht'};
};

/** Closed, non-self-intersecting profiles made from line segments. Coordinates use sketch pixels. */
export type SketchProfile={id:string;itemIds:string[];points:{x:number;y:number}[];area:number};
export const detectClosedProfiles=(sk:Sketch,tolerance=0.01):SketchProfile[]=>{
 const lines=sk.items.filter(i=>i.kind==='line'&&!i.construction&&Math.hypot(i.w,i.h)>tolerance);
 type Vertex={x:number;y:number;edges:number[]};
 const vertices:Vertex[]=[];
 const vertex=(x:number,y:number)=>{let n=vertices.findIndex(v=>Math.hypot(v.x-x,v.y-y)<=tolerance);if(n<0){n=vertices.length;vertices.push({x,y,edges:[]});}return n;};
 const edges=lines.map((line)=>({id:line.id,a:vertex(line.x,line.y),b:vertex(line.x+line.w,line.y+line.h)}));
 edges.forEach((e,i)=>{vertices[e.a].edges.push(i);vertices[e.b].edges.push(i);});
 const seen=new Set<number>(),profiles:SketchProfile[]=[];
 const crosses=(a:{x:number;y:number},b:{x:number;y:number},c:{x:number;y:number},d:{x:number;y:number})=>{
  const orient=(p:typeof a,q:typeof a,r:typeof a)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const x=orient(a,b,c),y=orient(a,b,d),z=orient(c,d,a),w=orient(c,d,b);
  return x*y< -1e-8&&z*w< -1e-8;
 };
 edges.forEach((edge,start)=>{
  if(seen.has(start))return;
  const component:number[]=[],queue=[start];seen.add(start);
  while(queue.length){const k=queue.pop()!;component.push(k);for(const v of [edges[k].a,edges[k].b])for(const next of vertices[v].edges)if(!seen.has(next)){seen.add(next);queue.push(next);}}
  const used=new Set(component.flatMap(k=>[edges[k].a,edges[k].b]));
  if(component.length<3||component.length!==used.size||[...used].some(v=>vertices[v].edges.filter(k=>component.includes(k)).length!==2))return;
  const points:{x:number;y:number}[]=[],ids:string[]=[];let current=edges[start].a,previous=-1;
  for(let step=0;step<component.length;step++){
   points.push({x:vertices[current].x,y:vertices[current].y});
   const next=vertices[current].edges.find(k=>k!==previous&&component.includes(k));if(next===undefined)return;
   ids.push(edges[next].id);current=edges[next].a===current?edges[next].b:edges[next].a;previous=next;
  }
  if(current!==edges[start].a)return;
  for(let i=0;i<points.length;i++)for(let j=i+2;j<points.length;j++){
   if(i===0&&j===points.length-1)continue;
   if(crosses(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))return;
  }
  const signed=points.reduce((sum,p,i)=>sum+p.x*points[(i+1)%points.length].y-p.y*points[(i+1)%points.length].x,0)/2;
  if(Math.abs(signed)<=tolerance*tolerance)return;
  profiles.push({id:ids.slice().sort().join(':'),itemIds:ids,points,area:Math.abs(signed)});
 });
 return profiles;
};

/** Independent nested polygon rings. A region is an outer ring with its direct inner holes. */
export type SketchRegion={id:string;outer:SketchProfile;holes:SketchProfile[];area:number};
export const detectProfileRegions=(sk:Sketch,tolerance=0.01):SketchRegion[]=>{
 const rings=detectClosedProfiles(sk,tolerance);
 const inside=(p:{x:number;y:number},polygon:{x:number;y:number}[])=>{
  let hit=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
   const a=polygon[i],b=polygon[j];
   if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
  }
  return hit;
 };
 const intersects=(a:SketchProfile,b:SketchProfile)=>{
  const cross=(p:{x:number;y:number},q:typeof p,r:typeof p)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  for(let i=0;i<a.points.length;i++)for(let j=0;j<b.points.length;j++){
   const p=a.points[i],q=a.points[(i+1)%a.points.length],r=b.points[j],s=b.points[(j+1)%b.points.length];
   if(cross(p,q,r)*cross(p,q,s)<-1e-8&&cross(r,s,p)*cross(r,s,q)<-1e-8)return true;
  }
  return false;
 };
 const parent=rings.map((ring,i)=>{
  const candidates=rings.map((other,j)=>({other,j})).filter(({other,j})=>j!==i&&other.area>ring.area&&inside(ring.points[0],other.points)&&!intersects(ring,other));
  candidates.sort((a,b)=>a.other.area-b.other.area);
  return candidates.length?candidates[0].j:-1;
 });
 const depth=(i:number):number=>{let d=0,p=parent[i];while(p!==-1&&d<=rings.length){d++;p=parent[p];}return d;};
 return rings.flatMap((outer,i)=>depth(i)%2===0?[{id:outer.id,outer,holes:rings.filter((_,j)=>parent[j]===i&&depth(j)%2===1),area:outer.area-rings.reduce((sum,r,j)=>sum+(parent[j]===i&&depth(j)%2===1?r.area:0),0)}]:[]);
};

/** Bounded faces of a planar line graph, including shared edges and junctions.
 * Input segments must already be split at intersections; unsplit crossings and
 * overlapping segments are rejected rather than silently creating false faces.
 * This is intentionally separate from the legacy simple-ring detector. */
export const detectPlanarFaces=(sk:Sketch,tolerance=0.01):SketchProfile[]=>{
 const lines=sk.items.filter(i=>i.kind==='line'&&!i.construction&&Math.hypot(i.w,i.h)>tolerance);
 type V={x:number;y:number;out:number[]};
 type H={from:number;to:number;lineId:string;reverse:number;angle:number};
 const vertices:V[]=[],halves:H[]=[];
 const vertex=(x:number,y:number)=>{let k=vertices.findIndex(v=>Math.hypot(v.x-x,v.y-y)<=tolerance);if(k<0){k=vertices.length;vertices.push({x,y,out:[]});}return k;};
 for(const l of lines){const a=vertex(l.x,l.y),b=vertex(l.x+l.w,l.y+l.h);if(a===b)continue;
  const k=halves.length;halves.push({from:a,to:b,lineId:l.id,reverse:k+1,angle:Math.atan2(vertices[b].y-vertices[a].y,vertices[b].x-vertices[a].x)},
   {from:b,to:a,lineId:l.id,reverse:k,angle:Math.atan2(vertices[a].y-vertices[b].y,vertices[a].x-vertices[b].x)});
  vertices[a].out.push(k);vertices[b].out.push(k+1);
 }
 const cross=(a:V,b:V,c:V)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 const onSegment=(p:V,a:V,b:V)=>Math.abs(cross(a,b,p))<=tolerance*Math.hypot(b.x-a.x,b.y-a.y)&&p.x>=Math.min(a.x,b.x)-tolerance&&p.x<=Math.max(a.x,b.x)+tolerance&&p.y>=Math.min(a.y,b.y)-tolerance&&p.y<=Math.max(a.y,b.y)+tolerance;
 for(let i=0;i<halves.length;i+=2)for(let j=i+2;j<halves.length;j+=2){
  const a=vertices[halves[i].from],b=vertices[halves[i].to],c=vertices[halves[j].from],d=vertices[halves[j].to];
  const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
  if(x*y< -tolerance*tolerance&&z*w< -tolerance*tolerance)return [];
  // Collinear overlaps, or a segment endpoint inside another unsplit segment.
  const inner=(p:V,q:V,r:V)=>onSegment(p,q,r)&&Math.hypot(p.x-q.x,p.y-q.y)>tolerance&&Math.hypot(p.x-r.x,p.y-r.y)>tolerance;
  if(inner(a,c,d)||inner(b,c,d)||inner(c,a,b)||inner(d,a,b))return [];
  if(Math.abs(x)<=tolerance&&Math.abs(y)<=tolerance&&Math.abs(z)<=tolerance&&Math.abs(w)<=tolerance&&
   (onSegment(a,c,d)&&onSegment(b,c,d)||onSegment(c,a,b)&&onSegment(d,a,b)))return [];
 }
 vertices.forEach(v=>v.out.sort((a,b)=>halves[a].angle-halves[b].angle));
 const visited=new Set<number>(),faces:SketchProfile[]=[];
 for(let start=0;start<halves.length;start++){
  if(visited.has(start))continue;
  const path:number[]=[],seen=new Set<number>();let h=start,closed=false;
  for(let k=0;k<=halves.length;k++){
   if(seen.has(h)){closed=h===start;break;}
   seen.add(h);visited.add(h);path.push(h);
   const edge=halves[h],out=vertices[edge.to].out,idx=out.indexOf(edge.reverse);
   if(idx<0)break;
   // At each vertex take the clockwise predecessor of the reverse half-edge.
   h=out[(idx-1+out.length)%out.length];
  }
  if(!closed||path.length<3)continue;
  const points=path.map(k=>({x:vertices[halves[k].from].x,y:vertices[halves[k].from].y}));
  const area=points.reduce((sum,p,i)=>sum+p.x*points[(i+1)%points.length].y-p.y*points[(i+1)%points.length].x,0)/2;
  if(area<=tolerance*tolerance)continue; // discard the unbounded face
  const ids=path.map(k=>halves[k].lineId);
  faces.push({id:'face:'+ids.slice().sort().join(':'),itemIds:ids,points,area});
 }
 return faces;
};

/** Keep established nested-hole behavior for disjoint rings; use bounded faces
 * when a connected line network contains shared edges / branch vertices. */
export const detectTopologyRegions=(sk:Sketch,tolerance=0.01):SketchRegion[]=>{
 // Native rectangle objects are closed profiles in their own right. Unlike
 // four independent lines, they must not depend on the line-graph detector.
 const rectangles:SketchRegion[]=sk.items.filter(item=>item.kind==='rect'&&!item.construction&&Math.abs(item.w)>tolerance&&Math.abs(item.h)>tolerance).map(item=>{
  const x0=Math.min(item.x,item.x+item.w),x1=Math.max(item.x,item.x+item.w);
  const y0=Math.min(item.y,item.y+item.h),y1=Math.max(item.y,item.y+item.h);
  const outer:SketchProfile={id:'rect:'+item.id,itemIds:[item.id],points:[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}],area:(x1-x0)*(y1-y0)};
  return {id:outer.id,outer,holes:[],area:outer.area};
 });
 const traditional=detectProfileRegions(sk,tolerance);
 const faces=detectPlanarFaces(sk,tolerance);
 if(!faces.length)return [...traditional,...rectangles];
 const traditionalIds=new Set(traditional.flatMap(r=>[...r.outer.itemIds,...r.holes.flatMap(h=>h.itemIds)]));
 const extra=faces.filter(f=>!f.itemIds.every(id=>traditionalIds.has(id)));
 if(!extra.length)return [...traditional,...rectangles];
 return [...traditional,...extra.map(outer=>({id:outer.id,outer,holes:[],area:outer.area})),...rectangles];
};

/** Conservative, local mobility estimate. It deliberately never claims that a
 * relationship-driven object is fully constrained without an explicit lock.
 * A future Jacobian/rank solver can replace this diagnostic API. */
export type MobilityReport={itemId:string;state:'fixed'|'partial'|'free';freeParameters:number;totalParameters:number;reasons:string[]};
export function inspectMobility(sk:Sketch):MobilityReport[]{
 const dimensions=sk.dimensions||[],relations=sk.relations||[],nodes=sk.nodes||[];
 return sk.items.map(item=>{
  const totalParameters=item.kind==='point'?2:item.kind==='line'?4:item.kind==='circle'?3:4;
  if(item.constraint==='fixed')return {itemId:item.id,state:'fixed' as const,freeParameters:0,totalParameters,reasons:['Explizit fixiert']};
  const reasons:string[]=[];let constrained=0;
  const incoming=relations.filter(r=>r.targetId===item.id);
  if(item.kind==='line'){
   const ends=[0,1] as const;
   const anchored=ends.filter(end=>nodes.some(n=>n.members.some(m=>m.itemId===item.id&&m.end===end)));
   constrained+=anchored.length*2;
   if(anchored.length)reasons.push(`${anchored.length} Endpunkt(e) an CAD-Knoten`);
   if(!anchored.length&&((sk.junctions||[]).some(j=>j.targetId===item.id)||incoming.some(r=>r.kind==='coincident'))){constrained+=2;reasons.push('Gerichtete Punktverbindung');}
   if(item.constraint==='horizontal'||item.constraint==='vertical'){constrained++;reasons.push('Ausrichtung');}
   else if(incoming.some(r=>r.kind==='parallel'||r.kind==='perpendicular')){constrained++;reasons.push('Referenzrichtung');}
   if(dimensions.some(d=>d.itemId===item.id&&d.kind==='length')||incoming.some(r=>r.kind==='equal')){constrained++;reasons.push('Längenvorgabe');}
  }else if(item.kind==='circle'){
   if(incoming.some(r=>r.kind==='concentric'||r.kind==='tangentCircles')){constrained+=2;reasons.push('Referenzmittelpunkt');}
   if(incoming.some(r=>r.kind==='equalRadius')||dimensions.some(d=>d.itemId===item.id&&d.kind==='radius')){constrained++;reasons.push('Radiusvorgabe');}
  }else if(item.kind==='rect'){
   if(dimensions.some(d=>d.itemId===item.id&&d.kind==='width')){constrained++;reasons.push('Breitenvorgabe');}
  }
  const freeParameters=Math.max(0,totalParameters-constrained);
  // A local zero count is not a proof of global rigidity: dependencies can move.
  const state=constrained===0?'free' as const:'partial' as const;
  return {itemId:item.id,state,freeParameters,totalParameters,reasons};
 });
}

/** Experimental global constraint-rank diagnostic. Coordinates are expressed in
 * millimetres; fixed objects are removed from the variable vector. This
 * analyses local linear independence, not nonlinear global uniqueness. */
export type RankDiagnosis={variables:number;rank:number;degreesOfFreedom:number;equations:number;redundantEquations:number;maxResidual:number;status:'underconstrained'|'locally-constrained'|'inconsistent';warnings:string[]};
export function inspectConstraintRank(sk:Sketch):RankDiagnosis{
 const px=25.4/sk.dpi, items=sk.items, ids=new Map(items.map((it,i)=>[it.id,i]));
 const coordinates=items.map(it=>[it.x*px,it.y*px,it.w*px,it.h*px]);
 const dimensions=sk.dimensions||[];
 const vars:{i:number;k:number}[]=[];
 items.forEach((it,i)=>{if(it.constraint==='fixed')return;for(let k=0;k<(it.kind==='point'?2:it.kind==='circle'?3:4);k++)vars.push({i,k});});
 const base=vars.map(({i,k})=>coordinates[i][k]);
 const get=(v:number[],id:string)=>{const i=ids.get(id);if(i===undefined)return undefined;const p=coordinates[i].slice();vars.forEach(({i:vi,k},j)=>{if(vi===i)p[k]=v[j];});return p;};
 const equations:((v:number[])=>number)[]=[];
 const endpoint=(p:number[],end:0|1)=>end===0?[p[0],p[1]]:[p[0]+p[2],p[1]+p[3]];
 const addPair=(f:(v:number[])=>number[])=>{equations.push(v=>f(v)[0],v=>f(v)[1]);};
 items.forEach(it=>{
  if(it.constraint==='horizontal'&&it.kind==='line')equations.push(v=>get(v,it.id)![3]);
  if(it.constraint==='vertical'&&it.kind==='line')equations.push(v=>get(v,it.id)![2]);
 });
 dimensions.forEach(d=>{const it=items[ids.get(d.itemId)??-1];if(!it)return;
  if(d.kind==='length')equations.push(v=>{const p=get(v,d.itemId)!;return Math.hypot(p[2],p[3])-d.valueMM;});
  if(d.kind==='radius')equations.push(v=>get(v,d.itemId)![2]-d.valueMM);
  if(d.kind==='width')equations.push(v=>get(v,d.itemId)![2]-d.valueMM);
 });
 (sk.nodes||[]).forEach(node=>node.members.forEach(m=>addPair(v=>{const p=get(v,m.itemId)!;const e=endpoint(p,m.end);return [e[0]-node.x*px,e[1]-node.y*px];})));
 (sk.junctions||[]).forEach(j=>addPair(v=>{const a=endpoint(get(v,j.sourceId)!,j.sourceEnd),b=endpoint(get(v,j.targetId)!,j.targetEnd);return [b[0]-a[0],b[1]-a[1]];}));
 (sk.relations||[]).forEach(r=>{
  const a=items[ids.get(r.sourceId)??-1],b=items[ids.get(r.targetId)??-1];if(!a||!b)return;
  if(r.kind==='coincident')addPair(v=>{const p=endpoint(get(v,r.sourceId)!,r.sourceEnd??1),q=endpoint(get(v,r.targetId)!,r.targetEnd??0);return [p[0]-q[0],p[1]-q[1]];});
  if(r.kind==='concentric')addPair(v=>{const p=get(v,r.sourceId)!,q=get(v,r.targetId)!;return [p[0]-q[0],p[1]-q[1]];});
  if(r.kind==='equalRadius')equations.push(v=>get(v,r.sourceId)![2]-get(v,r.targetId)![2]);
  if(r.kind==='equal')equations.push(v=>{const p=get(v,r.sourceId)!,q=get(v,r.targetId)!;return Math.hypot(p[2],p[3])-Math.hypot(q[2],q[3]);});
  if(r.kind==='parallel'||r.kind==='perpendicular')equations.push(v=>{const p=get(v,r.sourceId)!,q=get(v,r.targetId)!;const la=Math.hypot(p[2],p[3]),lb=Math.hypot(q[2],q[3]);if(la<1e-9||lb<1e-9)return 0;return (r.kind==='parallel'?p[2]*q[3]-p[3]*q[2]:p[2]*q[2]+p[3]*q[3])/(la*lb);});
  if(r.kind==='tangentCircles')equations.push(v=>{const p=get(v,r.sourceId)!,q=get(v,r.targetId)!;return Math.hypot(p[0]-q[0],p[1]-q[1])-Math.abs(p[2])-Math.abs(q[2]);});
 });
 const residual=equations.map(f=>f(base));const maxResidual=Math.max(0,...residual.map(x=>Math.abs(x)));
 const h=1e-5;const matrix=equations.map(f=>vars.map((_,j)=>{const plus=base.slice(),minus=base.slice();plus[j]+=h;minus[j]-=h;return (f(plus)-f(minus))/(2*h);}));
 let rank=0;const cols=vars.length;for(let col=0;col<cols&&rank<matrix.length;col++){
  let pivot=rank;for(let r=rank+1;r<matrix.length;r++)if(Math.abs(matrix[r][col])>Math.abs(matrix[pivot][col]))pivot=r;
  if(Math.abs(matrix[pivot][col])<1e-7)continue;
  [matrix[rank],matrix[pivot]]=[matrix[pivot],matrix[rank]];
  const scale=matrix[rank][col];for(let c=col;c<cols;c++)matrix[rank][c]/=scale;
  for(let r=rank+1;r<matrix.length;r++){const factor=matrix[r][col];for(let c=col;c<cols;c++)matrix[r][c]-=factor*matrix[rank][c];}rank++;
 }
 const warnings:string[]=[];
 if(maxResidual>0.01)warnings.push('Mindestens eine geometrische Bedingung ist derzeit nicht erfüllt');
 if(equations.length>rank)warnings.push('Abhängige oder redundante Gleichungen erkannt');
 warnings.push('Experimentelle lokale Rangprüfung; keine vollständige CAD-Solver-Zertifizierung');
 return {variables:vars.length,rank,degreesOfFreedom:vars.length-rank,equations:equations.length,redundantEquations:equations.length-rank,maxResidual,status:maxResidual>0.01?'inconsistent':vars.length>rank?'underconstrained':'locally-constrained',warnings};
}

/** Select the smallest containing bounded face; holes are never selectable. */
export const regionAtPoint=(regions:SketchRegion[],point:{x:number;y:number},tolerance=1e-7):SketchRegion|undefined=>{
 const onSegment=(a:typeof point,b:typeof point)=>{
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
  if(l2===0)return Math.hypot(point.x-a.x,point.y-a.y)<=tolerance;
  const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/l2));
  return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy)<=tolerance;
 };
 const contains=(poly:{x:number;y:number}[])=>{
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
   const a=poly[j],b=poly[i];
   if(onSegment(a,b))return true;
   if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
 };
 return regions.filter(r=>contains(r.outer.points)&&!r.holes.some(h=>contains(h.points))).sort((a,b)=>a.area-b.area)[0];
};
