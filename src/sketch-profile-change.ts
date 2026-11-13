import type {Sketch} from './sketch-engine';
import {detectProfileRegions} from './sketch-engine';
import {diagnoseProfileChains} from './sketch-profile-diagnostics';
/** Pure topology comparison for drag previews and completed geometry edits. */
export function profileChangeFeedback(before:Sketch,after:Sketch,tolerance=0.01){
 const oldRegions=detectProfileRegions(before,tolerance).length;
 const newRegions=detectProfileRegions(after,tolerance).length;
 const openCount=(sk:Sketch)=>diagnoseProfileChains(sk,tolerance).filter(d=>d.kind==='open').reduce((n,d)=>n+d.points.length,0);
 const oldOpen=openCount(before),newOpen=openCount(after);
 const changed=oldRegions!==newRegions||oldOpen!==newOpen;
 const kind:'closed'|'opened'|'changed'=newRegions>oldRegions?'closed':newRegions<oldRegions?'opened':newOpen<oldOpen?'closed':newOpen>oldOpen?'opened':'changed';
 const message=newRegions>oldRegions?`Profil geschlossen – ${oldRegions} → ${newRegions} Flächen`:newRegions<oldRegions?`Profil geöffnet – ${oldRegions} → ${newRegions} Flächen`:newOpen<oldOpen?`Weniger offene Endpunkte: ${oldOpen} → ${newOpen}`:newOpen>oldOpen?`Neue offene Endpunkte: ${oldOpen} → ${newOpen}`:'Profilstatus unverändert';
 // Compare profile membership, not just the first line: highlight the affected contours.
 const oldProfiles=detectProfileRegions(before,tolerance);
 const newProfiles=detectProfileRegions(after,tolerance);
 const signature=(r:(typeof oldProfiles)[number])=>[...r.outer.itemIds].sort().join('|')+'#'+r.holes.map(h=>[...h.itemIds].sort().join('|')).sort().join('#');
 const oldSignatures=new Set(oldProfiles.map(signature));
 const newSignatures=new Set(newProfiles.map(signature));
 const edgeIds=new Set<string>();
 for(const r of oldProfiles)if(!newSignatures.has(signature(r)))for(const id of [ ...r.outer.itemIds,...r.holes.flatMap(h=>h.itemIds)])edgeIds.add(id);
 for(const r of newProfiles)if(!oldSignatures.has(signature(r)))for(const id of [...r.outer.itemIds,...r.holes.flatMap(h=>h.itemIds)])edgeIds.add(id);
 const openPoints=(s:Sketch)=>diagnoseProfileChains(s,tolerance).filter(d=>d.kind==='open').flatMap(d=>d.points);
 const previous=openPoints(before),current=openPoints(after);
 const missing=(a:typeof previous,b:typeof current)=>a.filter(p=>!b.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<=tolerance));
 const affectedPoints=[...missing(previous,current),...missing(current,previous)];
 // When the number of profiles stays the same, endpoint changes still identify the touched chains.
 if(changed&&!edgeIds.size){for(const item of after.items){if(item.kind!=='line'||item.construction)continue;if(affectedPoints.some(p=>Math.hypot(item.x-p.x,item.y-p.y)<=tolerance||Math.hypot(item.x+item.w-p.x,item.y+item.h-p.y)<=tolerance))edgeIds.add(item.id);}}
 const lines=after.items.filter(i=>edgeIds.has(i.id)&&i.kind==='line');
 const candidate=affectedPoints[0]|| (lines[0]?{x:lines[0].x,y:lines[0].y}:undefined);
 return {changed,kind,message,oldRegions,newRegions,oldOpen,newOpen,x:candidate?.x??0,y:candidate?.y??0,edgeIds:[...edgeIds],affectedPoints};
}
