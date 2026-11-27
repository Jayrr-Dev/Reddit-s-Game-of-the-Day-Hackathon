import { useState } from 'react';
import { Glyph } from '../../ui/Glyph';
import { Tooltip } from '../../ui/Tooltip';
import { STATUS_INFO } from '../../../../shared/game/describe';

type PlayerHealthProps = { hp: number; maxHp: number; guard: number; hexDamage: number; incomingDamage: number; burnDamage: number; lethal: boolean };

/** Remember only the current gain; taking damage or changing max HP clears it. */
function useHealFill(hp: number, maxHp: number) {
  const [previous, setPrevious] = useState({ hp, maxHp, healFrom: hp, serial: 0 });
  if (previous.hp !== hp || previous.maxHp !== maxHp) {
    const healFrom = hp > previous.hp && maxHp === previous.maxHp ? previous.hp : hp;
    setPrevious({ hp, maxHp, healFrom, serial: previous.serial + 1 });
  }
  return previous;
}

/** Preview Burn in orange, incoming hits in light red, and Hex in purple. */
export function PlayerHealthBar({ hp, maxHp, guard, hexDamage, incomingDamage, burnDamage, lethal }: PlayerHealthProps) {
  const heal = useHealFill(hp, maxHp);
  const healStart = heal.healFrom / Math.max(1, maxHp) * 100;
  const percent = Math.max(0, Math.min(100, hp / Math.max(1, maxHp) * 100));
  const guardPercent = Math.max(0, Math.min(100, guard / Math.max(1, maxHp) * 100));
  // Loss starts at the right edge and follows turn order: Burn, enemies, then Hex.
  const pendingBurn = Math.max(0, Math.min(hp, burnDamage));
  const afterBurn = hp - pendingBurn;
  const threatenedHp = Math.max(0, Math.min(afterBurn, incomingDamage));
  const afterAttacks = afterBurn - threatenedHp;
  const pendingHex = Math.min(afterAttacks, hexDamage);
  const burnStart = afterBurn / Math.max(1, maxHp) * 100;
  const attackStart = afterAttacks / Math.max(1, maxHp) * 100;
  const hexStart = (afterAttacks - pendingHex) / Math.max(1, maxHp) * 100;
  const healthText = [
    `${hp} of ${maxHp} HP`,
    guard > 0 && `${guard} Guard`,
    pendingBurn > 0 && `${pendingBurn} pending Burn damage`,
    threatenedHp > 0 && `${threatenedHp} projected enemy damage`,
    pendingHex > 0 && `${pendingHex} pending Hex damage`,
    lethal && 'ending the turn is lethal',
  ].filter(Boolean).join(', ');
  const lowHealth = percent > 0 && percent <= 30;
  return <div className="table-player-health-frame">
    {lethal && <span className="player-lethal-badge" aria-hidden="true"><Glyph name="skull" className="size-3" /></span>}
    <div className="table-player-health" data-low-health={lowHealth || undefined} role="meter" aria-label="Player health"
      aria-valuemin={0} aria-valuenow={hp} aria-valuemax={maxHp} aria-valuetext={healthText}>
      <span className="table-player-health-trail" style={{ width: percent + '%' }} aria-hidden="true" />
      <span className="table-player-health-fill" style={{ width: percent + '%' }} aria-hidden="true" />
      {guardPercent > 0 && (
        <span className="table-player-health-guard" data-overflow={guard > maxHp || undefined}
          style={{ width: guardPercent + '%' }} aria-hidden="true" />
      )}
      {pendingBurn > 0 && (
        <span className="table-player-health-burn" style={{ left: burnStart + '%', width: (percent - burnStart) + '%' }} aria-hidden="true" />
      )}
      {threatenedHp > 0 && (
        <span className="table-player-health-threat" style={{ left: attackStart + '%', width: (burnStart - attackStart) + '%' }} aria-hidden="true" />
      )}
      {pendingHex > 0 && (
        <span className="table-player-health-hex" style={{ left: hexStart + '%', width: (attackStart - hexStart) + '%' }} aria-hidden="true" />
      )}
      {heal.hp === hp && percent > healStart && (
        <span key={heal.serial} className="table-player-health-heal"
          style={{ left: healStart + '%', width: (percent - healStart) + '%' }} aria-hidden="true" />
      )}
      <span className="table-player-health-ticks" aria-hidden="true" />
      <span className="table-player-health-label" aria-hidden="true">{hp}/{maxHp}</span>
    </div>
    {guard > 0 && (
      <span className="table-guard-count">
        <Tooltip opensOn="click" content={{ title: STATUS_INFO.guard.label, description: STATUS_INFO.guard.description }}>
          <button type="button" className="hand-guard" aria-label={`Guard: ${guard}`}>
            <span>{guard}</span>
          </button>
        </Tooltip>
      </span>
    )}
  </div>;
}
