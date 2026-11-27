import { Glyph } from '../../ui/Glyph';

type HealthShieldProps = { hp: number; maxHp: number };

const SHIELD_OUTLINE = 'M.75 .75H23.25V9.75L12 15.2L.75 9.75Z';

/** A compact HP meter: red drains right to left over a black shield. */
export function EnemyHealthShield({ hp, maxHp }: HealthShieldProps) {
  const missing = 100 - Math.max(0, Math.min(100, hp / Math.max(1, maxHp) * 100));
  return (
    <div className="enemy-health-shield" role="meter" aria-label="Enemy health"
      aria-valuemin={0} aria-valuenow={hp} aria-valuemax={maxHp}>
      <svg className="enemy-health-shield-shape" viewBox="0 0 24 16" preserveAspectRatio="none" aria-hidden="true">
        <path d={SHIELD_OUTLINE} fill="black" />
        <path d={SHIELD_OUTLINE} className="enemy-health-shield-fill"
          style={{ clipPath: `inset(0 ${missing}% 0 0) fill-box` }} />
        <path d={SHIELD_OUTLINE} className="enemy-health-shield-outline" vectorEffect="non-scaling-stroke" />
      </svg>
      <span aria-hidden="true">{hp <= 0 ? <Glyph name="skull" className="size-[9px] text-white" /> : hp}</span>
    </div>
  );
}
