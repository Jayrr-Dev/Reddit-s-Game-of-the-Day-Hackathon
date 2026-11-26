import { useEffect, type CSSProperties } from 'react';
import type { CombatFxKind } from '../../../lib/combatFx';
import groundSlam from '../../../assets/combat-fx/ground-slam-strip.webp';
import projectileSpeed from '../../../assets/combat-fx/projectile-speed-strip.webp';
import silverSlash from '../../../assets/combat-fx/silver-slash-strip.webp';
import weaponImpact from '../../../assets/combat-fx/weapon-impact-strip.webp';
import './combat-fx.css';

const strips: Record<CombatFxKind, string> = {
  'ground-slam': groundSlam,
  'projectile-speed': projectileSpeed,
  'silver-slash': silverSlash,
  'weapon-impact': weaponImpact,
};

/** Prewarm the four small sheets before the first card is played. */
export function CombatFxPreload() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const src of Object.values(strips)) new Image().src = src;
  }, []);
  return null;
}

/** A keyed instance always starts from frame zero, even if the sheet is cached. */
export function CombatFx({ kind, style, delayMs = 0 }: {
  kind: CombatFxKind;
  style?: CSSProperties;
  delayMs?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="combat-fx"
      data-combat-fx={kind}
      style={{ ...style, backgroundImage: 'url("' + strips[kind] + '")', animationDelay: delayMs + 'ms' }}
    />
  );
}
