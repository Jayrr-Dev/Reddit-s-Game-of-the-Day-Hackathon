import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ARCHANGEL_BOSSES, GRANDANGEL_BOSSES, PURGATORY_ARENA_LORE, PURGATORY_ARENA_TITLE } from '../../../shared/game/conquestAreas';
import { bossArenaOf } from '../../content/bossArenas';
import { ProgressiveImg } from '../ui/ProgressiveImage';
import { ATLAS_REGIONS } from './AtlasRegions';
import { RegionalEngraving } from './RegionalEngraving';
import { WorldGeography, WORLD_PLACES } from './WorldGeography';
import './worldAtlas.css';

export function WorldAtlas({ current, onBack, onVisit, controls }: {
  current: number; onBack: () => void; onVisit?: (region: number) => void; controls?: ReactNode;
}) {
  const [selected, setSelected] = useState<number>();
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => back.current?.focus({ preventScroll: true }), []);
  const entry = selected === undefined ? undefined : ATLAS_REGIONS[selected];
  const point = selected === undefined ? undefined : WORLD_PLACES[selected];
  const boss = selected === undefined ? undefined : [...GRANDANGEL_BOSSES, ...ARCHANGEL_BOSSES][selected];
  const arenaArt = boss ? bossArenaOf([boss])?.image : undefined;
  return <section className="world-atlas" id="full-world-atlas" aria-label="Full world map" onKeyDown={event => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    if (selected !== undefined) setSelected(undefined);
    else onBack();
  }} onPointerDown={event => {
    if (event.target instanceof Element && !event.target.closest('.world-node,.world-region-details')) setSelected(undefined);
  }}>
    <WorldGeography current={current} />
    <div className="world-atlas-compass" aria-hidden="true">
      <span>N</span>
      <svg viewBox="0 0 46 46" aria-hidden="true">
        <circle cx="23" cy="23" r="17" fill="none" opacity=".5"/>
        <path d="m23 2 4 17 17 4-17 4-4 17-4-17-17-4 17-4Z" fill="none"/>
        <path d="m23 2 4 17-4 4-4-4Z m21 21-17 4-4-4Z m-21 21-4-17 4-4Z m-21-21 17-4 4 4Z" fill="currentColor"/>
      </svg>
    </div>
    <button ref={back} type="button" className="world-atlas-back" onClick={onBack}>Back to region</button>
    {controls}
    {ATLAS_REGIONS.map((region, i) => {
      const [x,y] = WORLD_PLACES[i]!;
      const state = i === current ? 'current' : i < current ? 'conquered' : 'ahead';
      return <button key={region.angel} className="world-node" data-state={state} type="button"
        style={{left: (x/8)+'%',top: (y/5.2)+'%', '--world-seal': region.land[0], '--world-ink':region.ink} as CSSProperties}
        aria-label={region.name} aria-current={i === current ? 'step' : undefined}
        aria-expanded={selected === i} onClick={() => setSelected(prev => prev === i ? undefined : i)}>
        <span className="world-node-seal"><svg viewBox="619 400 104 104" aria-hidden="true"><RegionalEngraving theme={region}/></svg>
          <b aria-hidden="true">{i+1}</b></span>
        <strong>{region.name}</strong>
        {i === current && <small>Current region</small>}
        {i === ATLAS_REGIONS.length - 1 && i !== current && <small>Gate to Purgatory</small>}
      </button>;
    })}
    {entry && point && selected !== undefined && <aside className="world-region-details" role="group" aria-label="Region details"
      style={{'--region-x': Math.max(31,Math.min(69,point[0]/8))+'%', '--region-y': (point[1]/5.2)+'%'} as CSSProperties}
      data-above={point[1] >= 255 || undefined}>
      <button type="button" className="world-region-close" aria-label="Close region details" onClick={() => setSelected(undefined)}>×</button>
      {arenaArt && <ProgressiveImg className="world-region-art" src={arenaArt} alt="" />}
      <small>Region {selected+1} · {selected === current ? 'Current' : selected < current ? 'Conquered' : 'Ahead'}</small>
      <strong>{entry.name}</strong>
      <p>{entry.angel} · {entry.landmark}</p>
      {selected === ATLAS_REGIONS.length-1 && <p><b>{PURGATORY_ARENA_TITLE}.</b> {PURGATORY_ARENA_LORE}</p>}
      {onVisit && <button type="button" className="world-visit-button" aria-label="Visit region" title="Visit region"
        onClick={() => onVisit(selected)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M19 9c0 4.5-7 9-7 9s-7-4.5-7-9a7 7 0 1 1 14 0ZM4 21h16"/><circle cx="12" cy="9" r="2.3"/></svg></button>}
    </aside>}
  </section>;
}
