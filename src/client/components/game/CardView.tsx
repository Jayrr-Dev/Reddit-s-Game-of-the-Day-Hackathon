// ===================================================================
// CARD VIEW
// One card face, laid out top to bottom like a classic battler card:
//   cost orb      energy cost, top-left, overlapping the frame
//   art window    an arched window with the type's glyph
//   name banner   the name across the middle in the display font
//   rules panel   parchment with the rules text, keywords in bold
//   type ribbon   the type (Melee, Range, Magic, Buff, Curse) and rarity
// The frame and outer glow are coloured by type (see CARD_LOOK).
// The text comes from describeCard, so it always matches what the card
// really does (including live wrath/dread math, and the hero it is
// aimed at while dragged).
// ===================================================================

import { Fragment } from 'react';
import { getCard, type CardId } from '../../../shared/game/cards';
import { describeCard } from '../../../shared/game/describe';
import type { Combatant, HeroUnit } from '../../../shared/game/types';
import { CARD_LOOK, RARITY_GEM, RULES_KEYWORDS } from '../../content/visuals';
import { Glyph, type GlyphName } from '../ui/Glyph';

// --- TYPES ---
export type CardViewProps = {
  cardId: CardId;
  /** When given, damage numbers include this attacker's wrath and dread. */
  attacker?: Combatant;
  /**
   * The hero the card is aimed at, if any: numbers then show what it
   * would really do to that hero (Range bonus, Reap's Hex, ...).
   */
  target?: HeroUnit | undefined;
  isDisabled?: boolean;
  /** Lifted and outlined while the player is choosing its target. */
  isSelected?: boolean;
  /** "fan" cards sit in the fanned hand; "offer" cards are full size. */
  size?: CardSize;
  onClick?: () => void;
};

export type CardSize = 'fan' | 'offer';

/** Tailwind classes for each part of the card at one size. */
type SizeLook = {
  box: string;
  orb: string;
  art: string;
  glyph: string;
  name: string;
  rules: string;
  ribbon: string;
};

// --- CONSTANTS ---
/** Fan cards are small (the held one is scaled up by the hand). */
const SIZE_LOOK: Record<CardSize, SizeLook> = {
  fan: {
    box: 'h-28 w-[4.25rem]',
    orb: 'size-5 text-[11px] -left-1.5 -top-1.5',
    art: 'h-7',
    glyph: 'size-5',
    name: 'text-[7.5px] py-0.5',
    rules: 'text-[8px] leading-[1.15] px-0.5',
    ribbon: 'text-[6px] px-1.5 gap-0.5',
  },
  offer: {
    box: 'h-40 w-[6.5rem]',
    orb: 'size-7 text-sm -left-2 -top-2',
    art: 'h-12',
    glyph: 'size-8',
    name: 'text-[10px] py-0.5',
    rules: 'text-[10px] leading-snug px-1',
    ribbon: 'text-[8px] px-2 gap-1',
  },
};

/** Splits rules text into plain words and bold keywords or numbers. */
const KEYWORD_PATTERN = new RegExp(`(\\d+|${RULES_KEYWORDS.join('|')})`, 'g');

/**
 * Colour for a number on the live card compared with the printed one:
 * green when buffs raised it, red when debuffs lowered it, plain when
 * unchanged (or not a number).
 */
const changeClass = (live: string, printed: string | undefined): string => {
  const diff = Number(live) - Number(printed);
  if (printed === undefined || Number.isNaN(diff) || diff === 0) return '';
  return diff > 0 ? 'text-boosted' : 'text-weakened';
};

// --- SUBCOMPONENTS ---
/**
 * One rules line with keywords and numbers in bold. `printed` is the
 * same line without the villain's statuses; both come from the same
 * template, so the Nth number of each lines up for the comparison.
 */
const RulesLine = ({ text, printed }: { text: string; printed: string }) => {
  const printedParts = printed.split(KEYWORD_PATTERN);
  return (
    <span className="block">
      {text.split(KEYWORD_PATTERN).map((part, index) =>
        index % 2 === 1 ? (
          <b
            key={index}
            className={`font-black ${changeClass(part, printedParts[index])}`}
          >
            {part}
          </b>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        )
      )}
    </span>
  );
};

