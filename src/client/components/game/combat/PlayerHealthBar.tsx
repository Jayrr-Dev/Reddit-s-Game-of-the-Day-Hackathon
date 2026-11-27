import { Glyph } from '../../ui/Glyph';

type PlayerHealthProps = { hp: number; maxHp: number; hexDamage: number; incomingDamage: number; burnDamage: number; lethal: boolean };

/** Preview Burn in orange, incoming hits in light red, and Hex in purple. */
export function PlayerHealthBar({ hp, maxHp, hexDamage, incomingDamage, burnDamage, lethal }: PlayerHealthProps) {
  const percent = Math.max(0, Math.min(100, hp / Math.max(1, maxHp) * 100));
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
      {pendingBurn > 0 && (
        <span className="table-player-health-burn" style={{ left: burnStart + '%', width: (percent - burnStart) + '%' }} aria-hidden="true" />
      )}
      {threatenedHp > 0 && (
        <span className="table-player-health-threat" style={{ left: attackStart + '%', width: (burnStart - attackStart) + '%' }} aria-hidden="true" />
      )}
      {pendingHex > 0 && (
        <span className="table-player-health-hex" style={{ left: hexStart + '%', width: (attackStart - hexStart) + '%' }} aria-hidden="true" />
      )}
      <span className="table-player-health-ticks" aria-hidden="true" />
      <span className="table-player-health-label" aria-hidden="true">{hp}/{maxHp}</span>
    </div>
  </div>;
}
