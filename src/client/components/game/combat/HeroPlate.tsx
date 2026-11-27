// ===================================================================
// HERO PLATE
// The figure anchors its intent at the head and its HP at the feet.
// Both stay legible at screen size, independent of the sprite's scale.
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
import { getHero } from '../../../../shared/game/heroes';
import { debuffPowerOf } from '../../../../shared/game/skills';
import type { Combatant, HeroUnit } from '../../../../shared/game/types';
import { INTENT_LOOK, TIER_NAME_CLASS, toneVarOf } from '../../../content/visuals';
import { Chip } from '../../ui/Chip';
import { EnemyStatuses } from '../StatusRow';
import { FLOATING_UID_ATTR, PLATE_UID_ATTR } from '../../../hooks/usePlateSpacing';
import { EnemyHealthShield } from './EnemyHealthShield';
import { MoveEffect } from '../MoveEffect';

// --- TYPES ---
export type HeroPlateProps = {
  unit: HeroUnit;
  player: Combatant;
  showName: boolean;
  /** Every hero on the field (the plan shown depends on them). */
  field: readonly HeroUnit[];
};

// --- SUBCOMPONENTS ---
/** Only attacks need a number at a glance; the popover keeps full details. */
function isAttackIntent(kind: IntentKind) {
  return kind === 'attack' || kind === 'range' || kind === 'magic';
}

/** Use the old intent badge fill as the icon and text color. */
function intentFill(kind: IntentKind, signature: boolean) {
  if (isAttackIntent(kind)) return '#f08080';
  if (kind === 'heal') return 'var(--color-heal)';
  return signature ? 'var(--color-accent)' : undefined;
}
/**
 * The popover under an intent chip: each effect in its battlefield
 * colour with bright numbers (the same MoveEffect as the unit info
 * window). The positioning note was dropped: Sam found it noise.
 */
const IntentPopoverBody = ({ move }: { move: MoveIntent }) => (
  <ul className="intent-popover">
    {move.intents.map((intent, index) => <MoveEffect key={index} intent={intent} />)}
  </ul>
);

/**
 * One unframed chip per move. Each effect keeps its original intent color.
 */
const MoveChip = ({ move }: { move: MoveIntent }) => {
  const [lead, ...rest] = move.intents;
  if (!lead) return null;
  return (
    <Chip
      {...INTENT_LOOK[lead.kind]}
      shape="plain"
      fill={intentFill(lead.kind, move.isSignature)}
      disrupted={lead.disrupted}
      text={isAttackIntent(lead.kind) ? lead.text : ''}
      hoverText={isAttackIntent(lead.kind) ? lead.hoverText : undefined}
      extras={rest.map((intent) => ({
        glyph: INTENT_LOOK[intent.kind].glyph,
        text: isAttackIntent(intent.kind) ? intent.text : '',
        hoverText: isAttackIntent(intent.kind) ? intent.hoverText : undefined,
        fill: intentFill(intent.kind, false) ?? toneVarOf(INTENT_LOOK[intent.kind]),
        disrupted: intent.disrupted,
      }))}
      info={{
        title: move.name,
        description: move.intents.map((intent) => intent.label).join('\n'),
        body: <IntentPopoverBody move={move} />,
      }}
    />
  );
};

/**
 * The hero's next moves, stacked in action order.
 */
const IntentChips = ({
  unit,
  field,
  debuffBonus = 0,
}: {
  unit: HeroUnit;
  field: readonly HeroUnit[];
  /** The villain's Debilitate share, so attack chips show the real hit. */
  debuffBonus?: number;
}) => {
  return <div className="hero-action-chips">
    {describeHeroIntent(unit, field, debuffBonus).moves.map((move, index) => (
      <MoveChip key={`${move.name}-${index}`} move={move} />
    ))}
  </div>;
};

// --- COMPONENT ---
/** Renders one hero's plate, with color-coded names for elites and bosses. */
export const HeroPlate = ({ unit, field, player, showName }: HeroPlateProps) => {
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
  const nameClass = TIER_NAME_CLASS[tier];
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
            className="hero-plate pointer-events-none absolute top-0 invisible"
          >
            <div className="hero-plate-head">
              {showName && <span
                data-hero-tier={tier}
                className={`hero-plate-name font-display font-bold text-[11px] uppercase leading-tight tracking-wider ${nameClass}`}
              >
                {name}{unit.phase === 2 && <span className="ml-1 text-[#ebd2ff]">II</span>}
              </span>}
              <IntentChips unit={unit} field={field} debuffBonus={debuffPowerOf(player.skillPicks)} />
            </div>
            <div className="hero-plate-health">
              <EnemyHealthShield hp={unit.hp} maxHp={unit.maxHp} />
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