/** The arched art window with the type's glyph. */
const ArtWindow = ({
  glyph,
  glowVar,
  look,
}: {
  glyph: GlyphName;
  glowVar: string;
  look: SizeLook;
}) => (
  <span
    className={`grid ${look.art} w-full shrink-0 place-items-center rounded-t-full bg-surface-sunken ring-1 ring-black/50`}
    style={{
      backgroundImage: `radial-gradient(circle at 50% 70%, color-mix(in srgb, ${glowVar} 55%, transparent), transparent 70%)`,
    }}
  >
    <Glyph
      name={glyph}
      className={`${look.glyph} text-ink drop-shadow-[0_1px_1px_rgb(0_0_0/0.8)]`}
    />
  </span>
);

/** The ribbon under the rules: the card's type and its rarity gem. */
const TypeRibbon = ({
  typeName,
  gemClass,
  look,
}: {
  typeName: string;
  gemClass: string | null;
  look: SizeLook;
}) => (
  <span
    className={`absolute bottom-0.5 left-1/2 flex -translate-x-1/2 items-center rounded-sm bg-surface-sunken py-px font-bold uppercase tracking-wider text-ink ring-1 ring-accent/50 ${look.ribbon}`}
  >
    {typeName}
    {gemClass && (
      <span className={`size-1.5 rotate-45 ${gemClass} ring-1 ring-black/50`} />
    )}
  </span>
);

// --- COMPONENT ---
/** Renders a tappable card. */
export const CardView = ({
  cardId,
  attacker,
  target,
  isDisabled = false,
  isSelected = false,
  size = 'offer',
  onClick,
}: CardViewProps) => {
  const cardDef = getCard(cardId);
  const typeLook = CARD_LOOK[cardDef.type];
  // The card as printed (no statuses), to colour numbers that changed.
  const printedLines = describeCard(cardId);
  const look = SIZE_LOOK[size];
  // The typeLook glow; brighter and gold-rimmed while the card is held.
  const glow = isSelected
    ? `0 0 0 2px var(--color-accent), 0 0 16px var(--color-accent)`
    : `0 0 6px color-mix(in srgb, ${typeLook.glowVar} 70%, transparent)`;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={`relative flex ${look.box} shrink-0 flex-col rounded-lg ${typeLook.frameClass} p-[3px] pb-3 text-center ring-1 ring-black/60 transition-transform enabled:hover:-translate-y-1 disabled:opacity-40 disabled:saturate-50 animate-rise`}
      style={{ boxShadow: `${glow}, 0 6px 10px rgb(0 0 0 / 0.5)` }}
    >
      <span
        className={`absolute z-10 flex ${look.orb} items-center justify-center rounded-full bg-energy font-display font-black text-on-accent ring-2 ring-surface-sunken shadow-[inset_0_-2px_3px_rgb(0_0_0/0.35)]`}
      >
        <span className="num-center">{cardDef.cost}</span>
      </span>
      <ArtWindow
        glyph={typeLook.glyph}
        glowVar={typeLook.glowVar}
        look={look}
      />
      <span
        className={`-mx-[3px] shrink-0 border-y border-black/50 ${typeLook.frameClass} font-display font-black uppercase leading-none tracking-tight text-ink [text-shadow:0_1px_1px_rgb(0_0_0/0.8)] ${look.name}`}
      >
        {cardDef.name}
      </span>
      <span
        className={`flex w-full min-h-0 flex-1 flex-col justify-center rounded-b-sm bg-parchment text-on-parchment ${look.rules}`}
      >
        {describeCard(cardId, attacker, target).map((line, index) => (
          <RulesLine
            key={line}
            text={line}
            printed={printedLines[index] ?? line}
          />
        ))}
      </span>
      <TypeRibbon
        typeName={typeLook.typeName}
        gemClass={RARITY_GEM[cardDef.rarity]}
        look={look}
      />
    </button>
  );
};
