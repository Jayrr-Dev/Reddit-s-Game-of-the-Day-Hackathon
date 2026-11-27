type PlayerHealthProps = { hp: number; maxHp: number; hexDamage: number };

/** Red is live HP, purple forecasts Hex within that fill, and yellow trails actual loss. */
export function PlayerHealthBar({ hp, maxHp, hexDamage }: PlayerHealthProps) {
  const percent = Math.max(0, Math.min(100, hp / Math.max(1, maxHp) * 100));
  const pendingHex = Math.min(hp, hexDamage);
  const afterHex = Math.max(0, hp - pendingHex) / Math.max(1, maxHp) * 100;
  const healthText = hp + ' of ' + maxHp + ' HP';
  const lowHealth = percent > 0 && percent <= 30;
  return <div className="table-player-health" data-low-health={lowHealth || undefined} role="meter" aria-label="Player health"
    aria-valuemin={0} aria-valuenow={hp} aria-valuemax={maxHp} aria-valuetext={pendingHex > 0 ? healthText + ', ' + pendingHex + ' pending Hex damage' : healthText}>
    <span className="table-player-health-trail" style={{ width: percent + '%' }} aria-hidden="true" />
    <span className="table-player-health-fill" style={{ width: percent + '%' }} aria-hidden="true" />
    {pendingHex > 0 && (
      <span className="table-player-health-hex" style={{ left: afterHex + '%', width: (percent - afterHex) + '%' }} aria-hidden="true" />
    )}
    <span className="table-player-health-ticks" aria-hidden="true" />
    <span className="table-player-health-label" aria-hidden="true">{hp}/{maxHp}</span>
  </div>;
}
