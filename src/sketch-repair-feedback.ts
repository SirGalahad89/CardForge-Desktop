import type {Sketch} from './sketch-engine';
import {diagnoseProfileChains} from './sketch-profile-diagnostics';
/** Compare topology before and after a confirmed repair; no mutation. */
export function repairFeedback(before:Sketch,after:Sketch,tolerance=0.01){
 const old=diagnoseProfileChains(before,tolerance),now=diagnoseProfileChains(after,tolerance);
 const count=(list:typeof old,kind:'open'|'branch')=>list.filter(d=>d.kind===kind).reduce((sum,d)=>sum+(kind==='open'?d.points.length:1),0);
 const openBefore=count(old,'open'),openAfter=count(now,'open');
 const branchBefore=count(old,'branch'),branchAfter=count(now,'branch');
 const closed=openBefore>0&&openAfter===0&&branchAfter===0;
 return {openBefore,openAfter,branchBefore,branchAfter,closed,improved:openAfter<openBefore,
  message:closed?'Kontur geschlossen – keine offenen Endpunkte mehr':openAfter<openBefore?`Reparatur erfolgreich – offene Endpunkte: ${openBefore} → ${openAfter}`:'Verbindung erstellt – Kontur weiterhin prüfen'};
}
