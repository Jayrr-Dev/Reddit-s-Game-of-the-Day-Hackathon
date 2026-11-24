// ===================================================================
// USE CARD FLIGHTS
// Small card backs that fly between the piles and the hand, so you can
// see where cards go:
//   draw      draw pile -> hand, one per card drawn
//   discard   hand -> discard pile, one per card discarded or played
//   remove    hand -> Remove pile, one per card played with Remove
//   shuffle   discard -> draw pile in a quick stream (the discard
//             refilled the draw pile), then the draw pile riffles,
//             and only then do the draws fly
// It only watches pile sizes between renders (no engine changes) and
// reads the piles' and the hand's places from the DOM. Display only:
// it never blocks input.
// ===================================================================

import { useLayoutEffect, useRef, useState } from 'react';
import type { CombatState } from '../../shared/game/types';
import type { Point } from './useCardDrag';

// --- TYPES ---
export type CardFlight = {
  id: number;
  from: Point;
  to: Point;
  delayMs: number;
};

type PileCounts = {
  draw: number;
  discard: number;
  removed: number;
  hand: number;
};

// --- CONSTANTS ---
/** Marks the piles and the hand in the DOM (where flights go). */
export const PILE_ATTR = 'data-pile';
export const HAND_ATTR = 'data-hand';
/** One flight's length (matches --animate-card-flight). */
export const CARD_FLIGHT_MS = 380;
/** Gap between cards flying one after another. */
const DRAW_STAGGER_MS = 70;
const SHUFFLE_STAGGER_MS = 35;
/** Most cards drawn in a shuffle stream (a long one reads as a blur). */
const SHUFFLE_MAX_CARDS = 8;
/** The draw pile's riffle after a shuffle. */
const RIFFLE_MS = 320;

// --- HELPERS ---
/** The centre of the element marked `selector`, or null. */
const centreOf = (selector: string): Point | null => {
  const rect = document.querySelector(selector)?.getBoundingClientRect();
  return rect
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    : null;
};

/** Where flights start and land. */
const anchors = () => ({
  draw: centreOf(`[${PILE_ATTR}="draw"]`),
  discard: centreOf(`[${PILE_ATTR}="discard"]`),
  removed: centreOf(`[${PILE_ATTR}="removed"]`),
  hand: centreOf(`[${HAND_ATTR}]`),
});

/** Gives the draw pile a quick riffle (transform only, Web Animations). */
const riffleDrawPile = (delayMs: number) =>
  document
    .querySelector(`[${PILE_ATTR}="draw"]`)
    ?.animate(
      [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-9deg) translateY(-3px)' },
        { transform: 'rotate(7deg) translateY(-2px)' },
        { transform: 'rotate(-3deg)' },
        { transform: 'rotate(0deg)' },
      ],
      { duration: RIFFLE_MS, delay: delayMs, easing: 'ease-out' }
    );

/** `count` flights from `from` to `to`, staggered after `startMs`. */
const flightsBetween = (
  from: Point | null,
  to: Point | null,
  count: number,
  startMs: number,
  staggerMs: number
): Omit<CardFlight, 'id'>[] =>
  from && to
    ? Array.from({ length: count }, (_, index) => ({
        from,
        to,
        delayMs: startMs + index * staggerMs,
      }))
    : [];

/**
 * The flights for one change in pile sizes. The discard pile only ever
 * shrinks when it is shuffled into the draw pile.
 */
const flightsFor = (
  before: PileCounts,
  after: PileCounts
): { flights: Omit<CardFlight, 'id'>[]; riffleAtMs: number | null } => {
  const at = anchors();
  const isShuffle = after.discard < before.discard;
  const shuffled = isShuffle
    ? flightsBetween(
        at.discard,
        at.draw,
        Math.min(before.discard, SHUFFLE_MAX_CARDS),
        0,
        SHUFFLE_STAGGER_MS
      )
    : [];
  const shuffleEndMs = isShuffle
    ? (shuffled.at(-1)?.delayMs ?? 0) + CARD_FLIGHT_MS
    : 0;
  const drawStartMs = isShuffle ? shuffleEndMs + RIFFLE_MS : 0;
  const drawn = Math.max(0, after.hand - before.hand);
  const discarded = isShuffle ? 0 : Math.max(0, after.discard - before.discard);
  const removed = Math.max(0, after.removed - before.removed);
  return {
    flights: [
      ...shuffled,
      ...flightsBetween(at.hand, at.discard, discarded, 0, DRAW_STAGGER_MS),
      ...flightsBetween(at.hand, at.removed, removed, 0, DRAW_STAGGER_MS),
      ...flightsBetween(at.draw, at.hand, drawn, drawStartMs, DRAW_STAGGER_MS),
    ],
    riffleAtMs: isShuffle ? shuffleEndMs : null,
  };
};

// --- HOOK ---
/** The card backs in flight right now. */
export const useCardFlights = (combat: CombatState): CardFlight[] => {
  const [flights, setFlights] = useState<CardFlight[]>([]);
  const countsRef = useRef<PileCounts | null>(null);
  const nextIdRef = useRef(0);
  const counts: PileCounts = {
    draw: combat.drawPile.length,
    discard: combat.discardPile.length,
    removed: combat.removedPile.length,
    hand: combat.hand.length,
  };
  const { draw, discard, removed, hand } = counts;

  // PILE SIZES CHANGED -> LAUNCH FLIGHTS (the first render only records)
  useLayoutEffect(() => {
    const before = countsRef.current;
    const after = { draw, discard, removed, hand };
    countsRef.current = after;
    if (!before) return;
    const planned = flightsFor(before, after);
    if (planned.riffleAtMs !== null) riffleDrawPile(planned.riffleAtMs);
    if (planned.flights.length === 0) return;
    const launched = planned.flights.map((flight) => ({
      ...flight,
      id: nextIdRef.current++,
    }));
    setFlights((current) => [...current, ...launched]);
    // Each batch leaves once its last card has landed.
    const lastLandsMs =
      Math.max(...launched.map((f) => f.delayMs)) + CARD_FLIGHT_MS;
    const ids = new Set(launched.map((flight) => flight.id));
    window.setTimeout(
      () => setFlights((current) => current.filter((f) => !ids.has(f.id))),
      lastLandsMs
    );
  }, [draw, discard, removed, hand]);

  return flights;
};
