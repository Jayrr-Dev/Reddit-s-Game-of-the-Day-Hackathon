import { useEffect, useState } from 'react';
import { getCard } from '../../../shared/game/cards';
import { createCombatant } from '../../../shared/game/combatant';
import type { PlayerBuild } from '../../../shared/game/playerBuild';
import { starterNames, starterDeck, signatures, type StarterName } from '../../../shared/game/starters';
import { apiClient } from '../../lib/apiClient';
import { localBuild } from '../../lib/playerBuild';
import { Button } from '../ui/Button';
import { PileDialog } from './combat/PileDialog';

export function StarterPicker({ accountId, starting, onBack, onConfirm }: {
  accountId?: string | undefined; starting: boolean; onBack:()=>void; onConfirm:(build:PlayerBuild)=>void;
}) {
  const [build,setBuild]=useState(()=>localBuild(accountId));
  const [inspect,setInspect]=useState<StarterName|null>(null);
  const [loading,setLoading]=useState(!!accountId);
  const [error,setError]=useState(false);
  const [retry,setRetry]=useState(0);
  const [attacker]=useState(()=>createCombatant(66, 66));
  useEffect(()=>{
    if(!accountId)return;
    let live=true;setLoading(true);setError(false);
    apiClient.profile().then(result=>{if(live)setBuild(result.build);})
      .catch(()=>{if(live)setError(true);}).finally(()=>{if(live)setLoading(false);});
    return ()=>{live=false;};
  },[accountId,retry]);
  return <main className="starter-picker"><header><h1>Choose your starter deck</h1></header>
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
    <footer><Button variant="menu" disabled={starting} onClick={onBack}>Back</Button>
      <Button variant="menuPrimary" disabled={loading||error||starting} onClick={()=>onConfirm(build)}>{starting?'Starting…':'Begin as '+build.selected}</Button></footer>
    {inspect && <PileDialog pile="deck" titleOverride={inspect+' starter deck'} cards={build.decks[inspect]??starterDeck(inspect)} attacker={attacker} killsThisTurn={0} usesSpent={{}} onClose={()=>setInspect(null)}/>}
  </main>;
}
