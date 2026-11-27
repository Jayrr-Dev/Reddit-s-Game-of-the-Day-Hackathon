import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { hashSeed, pickOne } from '../../../shared/game/rng';
import { areaCounts, conquestStops, GRANDANGEL_BOSSES } from '../../../shared/game/conquestAreas';
import { REGION_NAMES, STOPS_PER_REGION } from '../../../shared/game/rules';
import { regionChoices, type RegionChoice } from '../../../shared/game/regionRoutes';
import { regionIndexOf, type Stop } from '../../../shared/game/kingdom';
import { routeLocation } from './routeLocation';
import { STOP_COPY } from '../../content/lore';
import { MAP_IMAGES, MAP_NAMES } from './combat/Backdrop';
import { ProgressiveImg } from '../ui/ProgressiveImage';
import { Button } from '../ui/Button';
import greed from '../../assets/npcs/greed-gilded-vault.webp';
import sloth from '../../assets/npcs/sin-lair-sloth.webp';
import envy from '../../assets/npcs/sin-lair-envy.webp';
import gluttony from '../../assets/npcs/sin-lair-gluttony.webp';
import lust from '../../assets/npcs/sin-lair-lust.webp';
import pride from '../../assets/npcs/sin-lair-pride.webp';
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

const CITY_POSITIONS = [
  [50, 45], [27, 35], [72, 28], [41, 20], [66, 12], [50, 5],
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

/** Scroll from the crossing upward; only current destinations can start a fight. */
export function ConquestMap({ stop = 1, region, route, options, onChoose }: {
  stop?: number; region?: string; route?: RegionChoice | undefined;
  options: readonly Stop[]; onChoose: (option: number) => void;
}) {
  const map = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [selected, setSelected] = useState<number>();
  const isCampaign = options.some(node => node.site);
  const locationOf = (option: number, node: Stop) => node.site ?? (node.kind === 'greed-bargain'
    ? { name: 'The Gilded Vault', flavour: STOP_COPY[node.kind].blurb }
    : routeLocation(stop, option, node.kind, route));
  const active = selected === undefined ? undefined : options[selected];
  const place = selected === undefined || !active ? undefined : locationOf(selected, active);
  const landmarks = Array.from({ length: STOPS_PER_REGION }, (_, i) =>
    routeLocation(stop - (stop - 1) % STOPS_PER_REGION + i, 0, i === STOPS_PER_REGION - 1 ? 'champion' : 'horde', route).name);
  const regionEnd = (regionIndexOf(stop) + 1) * STOPS_PER_REGION;
  const capital = isCampaign ? conquestStops('atlas', regionEnd, route)[0]?.site : undefined;
  const labels = isCampaign && capital ? [capital.name, ...new Set(landmarks.slice(0, -1))]
    : stop === 1 ? REGION_NAMES : [...new Set(landmarks)];
  const counts = active?.site ? areaCounts(active.site) : undefined;
  useLayoutEffect(() => {
    if (map.current) map.current.scrollTop = map.current.scrollHeight;
    title.current?.focus({ preventScroll: true });
  }, []);
  return <section className="conquest-map prelude-enter" aria-label="Conquest map">
    <header>
      <h1 ref={title} tabIndex={-1}>{stop === 1 ? 'The Road to the Throne' : region}</h1>
      <p>{stop === 1 ? 'Pick your first destination. Scroll up to see the regions ahead.' : 'Choose your next destination in this region.'}</p>
    </header>
    <div className="conquest-map-scroll" ref={map} tabIndex={0} aria-label="Scrollable kingdom map">
      <div className="conquest-map-atlas">
        <svg className="conquest-map-ink" viewBox="0 0 600 900" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id="atlas-lines" width="108" height="134" patternUnits="userSpaceOnUse">
              <path d="M-8 83Q38 20 110 35M-7 93Q38 27 116 46M-9 105Q42 42 116 57M-7 118Q46 55 116 66" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="600" height="900" fill="url(#atlas-lines)" opacity=".35" />
          <path className="atlas-river" d="M-10 399C136 474 92 526 209 556S452 469 621 614" />
          <path className="atlas-future" d="M300 405C230 384 221 348 162 315S340 274 432 252S288 215 246 180S396 136 396 108S300 73 300 45" />
          <path className="atlas-road" d="M300 405C283 483 164 534 156 621S229 756 300 810M300 405C332 477 444 548 444 621S393 746 300 810" />
        </svg>
        {labels.map((name, i) => {
          const position = CITY_POSITIONS[i];
          if (!position) return null;
          return <div key={name} className="atlas-city" style={{ left: position[0] + '%', top: position[1] + '%' }}><CitySeal citadel={name === capital?.name || i >= 3} location={name} /><span>{name === capital?.name ? <small>Capital city</small> : stop === 1 && !isCampaign && <small>Region {i + 1}</small>}{name}</span></div>;
        })}
        {options.map((stop, i) => {
          const location = locationOf(i, stop);
          return <button type="button" key={i} className="atlas-destination" aria-pressed={selected === i}
            aria-label={location.name} style={{ left: (options.length === 1 ? 50 : 26 + (48 * i) / (options.length - 1)) + '%' }}
            onClick={() => setSelected(i)}>
            <CitySeal location={location.name} /><strong>{location.name}</strong><small>{stop.site?.kind === 'capital' ? (regionIndexOf(regionEnd) >= GRANDANGEL_BOSSES.length ? 'Capital · Final Boss' : 'Capital · Region Boss') : stop.site?.kind === 'dragon' ? 'Area Boss' : stop.site?.cityBoss ? 'City Boss' : stop.site ? 'Battle route' : STOP_COPY[stop.kind].title}</small>
          </button>;
        })}
        <div className="atlas-origin"><span aria-hidden="true">◆</span><strong>{stop === 1 ? 'The Crossing' : 'You are here'}</strong><small>{stop === 1 ? 'Wraith rises here' : 'Stop ' + ((stop - 1) % STOPS_PER_REGION + 1) + ' of ' + STOPS_PER_REGION}</small></div>
      </div>
    </div>
    <footer>
      <span>{place ? <><strong>{place.name}</strong><small>{place.flavour}</small>{counts && <small>{counts.battles} {counts.battles === 1 ? 'battle' : 'battles'} · {counts.rooms} rooms</small>}</> : 'Choose a destination on the map'}</span>
      <Button variant="menuPrimary" disabled={selected === undefined} onClick={() => selected !== undefined && onChoose(selected)}>Confirm destination</Button>
    </footer>
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
            <span><small>Region {index + 1}</small><strong>{option.name}</strong><small>{option.map}</small></span>
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

/** One seeded meeting per run; the placeholder gift never changes game state. */
export function ConquestPrelude({ seed, options, onChoose }: { seed: string; options: readonly Stop[]; onChoose: (option: number) => void }) {
  const saveKey = 'villain-arc:conquest-gift:' + seed;
  const [accepted, setAccepted] = useState(() => {
    try { return sessionStorage.getItem(saveKey) === 'accepted'; } catch { return false; }
  });
  const [host] = pickOne(hashSeed('conquest-sin:' + seed), HOSTS);
  if (accepted) return <ConquestMap options={options} onChoose={onChoose} />;
  return <section className="sin-prelude prelude-enter" aria-label="A meeting before revival"
    data-side={host.side} style={{ '--sin-lair': 'url("' + host.backdrop + '")', '--sin-focus': host.focus } as CSSProperties}>
    <div className="sin-prelude-stage" aria-hidden="true" />
    <div className="sin-prelude-scene">
      <header><p>{host.lair}</p><h1>{host.name}</h1></header>
      <p className="sin-prelude-line">“{host.line}”</p>
      <div className="sin-prelude-offer">
        <div><strong>Gift they will offer</strong><small>Placeholder</small></div>
        <Button variant="menuPrimary" onClick={() => {
          try { sessionStorage.setItem(saveKey, 'accepted'); } catch { /* storage is optional */ }
          setAccepted(true);
        }}>Accept gift</Button>
      </div>
    </div>
  </section>;
}

