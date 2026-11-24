// ===================================================================
// HERO PLATE
// The health plate that floats above every hero on the battlefield:
//   name                      (top left)
//   ====[ HP ]====            drain bar, the number in a centre shield
//   intent chips   statuses   (under the bar: next move left on white
//                              pills, statuses right on dark tiles)
// Each hero gets its own plate, so the whole horde reads at a glance.
// Plates follow the figure in screen space while their type and bars stay the same size.
// ===================================================================

import { createPortal } from 'react-dom';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  describeHeroIntent,
  type MoveIntent,
} from '../../../../shared/game/describe';
import {
  hasLongRangePassive,
  isOutOfRangeShot,
  passivesOf,
} from '../../../../shared/game/combat';
import { preferredRow, rowDepth } from '../../../../shared/game/battlefield';
import { getHero } from '../../../../shared/game/heroes';
import type { HeroUnit } from '../../../../shared/game/types';
import { HERO_STATUS_ROWS, INTENT_LOOK } from '../../../content/visuals';
import { Chip } from '../../ui/Chip';
import { StatusRow } from '../StatusRow';
import { PLATE_UID_ATTR } from '../../../hooks/usePlateSpacing';
import { DrainBar } from './DrainBar';

// --- TYPES ---
export type HeroPlateProps = {
  unit: HeroUnit;
  /** Every hero on the field (the plan shown depends on them). */
  field: readonly HeroUnit[];
};

// --- SUBCOMPONENTS ---
/** A signature move's arrow is gold, whatever it does. */
const SIGNATURE_FILL = 'var(--color-accent)';

/**
 * One planned move as ONE arrow: its first effect sets the colour and
 * leads, the rest follow inside it (Guard 6 | Wrath +1 is one action).
 */
const MoveArrow = ({ move, unit }: { move: MoveIntent; unit: HeroUnit }) => {
  const [lead, ...rest] = move.intents;
  if (!lead) return null;
  const home = preferredRow(unit);
  const position = { front: 'front', back: 'middle', horizon: 'rear' }[home];
  const direction = rowDepth(unit.row) > rowDepth(home) ? 'advance' : 'retreat';
  const positioning = unit.row === home
    ? `Holding preferred position (${position}).`
    : `Tries to ${direction} toward the ${position} after acting.`;
  return (
    <Chip
      {...INTENT_LOOK[lead.kind]}
      {...(move.isSignature ? { fill: SIGNATURE_FILL } : {})}
      text={lead.text}
      extras={rest.map((intent) => ({
        glyph: INTENT_LOOK[intent.kind].glyph,
        text: intent.text,
      }))}
      info={{
        title: move.name,
        description: [...move.intents.map((intent) => intent.label), positioning].join('\n'),
      }}
    />
  );
};

/**
 * The hero's next moves, one arrow per move: one for most heroes, two
 * for the dragon, which acts twice a turn.
 */
export const IntentChips = ({
  unit,
  field,
}: {
  unit: HeroUnit;
  field: readonly HeroUnit[];
}) => (
  <div className="hero-action-chips flex flex-nowrap items-center gap-0.5">
    {describeHeroIntent(unit, field).moves.map((move, index) => (
      <MoveArrow key={`${move.name}-${index}`} move={move} unit={unit} />
    ))}
  </div>
);

// --- COMPONENT ---
/** Renders one hero's plate, with gold lettering for bosses. */
export const HeroPlate = ({ unit, field }: HeroPlateProps) => {
  const plateRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setLayer(
      anchorRef.current
        ?.closest('.dueling-table')
        ?.querySelector('.hero-plate-layer') ?? null
    );
  }, []);
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const plate = plateRef.current;
    if (!anchor || !plate || !layer) return;
    let frame = 0;
    const follow = () => {
      const height = plate.offsetHeight;
      if (anchor.offsetHeight !== height) anchor.style.height = height + 'px';
      const rect = anchor.getBoundingClientRect();
      const bounds = layer.getBoundingClientRect();
      const width = plate.offsetWidth;
      if (anchor.offsetWidth !== width) anchor.style.width = width + 'px';
      if (width > 0 && rect.width > 0) {
        const half = width * 0.64;
        const center = Math.max(
          half,
          Math.min(
            bounds.width - half,
            rect.left - bounds.left + rect.width / 2
          )
        );
        const bottom = Math.max(
          height,
          rect.bottom - bounds.top
        );
        plate.style.left = center - width / 2 + 'px';
        plate.style.top = bottom - height + 'px';
        plate.style.visibility = 'visible';
      }
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [layer]);
  const isBoss = getHero(unit.heroId).tier === 'boss';
  const nameClass = isBoss ? 'text-accent' : 'text-ink';
  return (
    <>
      <div
        ref={anchorRef}
        aria-hidden="true"
        {...{ [PLATE_UID_ATTR]: unit.uid }}
        className="pointer-events-none shrink-0 origin-bottom"
      />
      {layer &&
        createPortal(
          <div
            ref={plateRef}
            onClick={(event) => event.stopPropagation()}
            className={`hero-plate pointer-events-none absolute invisible flex origin-bottom flex-col gap-1.5`}
          >
            <span
              className={`hero-plate-name w-[128%] self-center px-1 text-center text-balance [overflow-wrap:anywhere] font-display font-bold text-[11px] uppercase leading-tight tracking-wider ${nameClass}`}
            >
              {getHero(unit.heroId).name}
            </span>
            <DrainBar hp={unit.hp} maxHp={unit.maxHp} size="small" />
            {/* At 80% scale the centered chip row spans 128% of the HP bar. */}
            <div className="flex w-[160%] origin-top scale-[0.8] items-start justify-between gap-2.5 self-center">
              <div className="shrink-0">
                <IntentChips unit={unit} field={field} />
              </div>
              {/* Flush right: the row itself shrinks to its chips (max-w-max). */}
              <div className="flex min-w-0 flex-1 justify-end">
                <StatusRow
                  combatant={unit}
                  passives={passivesOf(unit)}
                  isOutOfRange={isOutOfRangeShot(
                    'range',
                    unit.row,
                    hasLongRangePassive(unit)
                  )}
                  align="end"
                  rows={HERO_STATUS_ROWS}
                />
              </div>
            </div>
          </div>,
          layer
        )}
    </>
  );
};
