// ===================================================================
// CARD VIEW
// One card face, laid out top to bottom like a classic battler card:
//   cost orb      energy cost, top-left, overlapping the frame
//   art window    an arched window with the type's glyph
//   name banner   the name across the middle in the display font
//   rules panel   parchment with the rules text, glossary words in
//                 bold, and the card's own keywords on the last line
//   rarity gem    a small V under the banner (starters have none)
//   type ribbon   the type (Melee, Range, Magic, Defend, Buff, Curse),
//                 with a Magic card's element icon (Fire, Ice) before it
// The frame and outer glow are coloured by type (see CARD_LOOK).
// The text comes from describeCard, so it always matches what the
// card really does (including live wrath/weaken math, and the hero it
// is aimed at while dragged). Keywords and Fades show as badges under
// the cost orb (CardBadges); every glossary word in the text is bold
// and explains itself on hover or long press.
// ===================================================================

import { Fragment, type ReactNode } from 'react';
import { cardCost, getCard, type CardId } from '../../../shared/game/cards';
import { MOVEMENTS } from '../../../shared/game/movement';
import {
  describeCard,
  DURATION_INFO,
  GLOSSARY,
} from '../../../shared/game/describe';
import type {
  Combatant,
  MovementId,
  HeroUnit,
  Imbue,
  MagicElement,
  MeleeEdge,
} from '../../../shared/game/types';
import {
  CARD_LOOK,
  MOVEMENT_LOOK,
  EDGE_ART,
  EDGE_LOOK,
  ELEMENT_LOOK,
  RARITY_GEM,
} from '../../content/visuals';
import { Glyph, type GlyphName } from '../ui/Glyph';
import { cardBadgesOf } from '../../content/cardBadges';
import { Tooltip } from '../ui/Tooltip';
import { CardBadges } from './CardBadges';

// --- TYPES ---
export type CardViewProps = {
  slain?: number;
  followUpReady?: boolean | undefined;
  cardId: CardId;
  /** When given, damage numbers include this attacker's wrath and weaken. */
  attacker?: Combatant;
  /**
   * The hero the card is aimed at, if any: numbers then show what it
   * would really do to that hero (Range bonus, Reap's Hex, ...).
   */
  target?: HeroUnit | undefined;
  isDisabled?: boolean;
  /** Lifted and outlined while the player is choosing its target. */
  isSelected?: boolean;
  /** Gifts this card carries from Imbue cards (shown as badges). */
  imbues?: readonly Imbue[];
  /** Uses already spent on an Exhaust card ("Use 2/3" after one). */
  usesSpent?: number;
  /** Glows teal while an Imbue card could imbue it. */
  isImbueTarget?: boolean;
  /** Pulses while the imbue arrow points at it. */
  isImbueAimed?: boolean;
  /** True to fade the card back (it can't take the Imbue being aimed). */
  isFaded?: boolean;
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
  /** The element icon on the ribbon. */
  ribbonIcon: string;
  /** The rarity gem under the name banner. */
  gem: string;
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
    ribbonIcon: 'size-2',
    gem: 'h-[8px] w-[11px]',
  },
  offer: {
    box: 'h-40 w-[6.5rem]',
    orb: 'size-7 text-sm -left-2 -top-2',
    art: 'h-12',
    glyph: 'size-8',
    name: 'text-[10px] py-0.5',
    rules: 'text-[10px] leading-snug px-1',
    ribbon: 'text-[8px] px-2 gap-1',
    ribbonIcon: 'size-2.5',
    gem: 'h-[10px] w-[14px]',
  },
};

/**
 * Words drawn bold in rules text: every glossary word (longest first,
 * so no word is cut short by a shorter one), plus ALL.
 */
const BOLD_WORDS = [...Object.keys(GLOSSARY), 'ALL'].sort(
  (a, b) => b.length - a.length
);
/** Durations ("this turn"), drawn in italics after their gift. */
const DURATION_WORDS: readonly string[] = Object.values(DURATION_INFO).map(
  (info) => info.label
);
/**
 * Splits rules text into plain words and marked parts: bold keywords
 * or numbers, italic durations.
 */
const KEYWORD_PATTERN = new RegExp(
  `(\\d+|\\b(?:${[...BOLD_WORDS, ...DURATION_WORDS].join('|')})\\b)`,
  'g'
);

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

/** The card's outer glow: gold when held, teal when it can be imbued. */
const glowOf = (
  glowVar: string,
  isSelected: boolean,
  isImbueTarget: boolean
): string => {
  if (isSelected)
    return '0 0 0 2px var(--color-accent), 0 0 16px var(--color-accent)';
  if (isImbueTarget)
    return '0 0 0 2px var(--color-imbue), 0 0 14px var(--color-imbue)';
  return `0 0 6px color-mix(in srgb, ${glowVar} 70%, transparent)`;
};

