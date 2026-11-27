import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { hashSeed, nextFloat, pickOne } from '../../../shared/game/rng';
import { areaCounts, buildAreaBattles, conquestStops, GRANDANGEL_BOSSES } from '../../../shared/game/conquestAreas';
import { STOPS_PER_REGION } from '../../../shared/game/rules';
import { regionChoices, type RegionChoice } from '../../../shared/game/regionRoutes';
import { regionIndexOf, routeOptions, type Stop } from '../../../shared/game/kingdom';
import { routeLocation } from './routeLocation';
import { STOP_COPY } from '../../content/lore';
import { MAP_IMAGES, MAP_NAMES } from './combat/Backdrop';
import { ProgressiveImg } from '../ui/ProgressiveImage';
import { Button } from '../ui/Button';
import { Glyph } from '../ui/Glyph';
import { SpeechBubble } from '../ui/SpeechBubble';
import { HELL_ARTIFACTS, isHellArtifact, type HellArtifactId } from '../../../shared/game/hellArtifacts';
import greed from '../../assets/npcs/greed-gilded-vault.webp';
import sloth from '../../assets/npcs/sin-lair-sloth.webp';
import envy from '../../assets/npcs/sin-lair-envy.webp';
import gluttony from '../../assets/npcs/sin-lair-gluttony.webp';
import lust from '../../assets/npcs/sin-lair-lust.webp';
import pride from '../../assets/npcs/sin-lair-pride.webp';
import { AtlasInk, AtlasLandmark, landmarkOf, ATLAS_HEIGHT, ATLAS_WIDTH, type AtlasLink, type AtlasPoint } from './KingdomAtlas';
import { ATLAS_REGIONS } from './AtlasRegions';
import { WorldAtlas } from './WorldAtlas';
import { SandboxView, type AtlasTrainingVisit } from './SandboxView';
import { useIsAdmin } from '../../lib/adminRole';
import { bossArenaOf } from '../../content/bossArenas';
import { SinLairMotion } from './SinLairMotion';
import './conquestPrelude.css';

// --- THE SIX HOSTS ---
const HOSTS = [
  { name: 'Pride', lair: 'The Crownless Balcony', line: 'The last Wrath asked for an army. Thou hast not even asked for a sword.', backdrop: pride, focus: '33%', side: 'left' },
  { name: 'Greed', lair: 'The Gilded Vault', line: 'The old lord paid to come back. I wonder what thou wouldst pay to stay.', backdrop: greed, focus: '78%', side: 'right' },
  { name: 'Lust', lair: 'Pavilion of Red Vows', line: 'There is one name I could speak to make thee turn. I think I shall keep it.', backdrop: lust, focus: '66%', side: 'right' },
  { name: 'Envy', lair: 'Gallery of Borrowed Crowns', line: 'They took everything from thee. And yet thou hast something I cannot touch.', backdrop: envy, focus: '31%', side: 'left' },
  { name: 'Gluttony', lair: 'The Empty Feast', line: 'The dead come back hungry. Thou camest back with the same hunger.', backdrop: gluttony, focus: '73%', side: 'right' },
  { name: 'Sloth', lair: 'The Stillstone Dais', line: 'Seven hundred years, the old lord held that seat. Thou hast not sat once.', backdrop: sloth, focus: '55%', side: 'center' },
] as const;

/** Map landmark art represents settlements, not their enemies. */
function CitySeal({ citadel = false, location = '' }: { citadel?: boolean; location?: string }) {
  const mark = /bridge|aqueduct/i.test(location) ? 'bridge' : /dungeon|mine|cave|undercroft/i.test(location)
    ? 'depths' : /grove|forest|reach/i.test(location) ? 'forest' : 'city';
  return <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    {mark === 'bridge' ? <path d="M4 25V15h32v10M4 20h32M8 31V25q6-10 12 0q6-10 12 0v6M4 34q4-3 8 0q4 3 8 0q4-3 8 0q4 3 8 0" /> :
      mark === 'depths' ? <path d="M5 33V15L20 6l15 9v18H5Zm7 0v-9a8 8 0 1116 0v9M15 31l5-7 5 7" /> :
      mark === 'forest' ? <path d="M6 31h28M20 32V8m-8 19 8-16 8 16M9 31V18m-5 8 5-10 5 10m17 5V18m-5 8 5-10 5 10" /> :
      <path d="M5 32h30M8 32V19l5-6 5 6v13m4 0V13l5-7 5 7v19M11 23h4m10-5h4m-4 6h4" />}
    {mark === 'city' && citadel && <path d="M27 6V2l8 2-8 2M5 35h30M17 31v-8h6v8" />}
  </svg>;
}

