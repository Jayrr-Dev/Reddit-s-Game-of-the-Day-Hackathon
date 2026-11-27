import { useEffect, useState, useSyncExternalStore } from 'react';
import { PANDORA_RUN_COPY, type PandoraRunEffect } from '../../../shared/game/pandora';
import type { CarryCard } from '../../../shared/game/carryCards';
import { isUniqueInDeck } from '../../../shared/game/unique';
import { getCard } from '../../../shared/game/cards';
import { createCombatant } from '../../../shared/game/combatant';
import type { PlayerBuild } from '../../../shared/game/playerBuild';
import { starterNames, starterDeck, signatures, type StarterName } from '../../../shared/game/starters';
import { apiClient } from '../../lib/apiClient';
import { getVolume, subscribeVolume } from '../../lib/gameAudio';
import { useMapAudio } from '../../lib/mapAudio';
import { localBuild } from '../../lib/playerBuild';
import { Button } from '../ui/Button';
import type { MAP_NAMES } from './combat/Backdrop';
import { PileDialog } from './combat/PileDialog';

const STARTER_THEMES = {
  Warrior: 'Castle Gates',
  Mage: 'Volcanic Pass',
  Hexer: 'Deep Forest',
  Archer: "King’s Road",
} satisfies Record<StarterName, (typeof MAP_NAMES)[number]>;

export function StarterPicker({ accountId, starting, onBack, onConfirm, testVisit }: {
  accountId?: string | undefined; starting: boolean; onBack:()=>void; onConfirm:(build:PlayerBuild, carryId?: string)=>void; testVisit?: string | undefined;
}) {
  const [build,setBuild]=useState(()=>localBuild(accountId));
  const [inspect,setInspect]=useState<StarterName|null>(null);
  const [loading,setLoading]=useState(!!accountId);
  const [error,setError]=useState(false);
  const [retry,setRetry]=useState(0);
  const [carry, setCarry] = useState<CarryCard[]>([]);
  const [queued, setQueued] = useState<{ real?: PandoraRunEffect | undefined; test?: PandoraRunEffect | undefined; testCards?: CarryCard[] }>({});
  const [carryId, setCarryId] = useState('');
  const starter = build.decks[build.selected] ?? starterDeck(build.selected);
  const selectedCarry = carry.find(card => card.id === carryId && !isUniqueInDeck(starter, card.cardId));
  const pending = selectedCarry ? (queued.testCards?.some(card => card.id === selectedCarry.id) ? queued.test : queued.real) : queued.test ?? queued.real;
  const cursed = pending && pending !== 'lasting-vigor';
  const [attacker]=useState(()=>createCombatant(66, 66));
  const musicVolume = useSyncExternalStore(subscribeVolume, () => getVolume('music'));
  useMapAudio({ mapId: STARTER_THEMES[build.selected], active: !loading && !error, bossActive: false, musicVolume: musicVolume / 100, sfxVolume: 0 });
  useEffect(()=>{
    if(!accountId)return;
    let live=true;setLoading(true);setError(false);
    Promise.all([apiClient.profile(), testVisit ? apiClient.ringShop(testVisit).catch(() => undefined) : undefined]).then(([result, test]) => {
      if (!live) return;
      setBuild(result.build);
      setQueued({ real: result.nextEffect, test: test?.nextEffect, ...(test?.carryCards && { testCards: test.carryCards }) });
      setCarry([...new Map([...(result.carryCards ?? []), ...(test?.carryCards ?? [])].map(card => [card.id, card])).values()]);
    })
      .catch(()=>{if(live)setError(true);}).finally(()=>{if(live)setLoading(false);});
    return ()=>{live=false;};
  },[accountId,retry,testVisit]);
  return <main className="starter-picker"><header><h1>Choose your starter deck</h1>
    {!loading && cursed && <p className="starter-curse" role="status"><strong>Cursed: {PANDORA_RUN_COPY[pending].title}</strong><span>{PANDORA_RUN_COPY[pending].detail.replace('your next conquest', 'this run')}</span></p>}
  </header>
    {loading ? <p>Loading decks…</p> : error ? <div role="alert">Could not load your saved decks. <Button variant="menu" onClick={()=>setRetry(retry+1)}>Retry</Button></div> :
    <div className="starter-grid">{starterNames.map(name=>{
      const selected=build.selected===name;
      return <article key={name} className="starter-option" data-selected={selected}>
        <button type="button" className="starter-select" aria-pressed={selected} aria-label={'Select '+name} disabled={starting} onClick={()=>setBuild({...build,selected:name})}>
          <span className="starter-art" data-style={name} aria-hidden="true"/>
          <span className="starter-copy"><strong>{name}</strong><small>{getCard(signatures[name]).name}</small></span>
          {selected && <span className="starter-tick" aria-hidden="true">&#10003;</span>}
        </button>
        <Button variant="menu" disabled={starting} aria-label={'Inspect '+name+' deck'} onClick={()=>setInspect(name)}>Inspect</Button>
      </article>;
    })}</div>}
    <footer className="starter-footer">
      <label className="starter-carry"><span>Bring Card</span>
        <select aria-label="Bring Card" value={selectedCarry?.id ?? ''} onChange={event => setCarryId(event.target.value)} disabled={loading || error || starting || !carry.length}>
          <option value="">{carry.length ? 'None' : 'No cards in Inventory'}</option>
          {carry.map(card => <option key={card.id} value={card.id} disabled={isUniqueInDeck(starter, card.cardId)}>{getCard(card.cardId).name} ({card.source === 'shop' ? 'Shop' : 'From Hell'})</option>)}
        </select>
      </label>
      {selectedCarry && <small>For this run only. Runs with a brought card are unranked.</small>}
      <div><Button variant="menu" disabled={starting} onClick={onBack}>Back</Button>
      <Button variant="menuPrimary" disabled={loading||error||starting} onClick={()=>onConfirm(build, selectedCarry?.id)}>{starting?'Starting.':'Begin as '+build.selected}</Button></div>
    </footer>
    {inspect && <PileDialog pile="deck" titleOverride={inspect+' starter deck'} cards={build.decks[inspect]??starterDeck(inspect)} attacker={attacker} killsThisTurn={0} usesSpent={{}} onClose={()=>setInspect(null)}/>}
  </main>;
}
