import {constrain,inspectSketch,solveSketch} from './sketch-engine';
import type {Sketch,SketchItem,DrivingDimension} from './sketch-engine';

/** Validate, apply and solve a driving dimension atomically. Never silently reset an invalid edit. */
export function applyDrivingDimension(sketch:Sketch,itemId:string,valueMM:number,edge:'width'|'height'='width'):{ok:true;sketch:Sketch}|{ok:false;reason:string}{
 const item=sketch.items.find(i=>i.id===itemId);
 if(!item)return {ok:false,reason:'Objekt nicht gefunden'};
 if(!Number.isFinite(valueMM)||valueMM<=0)return {ok:false,reason:'Bitte ein positives Maß in mm eingeben'};
 if(!['line','circle','rect'].includes(item.kind))return {ok:false,reason:'Dieser Geometrietyp wird noch nicht unterstützt'};
 const units=valueMM*sketch.dpi/25.4;
 let updated:SketchItem;
 if(item.kind==='line'){
  const len=Math.hypot(item.w,item.h);
  updated=constrain({...item,w:len?item.w/len*units:units,h:len?item.h/len*units:0});
 }else if(item.kind==='circle')updated={...item,w:units};
 else updated=edge==='height'?{...item,h:Math.sign(item.h||1)*units}:{...item,w:Math.sign(item.w||1)*units};
 const kind:DrivingDimension['kind']=item.kind==='line'?'length':item.kind==='circle'?'radius':edge;
 const existing=(sketch.dimensions||[]).find(d=>d.itemId===itemId&&d.kind===kind);
 const dimensions:DrivingDimension[]=[...(sketch.dimensions||[]).filter(d=>d.id!==existing?.id),{id:existing?.id||'dim-'+itemId+'-'+kind,itemId,kind,valueMM}];
 const candidate={...sketch,items:sketch.items.map(i=>i.id===itemId?updated:i),dimensions};
 const previousIssues=new Set(inspectSketch(sketch));
 const issues=inspectSketch(candidate).filter(issue=>!previousIssues.has(issue));
 if(issues.length)return {ok:false,reason:issues[0]};
 // Rectangles with independent width/height driving dimensions are already
 // fully determined by the explicit edit. The legacy iterative solver does not
 // converge reliably for the height axis, so avoid re-solving an unconstrained rect.
 const independentRect=item.kind==='rect'&&!(sketch.relations||[]).some(r=>r.sourceId===itemId||r.targetId===itemId)&&!(sketch.nodes||[]).some(n=>n.members.some(m=>m.itemId===itemId))&&item.constraint!=='fixed';
 const solved=independentRect?{converged:true,sketch:candidate}:solveSketch(candidate);
 if(!solved.converged)return {ok:false,reason:('reason' in solved?solved.reason:undefined)||'Constraint-Solver konnte das Maß nicht anwenden'};
 const actual=solved.sketch.items.find(i=>i.id===itemId);
 if(!actual)return {ok:false,reason:'Objekt nach Berechnung nicht gefunden'};
 const actualMM=(kind==='length'?Math.hypot(actual.w,actual.h):Math.abs(kind==='height'?actual.h:actual.w))*25.4/sketch.dpi;
 if(Math.abs(actualMM-valueMM)>0.01)return {ok:false,reason:'Maß wird durch bestehende Abhängigkeiten überschrieben'};
 return {ok:true,sketch:solved.sketch};
}
