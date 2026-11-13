/** Dissolve a collection of non-overlapping convex intersection pieces into
 * boundary loops. Collinear T junctions are split before internal edges cancel.
 * Does not mutate the supplied pieces. */
export type Point={x:number;y:number};
export type ContourRegion={outer:Point[];holes:Point[][];area:number};
export type Dissolved={ok:true;rings:Point[][];regions:ContourRegion[];area:number;holeCount:number}|{ok:false;reason:string};
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const area=(p:Point[])=>p.reduce((s,v,i)=>{const q=p[(i+1)%p.length];return s+v.x*q.y-v.y*q.x;},0)/2;
export function dissolveContourPieces(pieces:readonly (readonly Point[])[],tol=0.01):Dissolved{
 if(!pieces.length||!Number.isFinite(tol)||tol<=0)return {ok:false,reason:'Keine gültigen Teilflächen'};
 const clean=pieces.map(poly=>poly.map(p=>({...p})));
 if(clean.some(p=>p.length<3||p.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y))||Math.abs(area(p))<=tol*tol))return {ok:false,reason:'Ungültige Teilkontur'};
 const oriented=clean.map(p=>area(p)<0?p.reverse():p);
 const edges=oriented.flatMap(p=>p.map((a,i)=>({a,b:p[(i+1)%p.length]})));
 const vertices=edges.flatMap(e=>[e.a,e.b]);
 const key=(p:Point)=>`${Math.round(p.x/tol)},${Math.round(p.y/tol)}`;
 const edgeKey=(a:Point,b:Point)=>key(a)+'>'+key(b);
 const count=new Map<string,{a:Point;b:Point;count:number}>();
 for(const {a,b} of edges){
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
  if(l2<=tol*tol)continue;
  const cuts=[{t:0,p:a},{t:1,p:b}];
  for(const p of vertices){const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/l2;
   if(t>tol/Math.sqrt(l2)&&t<1-tol/Math.sqrt(l2)&&Math.abs(cross(a,b,p))/Math.sqrt(l2)<=tol*0.25)cuts.push({t,p});
  }
  cuts.sort((x,y)=>x.t-y.t);
  for(let i=1;i<cuts.length;i++){
   const u=cuts[i-1].p,v=cuts[i].p;if(Math.hypot(u.x-v.x,u.y-v.y)<=tol)continue;
   const forward=edgeKey(u,v),back=edgeKey(v,u);
   const opposite=count.get(back);
   if(opposite&&opposite.count>0){opposite.count--;continue;}
   const old=count.get(forward);if(old)old.count++;else count.set(forward,{a:u,b:v,count:1});
  }
 }
 const boundary=[...count.values()].flatMap(e=>Array.from({length:e.count},()=>({a:e.a,b:e.b})));
 if(!boundary.length)return {ok:false,reason:'Keine äußere Kontur gefunden'};
 const outgoing=new Map<string,number[]>();boundary.forEach((e,i)=>outgoing.set(key(e.a),[...(outgoing.get(key(e.a))||[]),i]));
 const visited=new Set<number>(),rings:Point[][]=[];
 for(let start=0;start<boundary.length;start++){
  if(visited.has(start))continue;
  const ring:Point[]=[];let current=start,closed=false;
  for(let k=0;k<=boundary.length;k++){
   if(visited.has(current))break;
   visited.add(current);const e=boundary[current];ring.push(e.a);
   if(key(e.b)===key(boundary[start].a)){closed=true;break;}
   const candidates=(outgoing.get(key(e.b))||[]).filter(i=>!visited.has(i));
   if(candidates.length!==1)return {ok:false,reason:'Verzweigte oder offene Kontur – nicht eindeutig verschmelzbar'};
   current=candidates[0];
  }
  if(!closed||ring.length<3)return {ok:false,reason:'Offene Kontur bei der Verschmelzung'};
  const simplified=ring.filter((p,i)=>{const prev=ring[(i+ring.length-1)%ring.length],next=ring[(i+1)%ring.length];return Math.abs(cross(prev,p,next))>tol*Math.max(Math.hypot(next.x-prev.x,next.y-prev.y),1)*0.25;});
  rings.push(simplified.length>=3?simplified:ring);
 }
 const signed=rings.map(area);const total=signed.reduce((a,b)=>a+b,0);
 if(total<=tol*tol)return {ok:false,reason:'Keine positive Ergebnisfläche'};
 // Group negative (clockwise) rings with the smallest containing positive ring.
 // This makes the hole/outer relationship explicit for downstream rendering.
 const positive=rings.map((r,i)=>({ring:r,i})).filter(({i})=>signed[i]>0);
 const negative=rings.map((r,i)=>({ring:r,i})).filter(({i})=>signed[i]<0);
 const pointInRing=(point:Point,poly:Point[])=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }return inside;};
 const regions:ContourRegion[]=positive.map(({ring,i})=>({outer:ring,holes:[],area:signed[i]}));
 for(const {ring,i} of negative){
  const candidates=regions.filter(r=>pointInRing(ring[0],r.outer)).sort((a,b)=>a.area-b.area);
  if(!candidates.length)return {ok:false,reason:'Innenkontur ohne zugehörige Außenkontur'};
  candidates[0].holes.push(ring);candidates[0].area+=signed[i];
 }
 if(regions.some(r=>r.area<=tol*tol))return {ok:false,reason:'Innenkontur ohne positive Restfläche'};
 return {ok:true,rings,regions,area:total,holeCount:negative.length};
}