// --- SUBCOMPONENTS ---
/**
 * One rules line with keywords and numbers in bold, durations in italics. `printed` is the
 * same line without the villain's statuses; both come from the same
 * template, so the Nth number of each lines up for the comparison.
 */
const RulesLine = ({ text, printed }: { text: string; printed: string }) => {
  const printedParts = printed.split(KEYWORD_PATTERN);
  return (
    <span className="block">
      {text
        .split(KEYWORD_PATTERN)
        .map((part, index) =>
          index % 2 === 1 ? (
            <MarkedPart
              key={index}
              part={part}
              changeClassName={changeClass(part, printedParts[index])}
            />
          ) : (
            <Fragment key={index}>{part}</Fragment>
          )
        )}
    </span>
  );
};

/**
 * A marked part of a rules line: a duration in italics (no tooltip, to
 * keep cards calm), else a bold word or number; a glossary word
 * explains itself on hover.
 */
const MarkedPart = ({
  part,
  changeClassName,
}: {
  part: string;
  changeClassName: string;
}) => {
  if (DURATION_WORDS.includes(part)) return <i>{part}</i>;
  const bold = <b className={`font-black ${changeClassName}`}>{part}</b>;
  const info = GLOSSARY[part];
  if (!info) return bold;
  return (
    <Tooltip
      content={{ title: info.label, description: info.description }}
      isInline
    >
      {bold}
    </Tooltip>
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
    className={`card-window grid ${look.art} w-full shrink-0 place-items-center rounded-t-full bg-surface-sunken ring-1 ring-black/50`}
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

/**
 * The ribbon under the rules: its type, after an icon for a Magic
 * card's element or a Melee card's edge (Sharp or Blunt).
 */
const TypeRibbon = ({
  typeName,
  element,
  edge,
  look,
}: {
  typeName: string;
  element: MagicElement | undefined;
  edge: MeleeEdge | undefined;
  look: SizeLook;
}) => {
  const iconLook = element
    ? ELEMENT_LOOK[element]
    : edge
      ? EDGE_LOOK[edge]
      : null;
  return (
    <span
      title={typeName === 'Utility' ? 'Utility cards generally grant energy, restore HP, or draw cards.' : undefined}
      className={`absolute bottom-0.5 left-1/2 flex -translate-x-1/2 items-center rounded-sm bg-surface-sunken py-px font-bold uppercase tracking-wider text-ink ring-1 ring-accent/50 ${look.ribbon}`}
    >
      {iconLook && (
        <Glyph
          name={iconLook.glyph}
          className={`${look.ribbonIcon} ${iconLook.toneClass}`}
        />
      )}
      {typeName}
    </span>
  );
};

/**
 * The rarity gem: a small downward triangle (a "V") in its rarity's
 * colour with a black outline, hanging just under the name banner,
 * centred. Drawn as two clipped triangles: black behind, the colour
 * inset inside it (a ring can't follow a clip-path), plus a faint
 * highlight near the top so it reads as a cut gem.
 */
const RarityGem = ({
  gemClass,
  sizeClass,
}: {
  gemClass: string;
  sizeClass: string;
}) => (
  <span
    aria-hidden
    className={`absolute left-1/2 top-full z-10 mt-px ${sizeClass} -translate-x-1/2 bg-black [clip-path:polygon(0_0,100%_0,50%_100%)]`}
  >
    <span
      className={`absolute inset-0 ${gemClass} [clip-path:polygon(17%_14%,83%_14%,50%_80%)]`}
    >
      <span className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.55),transparent_60%)]" />
    </span>
  </span>
);

/** The name banner, with the rarity gem hanging just under it. */
const NameBanner = ({
  name,
  frameClass,
  gemClass,
  look,
}: {
  name: ReactNode;
  frameClass: string;
  gemClass: string | null;
  look: SizeLook;
}) => (
  <span
    className={`relative -mx-[3px] shrink-0 border-y border-black/50 ${frameClass} font-display font-black uppercase leading-none tracking-tight text-ink [text-shadow:0_1px_1px_rgb(0_0_0/0.8)] ${look.name}`}
  >
    {name}
    {gemClass && <RarityGem gemClass={gemClass} sizeClass={look.gem} />}
  </span>
);

