import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent } from 'react';

type TextItem = { id: string; type: 'text'; x: number; y: number; text: string; size: number; color: string };
type RectItem = { id: string; type: 'rect'; x: number; y: number; w: number; h: number; fill: string; stroke: string };
type ImageItem = { id: string; type: 'image'; x: number; y: number; w: number; h: number; href: string; name: string };
type Item = TextItem | RectItem | ImageItem;
type Project = { version: 1; name: string; width: number; height: number; background: string; items: Item[] };
type SavedProject = { id: string; project: Project; updatedAt: number };
type ProjectStore = { version: 1; activeId: string; projects: SavedProject[] };
const STORE_KEY = 'cardforge-project-store-v1';
const templates = [
  { name: 'Poker', width: 63, height: 88, label: '63 × 88 mm' },
  { name: 'Tarot', width: 70, height: 120, label: '70 × 120 mm' },
  { name: 'Mini', width: 44, height: 67, label: '44 × 67 mm' },
  { name: 'Quadratisch', width: 80, height: 80, label: '80 × 80 mm' },
  { name: 'Eigene Größe', width: 63, height: 88, label: 'Benutzerdefiniert' },
];
const uid = () => Math.random().toString(36).slice(2, 10);
const initial: Project = { version: 1, name: 'Mein Kartenspiel', width: 63, height: 88, background: '#f8f4e9', items: [
  { id: 'frame', type: 'rect', x: 4, y: 4, w: 55, h: 80, fill: 'none', stroke: '#4d5c48' },
  { id: 'title', type: 'text', x: 31.5, y: 15, text: 'KARTENTITEL', size: 4.2, color: '#263326' },
  { id: 'desc', type: 'text', x: 31.5, y: 72, text: 'Beschreibung deiner Karte', size: 2.8, color: '#263326' },
] };
function readProjectStore(): ProjectStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProjectStore;
      if (parsed.version === 1 && Array.isArray(parsed.projects) && parsed.projects.length > 0) {
        const activeId = parsed.projects.some(p => p.id === parsed.activeId) ? parsed.activeId : parsed.projects[0].id;
        return { version: 1, activeId, projects: parsed.projects };
      }
    }
  } catch {
    // Falls gespeicherte Daten beschädigt sind, mit einem neuen Projekt starten.
  }
  const starter: SavedProject = { id: uid(), project: initial, updatedAt: Date.now() };
  return { version: 1, activeId: starter.id, projects: [starter] };
}
function blankProject(name: string): Project {
  return { version: 1, name, width: 63, height: 88, background: '#f8f4e9', items: [] };
}
export default function App() {
  const [projectStore, setProjectStore] = useState<ProjectStore>(readProjectStore);
  const activeRecord = projectStore.projects.find(record => record.id === projectStore.activeId) ?? projectStore.projects[0] ?? { id: 'fallback', project: initial, updatedAt: 0 };
  const project = activeRecord.project;
  const setProject = (update: Project | ((previous: Project) => Project)) => {
    setProjectStore(store => {
      const current = store.projects.find(record => record.id === store.activeId) ?? store.projects[0];
      if (!current) return store;
      const nextProject = typeof update === 'function' ? update(current.project) : update;
      return { ...store, projects: store.projects.map(record => record.id === current.id ? { ...record, project: nextProject, updatedAt: Date.now() } : record) };
    });
  };
  const [selected, setSelected] = useState<string>('title');
  const [template, setTemplate] = useState('Poker');
  const [status, setStatus] = useState('Bereit');
  const [zoom, setZoom] = useState(4.3);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(projectStore));
      } catch {
        setStatus('Automatisches Speichern nicht möglich – bitte Projektdatei exportieren.');
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [projectStore]);
  const fileRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: string; startX: number; startY: number; itemX: number; itemY: number } | null>(null);
  const selectedItem = project.items.find(i => i.id === selected);
  const pxW = project.width * zoom;
  const pxH = project.height * zoom;
  const patch = (id: string, changes: Partial<Item>) => setProject(p => ({ ...p, items: p.items.map(i => i.id === id ? ({ ...i, ...changes } as Item) : i) }));
  const addText = () => { const id = uid(); setProject(p => ({ ...p, items: [...p.items, { id, type: 'text', x: p.width / 2, y: p.height / 2, text: 'Neuer Text', size: 4, color: '#222222' }] })); setSelected(id); setStatus('Text hinzugefügt'); };
  const addFrame = () => { const id = uid(); setProject(p => ({ ...p, items: [...p.items, { id, type: 'rect', x: 8, y: 22, w: p.width - 16, h: p.height - 30, fill: 'none', stroke: '#4d5c48' }] })); setSelected(id); };
  const addImage = (e: ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const id = uid(); setProject(p => ({ ...p, items: [...p.items, { id, type: 'image', x: p.width * .2, y: p.height * .27, w: p.width * .6, h: p.height * .35, href: String(reader.result), name: file.name }] })); setSelected(id); setStatus(`Bild hinzugefügt: ${file.name}`); }; reader.readAsDataURL(file); e.target.value = ''; };
  const applyTemplate = (name: string) => { setTemplate(name); const t = templates.find(x => x.name === name)!; setProject(p => ({ ...p, width: t.width, height: t.height })); setStatus(`Format: ${name}`); };
  const saveProject = () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(projectStore));
      setStatus(`„${project.name}“ lokal gespeichert`);
    } catch {
      setStatus('Speichern fehlgeschlagen. Bitte über „Datei sichern“ eine Sicherung exportieren.');
    }
  };
  const exportProjectFile = () => { const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }); download(blob, `${safeName(project.name)}.cardforge.json`); setStatus('Projektdatei als Sicherung exportiert'); };
  const loadProject = (e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => { try { const p = JSON.parse(String(reader.result)) as Project; if (p.version !== 1 || !Array.isArray(p.items) || typeof p.width !== 'number' || typeof p.height !== 'number') throw new Error('Ungültiges Projektformat'); const id = uid(); setProjectStore(store => ({ ...store, activeId: id, projects: [...store.projects, { id, project: p, updatedAt: Date.now() }] })); setSelected(p.items[0]?.id ?? ''); setStatus(`Projektdatei „${p.name}“ importiert`); } catch { setStatus('Datei konnte nicht als CardForge-Projekt geöffnet werden'); } }; reader.readAsText(f); e.target.value = ''; };
  const createProject = () => { const name = `Neues Projekt ${projectStore.projects.length + 1}`; const id = uid(); setProjectStore(store => ({ ...store, activeId: id, projects: [...store.projects, { id, project: blankProject(name), updatedAt: Date.now() }] })); setSelected(''); setTemplate('Poker'); setStatus(`„${name}“ erstellt`); };
  const duplicateProject = () => { const id = uid(); const copy: Project = { ...JSON.parse(JSON.stringify(project)), name: `${project.name} (Kopie)` }; setProjectStore(store => ({ ...store, activeId: id, projects: [...store.projects, { id, project: copy, updatedAt: Date.now() }] })); setSelected(copy.items[0]?.id ?? ''); setStatus(`„${copy.name}“ erstellt`); };
  const switchProject = (id: string) => { const next = projectStore.projects.find(record => record.id === id); if (!next) return; setProjectStore(store => ({ ...store, activeId: id })); setSelected(next.project.items[0]?.id ?? ''); setStatus(`Projekt „${next.project.name}“ geöffnet`); };
  const deleteProject = () => {
    if (!window.confirm(`Projekt „${project.name}“ wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
    if (projectStore.projects.length === 1) {
      const replacement: SavedProject = { id: uid(), project: blankProject('Mein Kartenspiel'), updatedAt: Date.now() };
      setProjectStore({ version: 1, activeId: replacement.id, projects: [replacement] });
      setSelected('');
      setStatus('Projekt gelöscht. Ein leeres Projekt wurde angelegt.');
      return;
    }
    const remaining = projectStore.projects.filter(record => record.id !== projectStore.activeId);
    setProjectStore({ version: 1, activeId: remaining[0].id, projects: remaining });
    setSelected(remaining[0].project.items[0]?.id ?? '');
    setStatus('Projekt gelöscht');
  };
  const exportSvg = () => { const svg = document.getElementById('card-artboard'); if (!svg) return; const copy = svg.cloneNode(true) as SVGSVGElement; copy.removeAttribute('style'); copy.querySelectorAll('[data-editor-ui]').forEach(n => n.remove()); const xml = new XMLSerializer().serializeToString(copy); download(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }), `${safeName(project.name)}.svg`); setStatus('SVG exportiert'); };
  const exportPng = () => { const svg = document.getElementById('card-artboard'); if (!svg) return; const copy = svg.cloneNode(true) as SVGSVGElement; copy.querySelectorAll('[data-editor-ui]').forEach(n => n.remove()); copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('width', String(project.width * 12)); copy.setAttribute('height', String(project.height * 12)); const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' })); const img = new Image(); img.onload = () => { const canvas = document.createElement('canvas'); canvas.width = project.width * 12; canvas.height = project.height * 12; const ctx = canvas.getContext('2d'); ctx?.drawImage(img, 0, 0, canvas.width, canvas.height); canvas.toBlob(b => { if (b) download(b, `${safeName(project.name)}.png`); URL.revokeObjectURL(url); setStatus('PNG exportiert'); }); }; img.onerror = () => { URL.revokeObjectURL(url); setStatus('PNG-Export fehlgeschlagen'); }; img.src = url; };
  const beginDrag = (e: PointerEvent<SVGElement>, item: Item) => { e.preventDefault(); e.stopPropagation(); setSelected(item.id); const point = e.currentTarget.ownerSVGElement?.createSVGPoint(); if (!point) return; point.x = e.clientX; point.y = e.clientY; const local = point.matrixTransform(e.currentTarget.ownerSVGElement!.getScreenCTM()!.inverse()); drag.current = { id: item.id, startX: local.x, startY: local.y, itemX: item.x, itemY: item.y }; (e.currentTarget as SVGElement).setPointerCapture(e.pointerId); };
  const moveDrag = (e: PointerEvent<SVGSVGElement>) => { if (!drag.current) return; const p = e.currentTarget.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const local = p.matrixTransform(e.currentTarget.getScreenCTM()!.inverse()); const d = drag.current; patch(d.id, { x: Math.max(0, Math.min(project.width, d.itemX + local.x - d.startX)), y: Math.max(0, Math.min(project.height, d.itemY + local.y - d.startY)) }); };
  const stopDrag = () => { drag.current = null; };
  const removeSelected = () => { setProject(p => ({ ...p, items: p.items.filter(i => i.id !== selected) })); setSelected(''); setStatus('Element gelöscht'); };
  const ordered = useMemo(() => project.items, [project.items]);
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark">CF</div><div><strong>CardForge</strong><small>DESKTOP · KARTENSTUDIO</small></div></div><div className="project-name"><span>Projektname</span><input value={project.name} onChange={e => setProject(p => ({ ...p, name: e.target.value }))} aria-label="Projektname" /></div><div className="top-actions"><button onClick={() => projectRef.current?.click()}>Importieren</button><button onClick={exportProjectFile}>Datei sichern</button><button onClick={saveProject} className="primary">Speichern</button><button onClick={exportPng}>PNG</button><button onClick={exportSvg}>SVG</button><input ref={projectRef} type="file" accept=".json,.cardforge.json,application/json" hidden onChange={loadProject}/></div></header>
    <div className="workspace"><aside className="left-panel"><div className="panel-heading">PROJEKTVERWALTUNG</div><label className="field-label">Projekt auswählen<select value={projectStore.activeId} onChange={e => switchProject(e.target.value)}>{projectStore.projects.map(record => <option key={record.id} value={record.id}>{record.project.name}</option>)}</select></label><div className="project-actions"><button onClick={createProject}>＋ Neu</button><button onClick={duplicateProject}>Duplizieren</button><button onClick={deleteProject} disabled={projectStore.projects.length === 0}>Löschen</button></div><p className="autosave-note">Änderungen werden automatisch auf diesem PC gespeichert.</p><div className="panel-heading section-heading">KARTENFORMAT</div><label className="field-label">Vorlage<select value={template} onChange={e => applyTemplate(e.target.value)}>{templates.map(t => <option key={t.name}>{t.name}</option>)}</select></label><div className="dimension-row"><label className="field-label">Breite (mm)<input type="number" min="20" max="200" value={project.width} onChange={e => setProject(p => ({ ...p, width: Math.max(20, Number(e.target.value) || 20) }))}/></label><label className="field-label">Höhe (mm)<input type="number" min="20" max="250" value={project.height} onChange={e => setProject(p => ({ ...p, height: Math.max(20, Number(e.target.value) || 20) }))}/></label></div><label className="field-label">Hintergrund<input type="color" value={project.background} onChange={e => setProject(p => ({ ...p, background: e.target.value }))}/></label><div className="panel-heading section-heading">ELEMENTE HINZUFÜGEN</div><button className="tool-button" onClick={addText}><span className="tool-icon">T</span><span><b>Textfeld</b><small>Überschrift oder Beschreibung</small></span><strong>＋</strong></button><button className="tool-button" onClick={() => fileRef.current?.click()}><span className="tool-icon">▧</span><span><b>Bild importieren</b><small>PNG, JPG, WebP und mehr</small></span><strong>＋</strong></button><input ref={fileRef} type="file" accept="image/*" hidden onChange={addImage}/><button className="tool-button" onClick={addFrame}><span className="tool-icon">▱</span><span><b>Rahmen</b><small>Rechteckiger Kartenbereich</small></span><strong>＋</strong></button><div className="panel-heading section-heading">MEDIENBIBLIOTHEK</div><div className="library-note"><span className="library-symbol">▧</span><div><b>Deine lokalen Bilder</b><p>Importierte Bilder werden direkt in der Projektdatei eingebettet. Keine Cloud nötig.</p></div></div><div className="panel-foot">OFFLINE-FIRST <span>●</span> DATEN BLEIBEN LOKAL</div></aside>
    <main className="canvas-area"><div className="canvas-toolbar"><div><b>Arbeitsfläche</b><span className="crumb"> / {project.name}</span></div><div className="zoom-controls"><button onClick={() => setZoom(z => Math.max(2, z - .4))} aria-label="Verkleinern">−</button><span>{Math.round(zoom / 4.3 * 100)}%</span><button onClick={() => setZoom(z => Math.min(8, z + .4))} aria-label="Vergrößern">＋</button></div></div><div className="canvas-scroll"><div className="artboard-wrap" style={{ width: pxW + 32, height: pxH + 32 }}><svg id="card-artboard" width={pxW} height={pxH} viewBox={`0 0 ${project.width} ${project.height}`} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onClick={() => setSelected('')} role="img" aria-label="Kartenarbeitsfläche"><rect width={project.width} height={project.height} fill={project.background}/>{ordered.map(item => <g key={item.id} onPointerDown={e => beginDrag(e, item)} className={`canvas-item ${selected === item.id ? 'is-selected' : ''}`} style={{ cursor: 'move' }}>
      {item.type === 'rect' && <rect x={item.x} y={item.y} width={item.w} height={item.h} fill={item.fill} stroke={item.stroke} strokeWidth={.45}/>}
      {item.type === 'text' && <text x={item.x} y={item.y} fill={item.color} fontSize={item.size} textAnchor="middle" fontFamily="Georgia, serif" fontWeight={item.size > 4 ? 'bold' : 'normal'}>{item.text}</text>}
      {item.type === 'image' && <image x={item.x} y={item.y} width={item.w} height={item.h} href={item.href} preserveAspectRatio="xMidYMid meet"/>}
      {selected === item.id && <rect data-editor-ui="true" x={item.x - (item.type === 'rect' ? .4 : 1)} y={item.y - (item.type === 'text' ? item.size : 1)} width={item.type === 'rect' ? item.w + .8 : item.type === 'image' ? item.w + 2 : Math.max(item.text.length * item.size * .55, 8)} height={item.type === 'rect' ? item.h + .8 : item.type === 'image' ? item.h + 2 : item.size * 1.7} fill="none" stroke="#2777e8" strokeWidth={.35} strokeDasharray="1 1" pointerEvents="none"/>}
    </g>)}</svg></div></div><div className="canvas-status"><span><i className="green-dot"/> {status}</span><span>{project.width} × {project.height} mm · {project.items.length} Elemente</span></div></main>
    <aside className="right-panel"><div className="panel-heading">EBENEN</div><div className="layer-list">{[...project.items].reverse().map(item => <button key={item.id} className={`layer-row ${selected === item.id ? 'active' : ''}`} onClick={() => setSelected(item.id)}><span className="layer-icon">{item.type === 'text' ? 'T' : item.type === 'image' ? '▧' : '▱'}</span><span className="layer-name">{item.type === 'text' ? item.text : item.type === 'image' ? item.name : 'Rahmen'}</span><span className="layer-type">{item.type === 'text' ? 'Text' : item.type === 'image' ? 'Bild' : 'Form'}</span></button>)}</div><div className="inspector"><div className="panel-heading">EIGENSCHAFTEN</div>{selectedItem ? <><div className="selected-type">{selectedItem.type === 'text' ? 'TEXT-ELEMENT' : selectedItem.type === 'image' ? 'BILD-ELEMENT' : 'FORM-ELEMENT'}</div>{selectedItem.type === 'text' && <><label className="field-label">Inhalt<textarea value={selectedItem.text} onChange={e => patch(selectedItem.id, { text: e.target.value })}/></label><label className="field-label">Schriftgröße<input type="number" min="1" max="20" step=".2" value={selectedItem.size} onChange={e => patch(selectedItem.id, { size: Math.max(1, Number(e.target.value) || 1) })}/></label><label className="field-label">Textfarbe<input type="color" value={selectedItem.color} onChange={e => patch(selectedItem.id, { color: e.target.value })}/></label></>}{selectedItem.type === 'rect' && <><label className="field-label">Füllfarbe<input value={selectedItem.fill} onChange={e => patch(selectedItem.id, { fill: e.target.value })} placeholder="none oder #ffffff"/></label><label className="field-label">Linienfarbe<input type="color" value={selectedItem.stroke} onChange={e => patch(selectedItem.id, { stroke: e.target.value })}/></label></>}{selectedItem.type === 'image' && <p className="helper-text">{selectedItem.name}<br/>Bildposition und Größe werden in der nächsten Ausbaustufe direkt hier einstellbar.</p>}<div className="position-grid"><label className="field-label">X (mm)<input type="number" value={Number(selectedItem.x.toFixed(1))} onChange={e => patch(selectedItem.id, { x: Number(e.target.value) })}/></label><label className="field-label">Y (mm)<input type="number" value={Number(selectedItem.y.toFixed(1))} onChange={e => patch(selectedItem.id, { y: Number(e.target.value) })}/></label></div><button className="delete-button" onClick={removeSelected}>Element löschen</button></> : <div className="empty-inspector"><span>↖</span><b>Kein Element ausgewählt</b><p>Wähle ein Element auf der Karte oder in den Ebenen aus, um seine Eigenschaften zu bearbeiten.</p></div>}</div><div className="right-tip"><b>PRO-TIPP</b><p>Ziehe Elemente direkt auf der Karte an die gewünschte Position.</p></div></aside></div>
    <footer className="app-footer"><span>CardForge <b>0.1.0 · MVP</b></span><span>{projectStore.projects.length} Projekte · automatisch lokal gespeichert</span><span>Windows-Desktop-Projekt</span></footer>
  </div>;
}
function safeName(name: string) { return name.trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'kartenprojekt'; }
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
