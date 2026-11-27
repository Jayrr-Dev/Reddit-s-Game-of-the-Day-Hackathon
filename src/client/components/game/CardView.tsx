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

import { Fragment, type CSSProperties, type ReactNode } from 'react';
import antidoteArt from '../../assets/table/antidote.webp';
import curseArt from '../../assets/table/beckon.webp';
import buffArt from '../../assets/table/vanish.webp';
import defendArt from '../../assets/table/defend.webp';
import healingArt from '../../assets/table/healing-potion.webp';
import imbueArt from '../../assets/table/imbue.webp';
import meleeArt from '../../assets/table/melee.webp';
import pushArt from '../../assets/table/push.webp';
import rangeArt from '../../assets/table/range.webp';
import strideArt from '../../assets/table/stride.webp';
import tonicArt from '../../assets/table/swift-tonic.webp';
import { cardCost, getCard, type CardId } from '../../../shared/game/cards';
import { MOVEMENTS } from '../../../shared/game/movement';
import {
  describeCard,
  describeCardUse,
  type StatusInfo,
  IMBUE_INFO,
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
import './cardFace.css';

// --- TYPES ---
export type CardViewProps = {
  paidCost?: number | undefined;
  /** Extra energy Fatigue puts on this card in hand this turn. */
  fatigue?: number;
  killsThisTurn?: number;
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
  disabledReason?: string | undefined;
  /** Lifted and outlined while the player is choosing its target. */
  isSelected?: boolean;
  /** Gifts this card carries from Imbue cards (shown as badges). */
  imbues?: readonly Imbue[];
  /** Uses already spent on an Exhaust card ("Uses 2/3" after one). */
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
  selected?: boolean;
  /** Accessible name when the card's click does something its text doesn't say (e.g. "Add Cleave"). */
  label?: string;
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
  /** The rarity gem above the name banner, on the artwork. */
  gem: string;
};

// --- CONSTANTS ---
/**
 * Classes every card face shares (playable cards and movement cards):
 * the textured, gilt-framed shell from cardFace.css plus layout.
 */
const FACE_CLASS =
  'card-face relative flex shrink-0 flex-col rounded-lg p-[3px] pb-[14px] text-center ring-1 ring-black/60 transition-transform enabled:hover:-translate-y-1';
/** Fan cards are small (the held one is scaled up by the hand). */
const SIZE_LOOK: Record<CardSize, SizeLook> = {
  fan: {
    box: 'h-28 w-[4.25rem]',
    orb: 'size-5 text-[11px] -left-1.5 -top-1.5',
    art: 'h-7',
    glyph: 'size-5',
    name: 'text-[7.5px] py-0.5',
    rules: 'text-[8px] leading-[1.15] px-0.5',
    ribbon: 'text-[7px] px-2 gap-0.5',
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
const RulesLine = ({ text, printed, useInfo = null }: { text: string; printed: string; useInfo?: StatusInfo | null }) => {
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
              useInfo={useInfo}
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
  useInfo,
}: {
  part: string;
  changeClassName: string;
  useInfo: StatusInfo | null;
}) => {
  if (DURATION_WORDS.includes(part)) return <i>{part}</i>;
  const bold = <b className={`font-black ${changeClassName}`}>{part}</b>;
  const info = useInfo?.label === part ? useInfo : GLOSSARY[part];
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
  picture,
  showGlyph = true,
}: {
  glyph: GlyphName;
  glowVar: string;
  look: SizeLook;
  picture?: string | undefined;
  showGlyph?: boolean;
}) => (
  <span
    className={`card-window grid ${look.art} w-full shrink-0 place-items-center rounded-t-full bg-surface-sunken`}
    data-card-illustrated={picture ? '' : undefined}
    style={{
      backgroundImage: `radial-gradient(circle at 50% 70%, color-mix(in srgb, ${glowVar} 55%, transparent), transparent 70%)`,
      ...(picture && { '--card-picture': `url("${picture}")` }),
    } as CSSProperties}
  >
    {(!picture || showGlyph) && <Glyph
      name={glyph}
      className={`${look.glyph} text-ink drop-shadow-[0_1px_1px_rgb(0_0_0/0.8)]`}
    />}
  </span>
);

const CARD_PICTURES: Partial<Record<CardId, string>> = {
  healingPotion: healingArt, antidote: antidoteArt, rushPotion: tonicArt,
  swiftTonic: tonicArt, forcePush: pushArt,
};
const TYPE_PICTURES: Readonly<Partial<Record<keyof typeof CARD_LOOK, string>>> = {
  imbue: imbueArt, defend: defendArt, movement: strideArt, curse: curseArt,
  buff: buffArt, magic: pushArt, melee: meleeArt, range: rangeArt,
};

/** The same artwork used on the playable card, without its interactive frame. */
export const CardArtwork = ({ cardId, size = 'offer', showGlyph = true }: {
  cardId: CardId; size?: CardSize; showGlyph?: boolean;
}) => {
  const card = getCard(cardId);
  const look = CARD_LOOK[card.type];
  return <ArtWindow
    glyph={(card.edge && EDGE_ART[card.edge]) ?? look.glyph}
    glowVar={look.glowVar}
    look={SIZE_LOOK[size]}
    picture={CARD_PICTURES[cardId] ?? TYPE_PICTURES[card.type]}
    showGlyph={showGlyph}
  />;
};

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
      className={`card-type-plaque absolute bottom-px left-1/2 flex -translate-x-1/2 items-center justify-center whitespace-nowrap font-bold uppercase leading-none ${look.ribbon}`}
    >
      {iconLook && (
        <Glyph
          name={iconLook.glyph}
          className={`${look.ribbonIcon} ${iconLook.toneClass}`}
        />
      )}
      {typeName === IMBUE_INFO.label ? (
        <Tooltip content={{ title: typeName, description: IMBUE_INFO.description }} isInline>{typeName}</Tooltip>
      ) : typeName}
    </span>
  );
};

