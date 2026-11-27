import { Glyph } from '../../ui/Glyph';

type HealthShieldProps = { hp: number; maxHp: number };

/** A compact HP meter: the shield darkens across its entire face as HP falls. */
export function EnemyHealthShield({ hp, maxHp }: HealthShieldProps) {
  const fullness = Math.max(0, Math.min(100, hp / Math.max(1, maxHp) * 100));
  return (
    <div className="enemy-health-shield" role="meter" aria-label="Enemy health"
      aria-valuemin={0} aria-valuenow={hp} aria-valuemax={maxHp}>
      <svg className="enemy-health-shield-shape" viewBox="0 0 24 16" preserveAspectRatio="none" aria-hidden="true">
        <path d="M.75 .75H23.25V9.75L12 15.2L.75 9.75Z" vectorEffect="non-scaling-stroke"
          style={{ fill: `color-mix(in srgb, var(--color-hp) ${fullness}%, black)` }} />
      </svg>
      <span aria-hidden="true">{hp <= 0 ? <Glyph name="skull" className="size-[9px] text-white" /> : hp}</span>
    </div>
  );
}