// --- COMPONENT ---
/** A formation move occupies a temporary hand slot and spends its live movement cost. */
export const MovementCard = ({ move, cost, disabled, blockReason, onPlay }: {
  move: MovementId;
  cost: number;
  disabled: boolean;
  blockReason: string | null;
  onPlay: () => void;
}) => {
  const look = SIZE_LOOK.fan;
  const frame = CARD_LOOK.movement;
  const action = MOVEMENT_LOOK[move];
  const baseCost = MOVEMENTS[move].baseCost;
  const rules = blockReason ?? (move === 'backStep' ? 'Move back 1 line' : 'Move closer 1 line. Gain Momentum.');
  const costTone = cost > baseCost ? 'text-red-900' : cost < baseCost ? 'text-green-900' : 'text-on-accent';
  return (
    <button type="button" data-card-type="movement" data-card-size="fan" data-move={move}
      disabled={disabled} onClick={onPlay}
      className={`relative flex ${look.box} shrink-0 flex-col rounded-lg ${frame.frameClass} p-[3px] pb-3 text-center ring-1 ring-black/60 transition-transform enabled:hover:-translate-y-1`}>
      <span aria-label={`${cost} energy, ${cost > baseCost ? 'increased' : cost < baseCost ? 'discounted' : 'base'} cost`}
        className={`absolute z-10 flex ${look.orb} items-center justify-center rounded-full bg-energy ${costTone} font-display font-black ring-2 ring-surface-sunken`}>{cost}</span>
      <ArtWindow glyph={action.glyph} glowVar={frame.glowVar} look={look} />
      <NameBanner name={<Tooltip isInline content={{ title: action.label, description: blockReason ?? action.description }}>{action.label}</Tooltip>} frameClass={frame.frameClass} gemClass={null} look={look} />
      <span className={`card-rules flex w-full min-h-0 flex-1 flex-col justify-center rounded-b-sm bg-parchment text-on-parchment ${look.rules}`}>
        <RulesLine text={rules} printed={rules} />
      </span>
      <TypeRibbon typeName={frame.typeName} element={undefined} edge={undefined} look={look} />
    </button>
  );
};

/** Renders a tappable card. */
export const CardView = ({
  cardId,
  slain = 0,
  followUpReady,
  attacker,
  target,
  isDisabled = false,
  isSelected = false,
  imbues = [],
  usesSpent = 0,
  isImbueTarget = false,
  isImbueAimed = false,
  isFaded = false,
  size = 'offer',
  onClick,
}: CardViewProps) => {
  const cardDef = getCard(cardId);
  const typeLook = CARD_LOOK[cardDef.type];
  // The card as printed (no statuses), to colour numbers that changed.
  const printedLines = describeCard(cardId);
  const look = SIZE_LOOK[size];
  const glow = glowOf(typeLook.glowVar, isSelected, isImbueTarget);
  return (
    <button
      type="button"
      onClick={onClick}
      data-card-type={cardDef.type}
      data-card-id={cardId}
      data-card-size={size}
      disabled={isDisabled}
      className={`relative flex ${look.box} shrink-0 flex-col rounded-lg ${typeLook.frameClass} p-[3px] pb-3 text-center ring-1 ring-black/60 transition-transform enabled:hover:-translate-y-1 disabled:opacity-40 disabled:saturate-50 animate-rise ${isFaded ? 'opacity-40 saturate-50' : ''}`}
      style={{ boxShadow: `${glow}, 0 6px 10px rgb(0 0 0 / 0.5)` }}
    >
      <span
        className={`absolute z-10 flex ${look.orb} items-center justify-center rounded-full bg-energy font-display font-black text-on-accent ring-2 ring-surface-sunken shadow-[inset_0_-2px_3px_rgb(0_0_0/0.35)]`}
      >
        <span className="num-center">{cardCost(cardId, slain, followUpReady)}</span>
      </span>
      <ArtWindow
        glyph={(cardDef.edge && EDGE_ART[cardDef.edge]) ?? typeLook.glyph}
        glowVar={typeLook.glowVar}
        look={look}
      />
      {isImbueAimed && (
        <span
          aria-hidden
          className="imbue-aim-pulse pointer-events-none absolute inset-0 rounded-lg"
        />
      )}
      <CardBadges badges={cardBadgesOf(cardId, imbues)} size={size} />
      <NameBanner
        name={cardDef.name}
        frameClass={typeLook.frameClass}
        gemClass={RARITY_GEM[cardDef.rarity]}
        look={look}
      />
      <span
        className={`card-rules flex w-full min-h-0 flex-1 flex-col justify-center rounded-b-sm bg-parchment text-on-parchment ${look.rules}`}
      >
        {describeCard(cardId, attacker, target, usesSpent, imbues).map(
          (line, index) => (
            <RulesLine
              key={line}
              text={line}
              printed={printedLines[index] ?? line}
            />
          )
        )}
      </span>
      <TypeRibbon
        typeName={typeLook.typeName}
        element={cardDef.element}
        edge={cardDef.edge}
        look={look}
      />
    </button>
  );
};