/** Preview the actual region's destinations without making later stops selectable. */
export function ConquestMap({
  stop: runStop = 1,
  region,
  route,
  worldSeed = 'atlas',
  options: runOptions,
  atlasOptions,
  onChoose,
}: {
  stop?: number; region?: string; route?: RegionChoice | undefined; worldSeed?: string;
  options: readonly Stop[]; atlasOptions?: (stop: number) => readonly Stop[];
  onChoose: (option: number) => void;
}) {
  const isAdmin = useIsAdmin();
  const [browseRegion, setBrowseRegion] = useState<number>();
  const [practice, setPractice] = useState<AtlasTrainingVisit>();
  const exploring = isAdmin && browseRegion !== undefined;
  const stop = exploring ? browseRegion * STOPS_PER_REGION + 1 : runStop;
  const options = exploring ? conquestStops(worldSeed, stop, route) : runOptions;
  const map = useRef<HTMLDivElement>(null);
  const activeMarker = useRef<HTMLButtonElement>(null);
  const selectedMarker = useRef<HTMLButtonElement>(null);
  const [popover, setPopover] = useState<{left: number; edge: number; side: 'above' | 'below' | 'left' | 'right'; caret: number}>();
  const positionPopover = useCallback((marker: HTMLButtonElement) => {
    const container = map.current?.parentElement?.getBoundingClientRect();
    if (!container) return;
    const anchor = marker.getBoundingClientRect();
    const icon = marker.querySelector('.atlas-landmark')?.getBoundingClientRect() ?? anchor;
    const margin = 8;
    const gap = 10;
    const width = Math.min(252, container.width - margin * 2);
    const height = Math.min(253, container.height - margin * 2);
    const within = (n: number, max: number) => Math.max(margin, Math.min(n, max - margin));
    const midpoint = icon.left + icon.width / 2 - container.left;
    const iconY = icon.top + icon.height / 2 - container.top;
    const right = icon.right - container.left + gap;
    const leftSide = icon.left - container.left - width - gap;
    let next: NonNullable<typeof popover>;
    if (right + width <= container.width - margin || leftSide >= margin) {
      const edge = within(iconY - height / 2, container.height - height);
      next = {
        left: right + width <= container.width - margin ? right : leftSide,
        edge,
        side: right + width <= container.width - margin ? 'right' : 'left',
        caret: within(iconY - edge, height),
      };
    } else {
      const left = within(midpoint - width / 2, container.width - width);
      const above = anchor.top - container.top >= height + gap || iconY > container.height / 2;
      const distance = above ? container.bottom - anchor.top : anchor.bottom - container.top;
      next = { left, edge: within(distance + gap, container.height - height),
        side: above ? 'above' : 'below', caret: within(midpoint - left, width) };
    }
    setPopover(previous => previous?.left === next.left && previous.edge === next.edge &&
      previous.side === next.side && previous.caret === next.caret ? previous : next);
  }, []);
  const [selected, setSelected] = useState<{at: number; option: number}>();
  const [showWorld, setShowWorld] = useState(false);
  const worldTrigger = useRef<HTMLButtonElement>(null);
  const regionIndex = regionIndexOf(stop);
  const firstStop = regionIndex * STOPS_PER_REGION + 1;
  const isCampaign = options.some(option => option.site);
  const atlasSeed = [worldSeed, regionIndex, route ?? 0].join(':');
  const theme = ATLAS_REGIONS[regionIndex] ?? ATLAS_REGIONS[0]!;
  const isSummit = isCampaign && theme.terrain === 'summit';
  const summitGate = { x: 423, y: 196 };
  const origin = { x: 355, y: 825 };
  const locationOf = (node: Stop, at: number, option: number) => node.site ?? (node.kind === 'greed-bargain'
    ? { name: 'The Gilded Vault', flavour: STOP_COPY[node.kind].blurb }
    : routeLocation(at, option, node.kind, route));
  const rows = Array.from({ length: STOPS_PER_REGION }, (_, index) => {
    const at = firstStop + index;
    const nodes = at === stop ? options : (exploring ? undefined : atlasOptions?.(at)) ??
      (isCampaign ? conquestStops(worldSeed, at, route) : routeOptions(worldSeed, at));
    return {
      at,
      nodes: nodes.map((node, option) => {
        const [jitter] = nextFloat(hashSeed(atlasSeed + ':marker:' + index + ':' + option));
        const center = nodes.length === 1 ? 418 : 238 + 302 * option / (nodes.length - 1);
        const location = locationOf(node, at, option);
        return { node, option, location,
          point: { x: center + (jitter - .5) * 43 + index * 6, y: isSummit && node.site?.kind === 'capital' ? 73 : 710 - index * 144 },
          mark: landmarkOf(location.name, node.site?.kind ?? (node.kind === 'champion' ? 'capital' : undefined)),
        };
      }),
    };
  });
  const links = rows.flatMap((row, i): AtlasLink[] => {
    const previous = i === 0 ? [origin] : rows[i - 1]!.nodes.map(node => node.point);
    const state: AtlasLink['state'] = row.at === stop ? 'open' : row.at > stop ? 'future' : 'past';
    if (isSummit && i === STOPS_PER_REGION - 1) return [
      ...previous.map(from => ({from, to: summitGate, state})),
      ...row.nodes.map(({point:to}) => ({from: summitGate, to, state})),
    ];
    return previous.flatMap(from => row.nodes.map(({point:to}) => ({from,to,state})));
  });
  const active = selected ? rows[selected.at - firstStop]?.nodes.find(node => node.option === selected.option) : undefined;
  const canTravel = !exploring && selected?.at === stop;
  const canPractice = isAdmin && Boolean(active?.node.site) && !canTravel;
  /** Visits use the selected site's final encounter, without sending a run action. */
  const practiceAt = () => {
    const site = active?.node.site;
    if (!canPractice || !site || !selected) return;
    const wave = buildAreaBattles(site, worldSeed, selected.at, selected.option).at(-1)?.waves.at(-1);
    if (!wave) return;
    setSelected(undefined);
    setPractice({ name: isSummit && site.kind === 'capital' ? 'The Last Citadel' : site.name,
      map: site.map, heroes: wave.heroIds, bossArena: site.kind === 'capital' || site.kind === 'dragon' });
  };
  const arena = active?.node.site?.kind === 'capital' ? bossArenaOf(active.node.heroIds) : undefined;
  const terrainName = active?.node.site?.map ?? active?.location.name;
  const locationArt = arena?.image ?? MAP_IMAGES[MAP_NAMES.findIndex(name => name === terrainName)];
  const counts = active?.node.site ? areaCounts(active.node.site) : undefined;
  const typeLabel = (node: Stop) => node.site?.kind === 'capital'
    ? regionIndex >= GRANDANGEL_BOSSES.length ? 'Final Boss' : 'Region Boss'
    : node.site?.kind === 'dragon' ? 'Area Boss' : node.site?.cityBoss ? 'City Boss' : undefined;
  useLayoutEffect(() => {
    const scroller = map.current;
    if (!scroller) return;
    scroller.scrollTop = stop === firstStop
      ? scroller.scrollHeight
      : Math.max(0, (activeMarker.current?.offsetTop ?? 0) - scroller.clientHeight * .56);
    scroller.focus({ preventScroll: true });
  }, [firstStop, stop, practice]);

  const hasActiveDestination = Boolean(active);
  useLayoutEffect(() => {
    if (!hasActiveDestination) return;
    const update = () => {
      if (selectedMarker.current) positionPopover(selectedMarker.current);
    };
    const scrollArea = map.current;
    scrollArea?.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      scrollArea?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [hasActiveDestination, positionPopover]);

  const popoverStyle: (CSSProperties & { '--atlas-caret': string }) | undefined = popover && {
    left: popover.left,
    '--atlas-caret': popover.caret + 'px',
    ...(popover.side === 'above' ? { bottom: popover.edge } : { top: popover.edge }),
  };
  const position = ({x,y}: AtlasPoint) => ({ left: (100 * x / ATLAS_WIDTH) + '%', top: (100 * y / ATLAS_HEIGHT) + '%' });
  if (isAdmin && practice) return <SandboxView atlasVisit={practice} onExit={() => setPractice(undefined)} />;
  return <section className="conquest-map map-fullbleed prelude-enter" aria-label={exploring ? theme.name + ' practice map' : region ? region + ' map' : 'Conquest map'}
    onPointerDownCapture={event => {
      if (active && event.target instanceof Element && !event.target.closest('.atlas-destination-popover, .atlas-destination, .atlas-inspectable')) setSelected(undefined);
    }}
    onKeyDown={event => {
      if (event.key === 'Escape' && selected !== undefined) {
        setSelected(undefined);
        selectedMarker.current?.focus({ preventScroll: true });
      }
    }}>
    {exploring && !showWorld && <div className="atlas-ascent atlas-browse-back"><button type="button" onClick={() => { setSelected(undefined); setBrowseRegion(undefined); }}>Back to conquest</button></div>}
    {isCampaign && <div className="atlas-ascent" hidden={showWorld}>
      <button ref={worldTrigger} type="button" aria-controls="full-world-atlas" onClick={() => {
        setSelected(undefined);
        setShowWorld(true);
      }}>World map</button>
    </div>}
    {showWorld && <WorldAtlas current={regionIndexOf(runStop)}
      {...(isAdmin && { onVisit: (index: number) => {
        setSelected(undefined);
        setBrowseRegion(index);
        setShowWorld(false);
      } })}
      onBack={() => {
      setShowWorld(false);
      requestAnimationFrame(() => worldTrigger.current?.focus({ preventScroll: true }));
    }} />}
    <div className="conquest-map-scroll atlas-scrollbar-hidden" ref={map} tabIndex={showWorld ? -1 : 0} inert={showWorld} aria-hidden={showWorld || undefined} aria-label="Scrollable kingdom map">
      <div className="conquest-map-atlas">
        <AtlasInk seed={atlasSeed} links={links} selected={canTravel ? active?.point : undefined} regionIndex={regionIndex} />
        {isCampaign && !isSummit && <div className="atlas-regional-note" style={position({x: 421, y: 44})}><strong>{theme.name}</strong><small>{theme.landmark}</small></div>}
        {isSummit && <div className="atlas-city atlas-gateway" style={position(summitGate)}>
          <AtlasLandmark mark="crossing" /><strong>Gate to Purgatory</strong><small>World Summit</small>
        </div>}
        {rows.map(row => row.nodes.map(({ node, option, location, point, mark }) => {
          const name = isSummit && node.site?.kind === 'capital' ? 'The Last Citadel' : location.name;
          const available = !exploring && row.at === stop;
          const inspected = selected?.at === row.at && selected.option === option;
          return <button type="button" key={row.at + ':' + option}
            className={available ? 'atlas-destination' : 'atlas-city atlas-inspectable'}
            data-state={available ? 'open' : row.at < stop ? 'past' : 'future'}
            aria-label={name} aria-expanded={inspected} aria-pressed={inspected}
            ref={available && option === 0 ? activeMarker : undefined} style={position(point)}
            onClick={event => {
              selectedMarker.current = event.currentTarget;
              positionPopover(event.currentTarget);
              setSelected(current => current?.at === row.at && current.option === option ? undefined : {at: row.at, option});
            }}>
            <AtlasLandmark mark={mark} /><strong>{name}</strong>
            {typeLabel(node) && <small>{typeLabel(node)}</small>}
          </button>;
        }))}
        <div className="atlas-origin" style={position(origin)}>
          <AtlasLandmark mark="crossing"/><strong>{firstStop === 1 ? 'The Crossing' : 'Into the region'}</strong>
          {firstStop === 1 && <small>A Sin rises here</small>}
        </div>
      </div>
    </div>
    {active && popover && <div className="atlas-destination-popover" role="group" aria-label="Destination details"
      data-side={popover.side}
      style={popoverStyle}>
      <div className="atlas-popover-content">
        <button type="button" className="atlas-popover-close" aria-label="Dismiss destination details" onClick={() => {
          setSelected(undefined);
          selectedMarker.current?.focus({ preventScroll: true });
        }}>×</button>
        {locationArt && <ProgressiveImg className="atlas-popover-art" src={locationArt} alt="" />}
        <span className="atlas-popover-kind">{typeLabel(active.node) ?? 'Battle route'}</span>
        <strong>{isSummit && active.node.site?.kind === 'capital' ? 'The Last Citadel' : active.location.name}</strong>
        <p>{isSummit && active.node.site?.kind === 'capital' ? 'Beyond the summit gate, Archangel Mikhael awaits in Purgatory.' : active.location.flavour}</p>
        {counts && <small>{counts.battles} {counts.battles === 1 ? 'battle' : 'battles'} · {counts.rooms} {counts.rooms === 1 ? 'room' : 'rooms'}</small>}
        {canTravel ? <Button variant="menuPrimary" onClick={() => onChoose(active.option)}>Travel here</Button>
          : canPractice ? <Button variant="menuPrimary" onClick={practiceAt}>Visit in practice</Button>
          : <span className="atlas-location-state">{selected && selected.at < stop ? 'Already passed' : 'Not yet reachable'}</span>}
      </div>
    </div>}
  </section>;
}

/** The next pair opens only after the current region is conquered. */
export function RegionCrossroads({ stop, conquered, campaign, onChoose }: {
  stop: number; conquered: string; campaign?: boolean; onChoose: (option: RegionChoice) => void;
}) {
  const [selected, setSelected] = useState<RegionChoice>();
  const index = regionIndexOf(stop);
  const choices = regionChoices(index, campaign);
  return <section className="conquest-map region-crossroads prelude-enter" aria-label="Choose the next region">
    <header>
      <p>{conquered} conquered</p>
      <h1>Choose the next region</h1>
    </header>
    <div className="conquest-map-scroll region-crossroads-scroll" tabIndex={0}>
      <div className="region-choices">
        {choices.map((option, i) => {
          const choice = i === 0 ? 0 : 1;
          const image = MAP_IMAGES[MAP_NAMES.findIndex(name => name === option.map)];
          return <button type="button" className="region-choice" key={option.name} aria-pressed={selected === choice} onClick={() => setSelected(choice)}>
            {image && <ProgressiveImg src={image} alt="" />}
            <span><small>{campaign ? ATLAS_REGIONS[index]?.name : 'Region ' + (index + 1)}</small><strong>{option.name}</strong><small>{campaign ? ATLAS_REGIONS[index]?.angel : option.map}</small></span>
          </button>;
        })}
        <svg viewBox="0 0 600 80" preserveAspectRatio="none" className="region-route-lines" aria-hidden="true">
          <path d="M150 0Q150 45 300 75M450 0Q450 45 300 75" />
        </svg>
        <div className="region-conquered"><CitySeal citadel /><span>{conquered}</span><small>Conquered</small></div>
      </div>
    </div>
    <footer>
      <span>{selected === undefined ? 'Two regions are now open' : choices[selected].name}</span>
      <Button variant="menuPrimary" disabled={selected === undefined} onClick={() => selected !== undefined && onChoose(selected)}>Travel to region</Button>
    </footer>
  </section>;
}

/** One seeded meeting per run. The artifact leaves Hell with the player if chosen. */
export function ConquestPrelude({ seed, options, worldSeed, atlasOptions, onChoose }: {
  seed: string; options: readonly Stop[]; worldSeed?: string; atlasOptions?: (stop: number) => readonly Stop[];
  onChoose: (option: number, artifact?: HellArtifactId) => void;
}) {
  const saveKey = 'villain-arc:conquest-gift:' + seed;
  const [accepted, setAccepted] = useState<HellArtifactId | 'accepted' | undefined>(() => {
    try {
      const saved = sessionStorage.getItem(saveKey);
      return isHellArtifact(saved) || saved === 'accepted' ? saved : undefined;
    } catch { return undefined; }
  });
  const [selected, setSelected] = useState<HellArtifactId>();
  const [host] = pickOne(hashSeed('conquest-sin:' + seed), HOSTS);
  if (accepted) return <ConquestMap options={options} {...(worldSeed && {worldSeed})} {...(atlasOptions && {atlasOptions})}
    onChoose={option => onChoose(option, isHellArtifact(accepted) ? accepted : undefined)} />;
  const labelSide = host.side === 'right' ? 'left' : 'right';
  return <section className="sin-prelude prelude-enter" aria-label="A meeting before revival"
    data-label-side={labelSide} style={{ '--sin-lair': 'url("' + host.backdrop + '")', '--sin-focus': host.focus } as CSSProperties}>
    <div className="sin-prelude-content">
      <SinLairMotion host={host.name} art={host.backdrop} />
      <div className="sin-lair-art" aria-hidden="true" />
      <div className="sin-host-voice">
        <header className="sin-host-name"><h1>{host.name}</h1><p>{host.lair}</p></header>
        <SpeechBubble className="sin-line sin-speech-desktop" tail={labelSide === 'left' ? 'right' : 'left'}>{host.line}</SpeechBubble>
      </div>
      <SpeechBubble className="sin-speech-mobile" tail={labelSide === 'left' ? 'up-right' : 'up-left'}>{host.line}</SpeechBubble>
      <div className="sin-artifacts">
        <header><h2>Artifacts from Hell</h2><p>Take one to Earth. This run only.</p></header>
        <ul className="sin-artifact-list">
          {HELL_ARTIFACTS.map(artifact => <li key={artifact.id}>
            <button type="button" className="sin-artifact" aria-pressed={selected === artifact.id}
              onClick={() => setSelected(artifact.id)}>
              <span className="sin-artifact-icon" style={{ color: artifact.color }}><Glyph name={artifact.icon} /></span>
              <span><strong>{artifact.name}</strong><small>{artifact.detail}</small></span>
            </button>
          </li>)}
        </ul>
        <Button className="sin-artifact-action" variant="menuPrimary" disabled={!selected} onClick={() => {
          if (!selected) return;
          try { sessionStorage.setItem(saveKey, selected); } catch { /* storage is optional */ }
          setAccepted(selected);
        }}>Bring artifact</Button>
      </div>
    </div>
  </section>;
}
