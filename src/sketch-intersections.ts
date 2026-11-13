import type {Sketch} from './sketch-engine';
export type SketchIntersection={x:number;y:number;itemIds:[string,string];kind:'cross'|'touch'|'overlap'};
/** Detect intersections between distinct non-construction line segments. Shared endpoints are allowed. */
export function detectSketchIntersections(sk:Sketch,tolerance=1e-6):SketchIntersection[]{
 const lines=sk.items.filter(i=>i.kind==='line'&&!i.construction&&Math.hypot(i.w,i.h)>tolerance);
 const out:SketchIntersection[]=[];
 const cross=(a:{x:number;y:number},b:{x:number;y:number})=>a.x*b.y-a.y*b.x;
 const near=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y)<=tolerance;
 for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
  const a=lines[i],b=lines[j],p={x:a.x,y:a.y},r={x:a.w,y:a.h},q={x:b.x,y:b.y},s={x:b.w,y:b.h};
  const d=cross(r,s),qp={x:q.x-p.x,y:q.y-p.y};
  if(Math.abs(d)<=tolerance){
   if(Math.abs(cross(qp,r))>tolerance*Math.hypot(r.x,r.y))continue;
   const rr=r.x*r.x+r.y*r.y,t0=(qp.x*r.x+qp.y*r.y)/rr,t1=t0+(s.x*r.x+s.y*r.y)/rr;
   const lo=Math.max(0,Math.min(t0,t1)),hi=Math.min(1,Math.max(t0,t1));
   if((hi-lo)*Math.hypot(r.x,r.y)>tolerance)out.push({x:p.x+(lo+hi)/2*r.x,y:p.y+(lo+hi)/2*r.y,itemIds:[a.id,b.id],kind:'overlap'});
   continue;
  }
  const t=cross(qp,s)/d,u=cross(qp,r)/d;
  const ta=tolerance/Math.hypot(r.x,r.y),tb=tolerance/Math.hypot(s.x,s.y);
  if(t< -ta||t>1+ta||u< -tb||u>1+tb)continue;
  const hit={x:p.x+t*r.x,y:p.y+t*r.y};
  const endpointsA=[p,{x:p.x+r.x,y:p.y+r.y}],endpointsB=[q,{x:q.x+s.x,y:q.y+s.y}];
  if(endpointsA.some(e=>near(e,hit))&&endpointsB.some(e=>near(e,hit)))continue;
  out.push({...hit,itemIds:[a.id,b.id],kind:t>ta&&t<1-ta&&u>tb&&u<1-tb?'cross':'touch'});
 }
 return out;
}
