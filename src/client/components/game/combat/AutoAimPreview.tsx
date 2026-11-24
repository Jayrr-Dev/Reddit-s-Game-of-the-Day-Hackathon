// ===================================================================
// AUTO-AIM PREVIEW
// While a card is raised in the hand, an arrow runs from it to each
// hero a second tap would hit (see autoTargets), so the player sees
// where the game will aim before letting it. Same arrow as dragging
// (AimArrow), skull and all. Positions are read from the DOM: the
// raised card's top edge and the middle of each hero's drawing.
// ===================================================================

import { useEffect, useState } from 'react';
import {
  HELD_CARD_ATTR,
  HERO_ANCHOR_ATTR,
  HERO_UID_ATTR,
  type Point,
} from '../../../hooks/useCardDrag';
import { AimArrow } from './AimArrow';

// --- TYPES ---
type Aim = { uid: number; to: Point };
/** Measured arrows, tagged with the targets they were measured for. */
type Layout = { key: string; from: Point; aims: Aim[] };

// --- CONSTANTS ---
/**
 * Re-measure this long (ms) after a change, once the raised card has
 * finished standing up (its slot transition is 200ms).
 */
const SETTLE_MS = 240;

// --- HELPERS ---
/** The middle of the raised card's top edge, or null if none. */
const heldCardTop = (): Point | null => {
  const card = document.querySelector(`[${HELD_CARD_ATTR}]`);
  if (!card) return null;
  const rect = card.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top };
};

/** The middle of a hero's drawing, or null if it is not on screen. */
const heroMiddle = (uid: number): Point | null => {
  const body = document.querySelector(
    `[${HERO_UID_ATTR}="${uid}"] [${HERO_ANCHOR_ATTR}]`
  );
  if (!body) return null;
  const rect = body.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

/** Where every preview arrow starts and ends right now. */
const measure = (key: string): Layout | null => {
  const from = heldCardTop();
  if (!from || key === '') return null;
  const aims = key
    .split(',')
    .map(Number)
    .flatMap((uid) => {
      const to = heroMiddle(uid);
      return to ? [{ uid, to }] : [];
    });
  return { key, from, aims };
};

// --- HOOK ---
/** The measured arrows, re-read when the targets change and once settled. */
const useAimLayout = (uids: readonly number[]): Layout | null => {
  const [layout, setLayout] = useState<Layout | null>(null);
  const key = uids.join(',');

  // Imperative on purpose: reads laid-out DOM positions, on the next
  // frame (after layout) and again once the raised card has settled.
  useEffect(() => {
    if (key === '') return;
    const frame = window.requestAnimationFrame(() => setLayout(measure(key)));
    const timer = window.setTimeout(() => setLayout(measure(key)), SETTLE_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [key]);

  // A layout measured for other targets is stale: show nothing until
  // the new one is read.
  return layout?.key === key ? layout : null;
};

// --- COMPONENT ---
/** Renders one gold arrow from the raised card to each previewed hero. */
export const AutoAimPreview = ({
  uids,
  isLethalOn,
}: {
  uids: readonly number[];
  isLethalOn: (uid: number) => boolean;
}) => {
  const layout = useAimLayout(uids);
  if (!layout) return null;
  return (
    <>
      {layout.aims.map(({ uid, to }) => (
        <AimArrow
          key={uid}
          from={layout.from}
          to={to}
          isLive
          isLethal={isLethalOn(uid)}
        />
      ))}
    </>
  );
};
