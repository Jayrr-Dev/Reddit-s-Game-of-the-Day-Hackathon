import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { areaMapNodes, areaTerrain, type AreaMapNode, type AreaTerrain } from '../../../shared/game/areaMap';
import type { AreaBattle, AreaSite } from '../../../shared/game/conquestAreas';
import { Glyph } from '../ui/Glyph';
import { AtlasLandmark } from './KingdomAtlas';
import { MapExpandButton } from './MapExpandButton';
import type { MapHandoff } from '../../lib/mapExpansion';
import './localAreaMap.css';

type Interaction = { battle: number; visited: readonly number[]; onVisit: (room: number) => void };
type Props = {
  site: AreaSite; battles: readonly AreaBattle[]; heading?: string;
  onBack?: () => void; interaction?: Interaction; children?: ReactNode; mapHandoff?: MapHandoff;
};

const TERRAIN_LABEL: Record<AreaTerrain, string> = {
  road: 'Road', village: 'Village', city: 'City', citadel: 'Citadel', tunnels: 'Depths',
  bridge: 'Crossing', woods: 'Woodland', peak: 'Highlands',
};

const TERRAIN_ART: Record<AreaTerrain, string> = {
  road: 'M2 14q61 26 148-4M650 65q60-27 148-4M0 295q104-43 196 5M592 284q106-40 208 2M0 374q156-49 214 12M641 351q75-32 159-16',
  village: 'M205 202h390v127H205ZM328 202v-79m143 79v-79M362 330v66m76-66v66M205 241H89m506 0h110',
  city: 'M123 56H677V391H123ZM123 144h554M123 316h554M302 56v335m196-335v335',
  citadel: 'M141 17H659V389H141ZM245 39H555V238H245ZM141 281h518M303 281v109m194-109v109',
  tunnels: 'M40 71 103 33 273 44 308 101 498 126 696 61 766 123 728 218 585 259 574 345 461 383 245 394 117 335 57 198Z',
  bridge: 'M0 132q200-52 400 0t400 0M0 167q200-52 400 0t400 0M0 279q200-52 400 0t400 0M0 314q200-52 400 0t400 0',
  woods: 'M7 228Q168-6 350 42T795 80M6 302Q202 459 433 380T799 324M0 185q134-115 208-103m329 261q149-99 263-80',
  peak: 'M2 342 146 128 216 196 339 42 471 243 572 91 798 345M0 383 124 252 182 315 303 194 370 287 467 248 544 317 632 211 799 393',
};

const nodePoint = (node: AreaMapNode) => (node.x * 8) + ' ' + (node.y * 4.2);

/** Draws the local route over a terrain-specific engraved map. */
function MapInk({ terrain, nodes }: { terrain: AreaTerrain; nodes: readonly AreaMapNode[] }) {
  const straight = terrain === 'road' || terrain === 'bridge';
  const battles = nodes.filter(node => node.kind === 'battle');
  const stem = straight ? 'M400 406V35' : 'M400 406 ' + battles.map(node => 'L' + nodePoint(node)).join(' ');
  const paths = straight ? [] : nodes.flatMap(node => {
    const battle = battles[node.battle];
    const junction = terrain === 'village' ? '400 246' : battle && nodePoint(battle);
    return node.kind !== 'battle' && junction ? ['M' + junction + ' L' + nodePoint(node)] : [];
  });
  return <svg className="local-area-ink" viewBox="0 0 800 420" preserveAspectRatio="none" aria-hidden="true">
    <path className="local-area-terrain" d={TERRAIN_ART[terrain]} vectorEffect="non-scaling-stroke" />
    <path className="local-area-track" d={stem} vectorEffect="non-scaling-stroke" />
    {paths.map(path => <path key={path} className="local-area-branch" d={path} vectorEffect="non-scaling-stroke" />)}
  </svg>;
}

/** A map pin shows either the present action or a future point to inspect. */
function LocalPin({ node, status, selected, onClick }: {
  node: AreaMapNode; status: string; selected: boolean; onClick: () => void;
}) {
  return <button type="button" className="local-area-pin" style={{ left: node.x + '%', top: node.y + '%' }}
    data-status={status} aria-label={node.label + ', ' + status} aria-pressed={selected} onClick={onClick}>
    {node.kind === 'building' ? <AtlasLandmark mark={node.room === 2 ? 'hold' : node.room === 1 ? 'city' : 'village'} />
      : <span className="local-area-pin-icon"><Glyph name={node.kind === 'curio' ? 'eye' : node.label === 'Encounter' ? 'sword' : 'skull'} /></span>}
    <span>{node.label}</span>
  </button>;
}

/** Before travel this is an inspection map; after a battle its pins are visitable. */
export function LocalAreaMap({ site, battles, heading = site.name, onBack, interaction, children, mapHandoff }: Props) {
  const [selection, setSelection] = useState<string>();
  const title = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => { title.current?.focus({ preventScroll: true }); }, [heading]);
  const terrain = areaTerrain(site);
  const nodes = areaMapNodes(site, battles);
  const selected = nodes.find(node => node.id === selection);
  const status = (node: AreaMapNode) => {
    if (!interaction) return 'Preview';
    if (node.battle < interaction.battle) return 'Passed';
    if (node.battle > interaction.battle) return 'Ahead';
    if (node.kind === 'battle') return 'Defeated';
    return node.room !== undefined && interaction.visited.includes(node.room) ? 'Visited' : 'Available';
  };

  return <section className="local-area-map prelude-enter" data-terrain={terrain} aria-label={heading + ' area map'}
    onKeyDown={event => { if (onBack && event.key === 'Escape') { event.stopPropagation(); onBack(); } }}>
    <header className="local-area-header">
      {onBack && <button type="button" className="map-expand-button" title="Back to regional map" aria-label="Back to regional map" onClick={onBack}>
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg>
      </button>}
      <div><small>{TERRAIN_LABEL[terrain]}</small><h1 ref={title} tabIndex={-1}>{heading}</h1></div>
      <MapExpandButton className="local-area-expand" {...(mapHandoff && { view: mapHandoff })} />
    </header>
    <div className="local-area-chart">
      <MapInk terrain={terrain} nodes={nodes} />
      {terrain === 'village' && <span className="local-area-square" aria-hidden="true">Village Square</span>}
      {nodes.map(node => <LocalPin key={node.id} node={node} status={status(node)} selected={node.id === selection}
        onClick={() => {
          setSelection(node.id);
          if (interaction && status(node) === 'Available' && node.room !== undefined) interaction.onVisit(node.room);
        }} />)}
    </div>
    <footer className="local-area-footer">
      {selected && <small className="local-area-inspection" aria-live="polite">{selected.label} · {status(selected)}</small>}
      {children}
    </footer>
  </section>;
}
