import { EXPLORE_RESUPPLY_FRACTION, KEEP_FIGHTING_GOLD_RATE } from '../../../shared/game/battleTiers';
import { REST_FRACTION } from '../../../shared/game/conquestAreas';
import { healingAmount } from '../../../shared/game/character';
import type { RunAction, RunState } from '../../../shared/game/run';
import { Button } from '../ui/Button';
import { OfferView } from './OfferView';
import { BorrowedPowerChoices } from './BorrowedPowerView';

/** The player can recover, search, or press on without resetting the battle. */
export function BattleRespite({ run, endless, onAction, onExit }: {
  run: RunState; endless: boolean; onAction: (action: RunAction) => void; onExit?: (() => void) | undefined;
}) {
  if (run.phase.kind !== 'combat' || !run.area?.respite) return null;
  const area = run.area;
  const { combat } = run.phase;
  const wave = (area.waveBase ?? 0) + area.wave + 1;
  const recover = (fraction: number) => Math.min(combat.player.maxHp - combat.player.hp,
    healingAmount(Math.ceil(run.maxHp * fraction), { ...run.character, ...(combat.player.borrowedStats && { borrowedStats: combat.player.borrowedStats }) }));
  if (area.respite?.powers) return <BorrowedPowerChoices powers={area.respite.powers} caption="Choose one power for this run."
    onPick={index => onAction({ type: 'takeBorrowedPower', index })}
    onBack={() => onAction({ type: 'closeBorrowedPowers' })} />;
  const offers = area.respite?.offers;
  if (offers) return <main className="run-results results-layout">
    <OfferView title="Marching spoils" subtitle="Pick a card to add to your discard pile, or skip." offers={offers} onAction={onAction} />
    {onExit && <Button variant="menu" className="min-w-44" onClick={onExit}>Endless menu</Button>}
  </main>;
  return <main className="run-results results-layout" aria-labelledby="respite-title">
    <header>
      <h1 id="respite-title">Respite</h1>
      <p className="mt-2 text-sm text-ink-muted">Wave {wave} cleared</p>
    </header>
    <div className="grid w-full max-w-64 gap-2">
      <Button variant="menu" aria-describedby="respite-rest" onClick={() => onAction({ type: 'battleRespite', choice: 'rest' })}>Rest</Button>
      <small id="respite-rest">Recover {recover(REST_FRACTION)} HP</small>
      <Button variant="menu" disabled={endless} aria-describedby="respite-explore" onClick={() => onAction({ type: 'battleRespite', choice: 'explore' })}>Explore</Button>
      <small id="respite-explore">{endless ? 'Events coming later' : 'Recover ' + recover(EXPLORE_RESUPPLY_FRACTION) + ' HP; chance to find a card'}</small>
      <Button variant="menuPrimary" aria-describedby="respite-fight" onClick={() => onAction({ type: 'battleRespite', choice: endless ? 'borrow' : 'fight' })}>{endless ? 'Borrowed Power' : 'Keep Fighting'}</Button>
      <small id="respite-fight">{endless ? 'Choose one of three run-only powers' : '+' + KEEP_FIGHTING_GOLD_RATE * 100 + '% battle Gold; better card odds'}</small>
    </div>
    {onExit && <Button variant="menu" className="min-w-44" onClick={onExit}>{endless ? 'Endless menu' : 'Main menu'}</Button>}
  </main>;
}
