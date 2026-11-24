// ===================================================================
// HERO SHOTS
// When an archer looses, its arrow leaves the bow (see HeroFigure,
// which hides the arrow at the release) and flies across the screen
// into the villain's portrait. Drawn in viewport pixels on a fixed,
// click-through layer, so it can cross from the battlefield into the
// bottom band.
// TIMING: each shot is laid out when the hero's move starts and waits
// SHOT_RELEASE_MS (the release point in the draw) before it flies.
// ===================================================================

import { useEffect, useRef, useState } from 'react';
import type { HeroAction } from '../../../content/heroLooks';
import {
  HERO_UID_ATTR,
  VILLAIN_ANCHOR_ATTR,
  type Point,
} from '../../../hooks/useCardDrag';
import { HERO_ATTACK_MS } from '../../../hooks/useHeroTurn';
import { Projectile, type ProjectileFlight } from './Projectile';

// --- TYPES ---
type Shot = { id: number; from: Point; to: Point };

/** A hero's shot as a projectile: an arrow, loosed at the release. */
const asFlight = (shot: Shot): ProjectileFlight => ({
  ...shot,
  kind: 'arrow',
  delayMs: SHOT_RELEASE_MS,
});

// --- CONSTANTS ---
/** When in the draw the string is loosed (matches arrow-loose, 57%). */
const SHOT_RELEASE_MS = Math.round(HERO_ATTACK_MS * 0.57);
/** How long the arrow is in the air (matches --animate-hero-shot). */
const SHOT_FLIGHT_MS = 220;

// --- HELPERS ---
/** The middle of an element's box on screen, or null if it is gone. */
const centreOf = (element: Element | null): Point | null => {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

/** Where a hero's shot starts (its arrow on the string) and lands. */
const shotPath = (uid: number): { from: Point; to: Point } | null => {
  const hero = document.querySelector(`[${HERO_UID_ATTR}="${uid}"]`);
  const from =
    centreOf(hero?.querySelector('.hero-arrow') ?? null) ?? centreOf(hero);
  const to = centreOf(document.querySelector(`[${VILLAIN_ANCHOR_ATTR}]`));
  return from && to ? { from, to } : null;
};

// --- HOOKS ---
/**
 * The arrows in flight. A shot starts when a hero begins a Range move
 * (each move fires once, even while it stays in the acting list) and
 * removes itself after it lands.
 */
const useShots = (acting: ReadonlyMap<number, HeroAction>): Shot[] => {
  const [shots, setShots] = useState<Shot[]>([]);
  const shootingRef = useRef(new Set<number>());
  const nextIdRef = useRef(0);

  // NEW RANGE MOVES -> NEW SHOTS
  useEffect(() => {
    const shooting = new Set(
      [...acting].flatMap(([uid, action]) =>
        action.style === 'range' ? [uid] : []
      )
    );
    const fresh = [...shooting]
      .filter((uid) => !shootingRef.current.has(uid))
      .flatMap((uid) => {
        const path = shotPath(uid);
        return path ? [{ id: nextIdRef.current++, ...path }] : [];
      });
    shootingRef.current = shooting;
    if (fresh.length === 0) return;
    setShots((current) => [...current, ...fresh]);
    const ids = fresh.map((shot) => shot.id);
    // No cleanup on purpose: a newer shot must not cancel this removal.
    window.setTimeout(
      () => setShots((current) => current.filter((s) => !ids.includes(s.id))),
      SHOT_RELEASE_MS + SHOT_FLIGHT_MS + 50
    );
  }, [acting]);

  return shots;
};

// --- COMPONENT ---
/** Renders every arrow in flight from its archer to the villain. */
export const HeroShots = ({
  acting,
}: {
  acting: ReadonlyMap<number, HeroAction>;
}) => {
  const shots = useShots(acting);
  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {shots.map((shot) => (
        <Projectile key={shot.id} flight={asFlight(shot)} />
      ))}
    </div>
  );
};
