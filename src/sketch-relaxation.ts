import type {Sketch,SketchItem} from './sketch-engine';

/** Experimental bidirectional geometric projection. Existing directed solver remains the default. */
export type RelaxationResult={sketch:Sketch;iterations:number;maxErrorMM:number;converged:boolean;reason?:string};
export function relaxSketch(input:Sketch, iterations=120, toleranceMM=0.01):RelaxationResult{
 const scale=25.4/input.dpi;
 if(!Number.isFinite(scale)||scale<=0)return {sketch:input,iterations:0,maxErrorMM:Infinity,converged:false,reason:'Ungültige DPI'};
 const items=input.items.map(i=>({...i}));const byId=new Map(items.map(i=>[i.id,i]));
 const movable=(i:SketchItem)=>i.constraint!=='fixed';
 const endpoint=(i:SketchItem,e:0|1):[number,number]=>e===0?[i.x,i.y]:[i.x+i.w,i.y+i.h];
 const moveEnd=(i:SketchItem,e:0|1,dx:number,dy:number)=>{if(!movable(i))return;if(e===0){i.x+=dx;i.y+=dy;i.w-=dx;i.h-=dy;}else{i.w+=dx;i.h+=dy;}};
 const shift=(i:SketchItem,dx:number,dy:number)=>{if(movable(i)){i.x+=dx;i.y+=dy;}};
 const pair=(a:SketchItem,ae:0|1,b:SketchItem,be:0|1)=>{const p=endpoint(a,ae),q=endpoint(b,be),dx=q[0]-p[0],dy=q[1]-p[1];const wa=movable(a)?(movable(b)?.5:1):0,wb=movable(b)?(movable(a)?.5:1):0;moveEnd(a,ae,dx*wa,dy*wa);moveEnd(b,be,-dx*wb,-dy*wb);};
 const orient=(a:SketchItem,b:SketchItem,perpendicular:boolean)=>{
  const la=Math.hypot(a.w,a.h),lb=Math.hypot(b.w,b.h);if(la<1e-9||lb<1e-9)return;
  const aa=Math.atan2(a.h,a.w),bb=Math.atan2(b.h,b.w);const target=aa+(perpendicular?Math.PI/2:0);
  const wrap=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
  // Lines are unoriented: choose the closest equivalent angle modulo PI.
  const delta=wrap(2*(bb-target))/2;
  const wa=movable(a)?(movable(b)?.5:1):0,wb=movable(b)?(movable(a)?.5:1):0;
  if(wa){const t=aa+delta*wa;a.w=la*Math.cos(t);a.h=la*Math.sin(t);}
  if(wb){const t=bb-delta*wb;b.w=lb*Math.cos(t);b.h=lb*Math.sin(t);}
 };
 const measure=()=>{
  let error=0;const add=(v:number)=>{error=Math.max(error,Math.abs(v));};
  for(const d of input.dimensions||[]){const i=byId.get(d.itemId);if(!i)continue;if(d.kind==='length'&&i.kind==='line')add(Math.hypot(i.w,i.h)*scale-d.valueMM);else if((d.kind==='radius'&&i.kind==='circle')||(d.kind==='width'&&i.kind==='rect'))add(Math.abs(i.w)*scale-d.valueMM);}
  for(const i of items){if(i.constraint==='horizontal'&&i.kind==='line')add(i.h*scale);if(i.constraint==='vertical'&&i.kind==='line')add(i.w*scale);}
  const pointError=(a:SketchItem,ae:0|1,b:SketchItem,be:0|1)=>{const p=endpoint(a,ae),q=endpoint(b,be);add(Math.hypot(p[0]-q[0],p[1]-q[1])*scale);};
  for(const j of input.junctions||[]){const a=byId.get(j.sourceId),b=byId.get(j.targetId);if(a?.kind==='line'&&b?.kind==='line')pointError(a,j.sourceEnd,b,j.targetEnd);}
  for(const r of input.relations||[]){const a=byId.get(r.sourceId),b=byId.get(r.targetId);if(!a||!b)continue;
   if(r.kind==='coincident'&&a.kind==='line'&&b.kind==='line')pointError(a,r.sourceEnd??1,b,r.targetEnd??0);
   if(r.kind==='concentric'&&a.kind==='circle'&&b.kind==='circle')add(Math.hypot(a.x-b.x,a.y-b.y)*scale);
   if(r.kind==='equalRadius'&&a.kind==='circle'&&b.kind==='circle')add((a.w-b.w)*scale);
   if(a.kind==='line'&&b.kind==='line'){
    if(r.kind==='equal')add((Math.hypot(a.w,a.h)-Math.hypot(b.w,b.h))*scale);
    if(r.kind==='parallel'||r.kind==='perpendicular'){const la=Math.hypot(a.w,a.h),lb=Math.hypot(b.w,b.h);if(la>1e-9&&lb>1e-9){const cross=(a.w*b.h-a.h*b.w)/(la*lb),dot=(a.w*b.w+a.h*b.h)/(la*lb);const angle=Math.asin(Math.min(1,Math.abs(r.kind==='parallel'?cross:dot)))*180/Math.PI;add(angle*scale);}}
   }
  }
  for(const node of input.nodes||[])for(const m of node.members){const i=byId.get(m.itemId);if(i?.kind==='line'){const p=endpoint(i,m.end);add(Math.hypot(p[0]-node.x,p[1]-node.y)*scale);}}
  return error;
 };
 const count=Math.max(1,Math.min(400,Math.floor(iterations)));
 for(let iteration=1;iteration<=count;iteration++){
  for(const d of input.dimensions||[]){const i=byId.get(d.itemId);if(!i||!movable(i))continue;
   if(d.kind==='length'&&i.kind==='line'){const len=Math.hypot(i.w,i.h),wanted=d.valueMM/scale;if(len>1e-9){const ratio=wanted/len;i.w*=ratio;i.h*=ratio;}}
   else if((d.kind==='radius'&&i.kind==='circle')||(d.kind==='width'&&i.kind==='rect'))i.w=Math.sign(i.w||1)*d.valueMM/scale;
  }
  for(const i of items){if(!movable(i)||i.kind!=='line')continue;if(i.constraint==='horizontal'){i.y+=i.h/2;i.h=0;}if(i.constraint==='vertical'){i.x+=i.w/2;i.w=0;}}
  for(const j of input.junctions||[]){const a=byId.get(j.sourceId),b=byId.get(j.targetId);if(a?.kind==='line'&&b?.kind==='line')pair(a,j.sourceEnd,b,j.targetEnd);}
  for(const r of input.relations||[]){const a=byId.get(r.sourceId),b=byId.get(r.targetId);if(!a||!b)continue;
   if(r.kind==='coincident'&&a.kind==='line'&&b.kind==='line')pair(a,r.sourceEnd??1,b,r.targetEnd??0);
   if(r.kind==='concentric'&&a.kind==='circle'&&b.kind==='circle'){const dx=b.x-a.x,dy=b.y-a.y;const wa=movable(a)?(movable(b)?.5:1):0,wb=movable(b)?(movable(a)?.5:1):0;shift(a,dx*wa,dy*wa);shift(b,-dx*wb,-dy*wb);}
   if(r.kind==='equalRadius'&&a.kind==='circle'&&b.kind==='circle'){const diff=b.w-a.w;if(movable(a))a.w+=diff*(movable(b)?.5:1);if(movable(b))b.w-=diff*(movable(a)?.5:1);}
   if(a.kind==='line'&&b.kind==='line'){
    if(r.kind==='parallel'||r.kind==='perpendicular')orient(a,b,r.kind==='perpendicular');
    if(r.kind==='equal'){const la=Math.hypot(a.w,a.h),lb=Math.hypot(b.w,b.h);if(la>1e-9&&lb>1e-9){const mean=(la+lb)/2;const ta=movable(a)?(movable(b)?mean:lb):la,tb=movable(b)?(movable(a)?mean:la):lb;if(movable(a)){a.w*=ta/la;a.h*=ta/la;}if(movable(b)){b.w*=tb/lb;b.h*=tb/lb;}}}
   }
  }
  for(const node of input.nodes||[])for(const m of node.members){const i=byId.get(m.itemId);if(i?.kind==='line'){const p=endpoint(i,m.end);moveEnd(i,m.end,node.x-p[0],node.y-p[1]);}}
  if(!items.every(i=>[i.x,i.y,i.w,i.h].every(Number.isFinite)))return {sketch:input,iterations:iteration,maxErrorMM:Infinity,converged:false,reason:'Numerisch ungültiges Ergebnis'};
  const maxErrorMM=measure();if(maxErrorMM<=toleranceMM)return {sketch:{...input,items},iterations:iteration,maxErrorMM,converged:true};
 }
 const maxErrorMM=measure();return {sketch:{...input,items},iterations:count,maxErrorMM,converged:false,reason:'Nicht alle Bedingungen innerhalb der Toleranz'};
}
