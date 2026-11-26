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
  type IntentKind,
} from '../../../../shared/game/describe';
import {
  hasLongRangePassive,
  isOutOfRangeShot,
  passivesOf,
} from '../../../../shared/game/combat';
import { isAnchored, preferredRow, rowDepth } from '../../../../shared/game/battlefield';
import { getHero } from '../../../../shared/game/heroes';
import { debuffPowerOf } from '../../../../shared/game/skills';
import type { Combatant, HeroUnit } from '../../../../shared/game/types';
import { INTENT_LOOK } from '../../../content/visuals';
import { Chip } from '../../ui/Chip';
import { EnemyStatuses } from '../StatusRow';
import { FLOATING_UID_ATTR, PLATE_UID_ATTR } from '../../../hooks/usePlateSpacing';
import { DrainBar } from './DrainBar';

// --- TYPES ---
export type HeroPlateProps = {
  unit: HeroUnit;
  player: Combatant;
  /** Every hero on the field (the plan shown depends on them). */
  field: readonly HeroUnit[];
};

// --- SUBCOMPONENTS ---
function intentFill(kind: IntentKind, signature: boolean) {
  if (kind === 'attack' || kind === 'range' || kind === 'magic') return '#f08080';
  if (kind === 'heal') return 'var(--color-heal)';
  return signature ? 'var(--color-accent)' : undefined;
}
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
  const positioning = isAnchored(unit) ? 'Holds position.' : unit.row === home
    ? `Holding preferred position (${position}).`
    : `Tries to ${direction} toward the ${position} after acting.`;
  return (
    <Chip
      {...INTENT_LOOK[lead.kind]}
      fill={intentFill(lead.kind, move.isSignature)}
      text={lead.text}
      hoverText={lead.hoverText}
      extras={rest.map((intent) => ({
        glyph: INTENT_LOOK[intent.kind].glyph,
        text: intent.text,
        hoverText: intent.hoverText,
        fill: intentFill(intent.kind, false),
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
  debuffBonus = 0,
}: {
  unit: HeroUnit;
  field: readonly HeroUnit[];
  /** The villain's Debilitate share, so attack chips show the real hit. */
  debuffBonus?: number;
}) => {
  const stack = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const chips = Array.from(stack.current?.children ?? []) as HTMLElement[];
    const sort = () => chips.forEach(chip => { chip.style.order = String(-Math.round(chip.getBoundingClientRect().width * 10)); });
    sort();
    const observer = new ResizeObserver(sort);
    chips.forEach(chip => observer.observe(chip));
    return () => observer.disconnect();
  });
  return <div ref={stack} className="hero-action-chips flex flex-col items-end gap-1">
    {describeHeroIntent(unit, field, debuffBonus).moves.map((move, index) => (
      <MoveArrow key={`${move.name}-${index}`} move={move} unit={unit} />
    ))}
  </div>;
};

// --- COMPONENT ---
/** Renders one hero's plate, with color-coded names for elites and bosses. */
export const HeroPlate = ({ unit, field, player }: HeroPlateProps) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setLayer(
      anchorRef.current
        ?.closest('.dueling-table')
        ?.querySelector('.hero-plate-layer') ?? null
    );
  }, []);
  const { tier, name } = getHero(unit.heroId);
  const nameClass = tier === 'boss' ? 'text-accent' : tier === 'elite' ? 'text-[#8bc8ff]' : 'text-ink';
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
            {...{ [FLOATING_UID_ATTR]: unit.uid }}
            onClick={(event) => event.stopPropagation()}
            data-hero-kind={unit.heroId}
            className={`hero-plate pointer-events-none absolute invisible flex origin-bottom flex-col gap-1.5`}
          >
            <span
              data-hero-tier={tier}
              className={`hero-plate-name w-[128%] self-center px-1 text-center text-balance [overflow-wrap:anywhere] font-display font-bold text-[11px] uppercase leading-tight tracking-wider ${nameClass}`}
            >
              {name}{unit.phase === 2 && <span className="ml-1 text-[#ebd2ff]">II</span>}
            </span>
            <DrainBar hp={unit.hp} maxHp={unit.maxHp} size="small" />
            <div className="hero-plate-details">
              <IntentChips unit={unit} field={field} debuffBonus={debuffPowerOf(player.skillPicks)} />
              <EnemyStatuses
                combatant={unit}
                source={player}
                passives={passivesOf(unit)}
                isOutOfRange={isOutOfRangeShot(
                  'range',
                  unit.row,
                  hasLongRangePassive(unit)
                )}
              />
            </div>
          </div>,
          layer
        )}
    </>
  );
};
