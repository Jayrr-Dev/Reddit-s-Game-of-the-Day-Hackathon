type PlayerHealthProps = { hp: number; maxHp: number };

/** The red fill is live HP; the yellow layer trails damage on the same scale. */
export function PlayerHealthBar({ hp, maxHp }: PlayerHealthProps) {
  const percent = Math.max(0, Math.min(100, hp / Math.max(1, maxHp) * 100));
  const lowHealth = percent > 0 && percent <= 30;
  return <div className="table-player-health" data-low-health={lowHealth || undefined} role="meter" aria-label="Player health"
    aria-valuemin={0} aria-valuenow={hp} aria-valuemax={maxHp} aria-valuetext={hp + ' of ' + maxHp + ' HP'}>
    <span className="table-player-health-trail" style={{ width: percent + '%' }} aria-hidden="true" />
    <span className="table-player-health-fill" style={{ width: percent + '%' }} aria-hidden="true" />
    <span className="table-player-health-ticks" aria-hidden="true" />
    <span className="table-player-health-label" aria-hidden="true">{hp}/{maxHp}</span>
  </div>;
}
