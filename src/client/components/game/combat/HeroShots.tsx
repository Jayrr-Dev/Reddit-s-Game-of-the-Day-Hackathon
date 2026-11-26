// ===================================================================
// HERO SHOTS
// When an archer looses, its arrow leaves the bow (see HeroFigure,
// which hides the arrow at the release) and flies across the screen
// at the middle of the screen (you see it through the villain's eyes;
// see PovImpact), each a little off centre. Drawn in viewport pixels on a fixed,
// click-through layer, so it can cross from the battlefield into the
// bottom band.
// TIMING: each shot is laid out when the hero's move starts and waits
// SHOT_RELEASE_MS (the release point in the draw) before it flies.
// ===================================================================

import { useEffect, useRef, useState } from 'react';
import type { HeroAction } from '../../../content/heroLooks';
import { HERO_UID_ATTR, type Point } from '../../../hooks/useCardDrag';
import { spread } from '../../../lib/seeded';
import { HERO_SHOT_RELEASE_MS as SHOT_RELEASE_MS, HERO_SHOT_FLIGHT_MS as SHOT_FLIGHT_MS } from '../../../hooks/useHeroTurn';
import { POV_ANCHOR_ATTR } from './PovImpact';
import { Projectile, type ProjectileFlight } from './Projectile';

// --- TYPES ---
type Shot = { id: number; from: Point; to: Point; kind: 'arrow' | 'lightning' };

/** A hero's shot as a projectile: an arrow, loosed at the release. */
const asFlight = (shot: Shot): ProjectileFlight => ({
  ...shot,
  delayMs: SHOT_RELEASE_MS,
});

// --- HELPERS ---
/** The middle of an element's box on screen, or null if it is gone. */
const centreOf = (element: Element | null): Point | null => {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

/** How far (px) a shot lands from the screen's middle, at most. */
const AIM_SCATTER_PX = 60;

/**
 * Where a hero's shot starts (its arrow on the string) and lands: the
 * middle of the screen, nudged by the shot's seed so a volley spreads.
 */
const shotPath = (
  uid: number,
  seed: number,
  kind: Shot['kind']
): { from: Point; to: Point } | null => {
  const hero = document.querySelector(`[${HERO_UID_ATTR}="${uid}"]`);
  const from =
    centreOf(hero?.querySelector(kind === 'lightning' ? '[data-fulgur-cast-origin]' : '[data-woodland-arrow-origin], .hero-arrow') ?? null) ?? centreOf(hero);
  const centre = centreOf(document.querySelector(`[${POV_ANCHOR_ATTR}]`));
  if (!from || !centre) return null;
  const to = {
    x: centre.x + spread(seed, 1) * (kind === 'lightning' ? 10 : AIM_SCATTER_PX),
    y: centre.y + spread(seed, 2) * (kind === 'lightning' ? 10 : AIM_SCATTER_PX),
  };
  return { from, to };
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
    const shooting = new Map<number, Shot['kind']>();
    for (const [uid, action] of acting) {
      if (action.style === 'range') shooting.set(uid, 'arrow');
      else if (action.style === 'magic' &&
        document.querySelector('[' + HERO_UID_ATTR + '="' + uid + '"] [data-fulgur-cast-origin]')) {
        shooting.set(uid, 'lightning');
      }
    }
    const fresh = [...shooting]
      .filter(([uid]) => !shootingRef.current.has(uid))
      .flatMap(([uid, kind]) => {
        const id = nextIdRef.current++;
        const path = shotPath(uid, id, kind);
        return path ? [{ id, kind, ...path }] : [];
      });
    shootingRef.current = new Set(shooting.keys());
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
