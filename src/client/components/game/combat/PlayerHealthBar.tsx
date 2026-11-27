type PlayerHealthProps = { hp: number; maxHp: number; hexDamage: number; incomingDamage: number };

/** Preview incoming hits in light red and Hex in purple; yellow trails actual loss. */
export function PlayerHealthBar({ hp, maxHp, hexDamage, incomingDamage }: PlayerHealthProps) {
  const percent = Math.max(0, Math.min(100, hp / Math.max(1, maxHp) * 100));
  const threatenedHp = Math.max(0, Math.min(hp, incomingDamage));
  const afterAttacks = hp - threatenedHp;
  const pendingHex = Math.min(afterAttacks, hexDamage);
  const attackStart = afterAttacks / Math.max(1, maxHp) * 100;
  const hexStart = (afterAttacks - pendingHex) / Math.max(1, maxHp) * 100;
  const healthText = [
    `${hp} of ${maxHp} HP`,
    threatenedHp > 0 && `${threatenedHp} projected enemy damage`,
    pendingHex > 0 && `${pendingHex} pending Hex damage`,
  ].filter(Boolean).join(', ');
  const lowHealth = percent > 0 && percent <= 30;
  return <div className="table-player-health" data-low-health={lowHealth || undefined} role="meter" aria-label="Player health"
    aria-valuemin={0} aria-valuenow={hp} aria-valuemax={maxHp} aria-valuetext={healthText}>
    <span className="table-player-health-trail" style={{ width: percent + '%' }} aria-hidden="true" />
    <span className="table-player-health-fill" style={{ width: percent + '%' }} aria-hidden="true" />
    {threatenedHp > 0 && (
      <span className="table-player-health-threat" style={{ left: attackStart + '%', width: (percent - attackStart) + '%' }} aria-hidden="true" />
    )}
    {pendingHex > 0 && (
      <span className="table-player-health-hex" style={{ left: hexStart + '%', width: (attackStart - hexStart) + '%' }} aria-hidden="true" />
    )}
    <span className="table-player-health-ticks" aria-hidden="true" />
    <span className="table-player-health-label" aria-hidden="true">{hp}/{maxHp}</span>
  </div>;
}