/**
 * The rarity gem points upward from the name banner into the artwork,
 * leaving the rules clear. Two clipped triangles draw its black border
 * and inset colour, then rotate together as one gem.
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
    data-card-rarity-gem
    className={`pointer-events-none absolute bottom-full left-1/2 z-10 ${sizeClass} -translate-x-1/2 rotate-180 bg-black [clip-path:polygon(0_0,100%_0,50%_100%)]`}
  >
    <span
      className={`absolute inset-0 ${gemClass} [clip-path:polygon(17%_14%,83%_14%,50%_80%)]`}
    >
      <span className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.55),transparent_60%)]" />
    </span>
  </span>
);

/** The name banner anchors the rarity gem on the art side. */
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
    className={`card-banner relative -mx-[3px] shrink-0 ${frameClass} font-display font-black uppercase leading-none tracking-tight text-ink [text-shadow:0_1px_1px_rgb(0_0_0/0.8)] ${look.name}`}
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
  const rules = blockReason ?? (move === 'backStep' ? 'Move back 1 line. Gain Reflex.' : 'Move closer 1 line. Gain Momentum.');
  const costTone = cost > baseCost ? 'text-red-900' : cost < baseCost ? 'text-green-900' : 'text-on-accent';
  return (
    <button type="button" data-card-type="movement" data-card-size="fan" data-move={move}
      disabled={disabled} onClick={onPlay}
      className={`${FACE_CLASS} ${look.box} ${frame.frameClass}`}>
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
  killsThisTurn = 0,
  paidCost,
  fatigue = 0,
  followUpReady,
  attacker,
  target,
  isDisabled = false,
  disabledReason,
  isSelected = false,
  imbues = [],
  usesSpent = 0,
  isImbueTarget = false,
  isImbueAimed = false,
  isFaded = false,
  size = 'offer',
  onClick,
  selected,
  label,
}: CardViewProps) => {
  const cardDef = getCard(cardId);
  const typeLook = CARD_LOOK[cardDef.type];
  // The card as printed (no statuses), to colour numbers that changed.
  const printedLines = describeCard(cardId);
  const useInfo = describeCardUse(cardId, usesSpent, attacker);
  const look = SIZE_LOOK[size];
  const glow = glowOf(typeLook.glowVar, isSelected, isImbueTarget);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-card-type={cardDef.type}
      data-card-id={cardId}
        aria-pressed={selected}
      data-card-size={size}
      disabled={isDisabled}
      title={disabledReason}
      className={`${FACE_CLASS} ${look.box} ${typeLook.frameClass} disabled:opacity-40 disabled:saturate-50 animate-rise ${isFaded ? 'opacity-40 saturate-50' : ''}`}
      style={{ boxShadow: `${glow}, 0 6px 10px rgb(0 0 0 / 0.5)` }}
    >
      <span
        className={`absolute z-10 flex ${look.orb} items-center justify-center rounded-full bg-energy font-display font-black ${fatigue > 0 ? 'text-red-900' : 'text-on-accent'} ring-2 ring-surface-sunken shadow-[inset_0_-2px_3px_rgb(0_0_0/0.35)]`}
      >
        <span className="num-center">{paidCost ?? cardCost(cardId, killsThisTurn, followUpReady) + fatigue}</span>
      </span>
      <CardArtwork cardId={cardId} size={size} />
      {isImbueAimed && (
        <span
          aria-hidden
          className="imbue-aim-pulse pointer-events-none absolute inset-0 rounded-lg"
        />
      )}
      <CardBadges badges={cardBadgesOf(cardId, imbues, attacker)} size={size} />
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
              useInfo={useInfo}
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
