import { useEffect, useRef, useState } from 'react';
import { ENERGY_PER_TURN, CARDS_PER_TURN, ROW_LABEL, OUT_OF_RANGE_HIT_CHANCE, REFLEX_DODGE } from '../../../shared/game/rules';
import { COMBAT_STATUS_SECTIONS, type ReferenceEntry } from '../../../shared/game/combatStatusReference';
import { STATUS_LOOK } from '../../content/visuals';
import { Glyph } from '../ui/Glyph';
import { RichText } from '../ui/RichText';
import type { CardId } from '../../../shared/game/cards';
import duelArt from '../../assets/table/melee.webp';
import targetArt from '../../assets/table/range.webp';
import movementArt from '../../assets/table/charge.webp';
import pileArt from '../../assets/table/imbue.webp';
import guardArt from '../../assets/table/defend.webp';
import forestArt from '../../assets/terrain/elven-forest.webp';
import { ICON_AUTHORS } from '../../content/gameIcons';
import { Button } from '../ui/Button';
import { ProgressiveImg } from '../ui/ProgressiveImage';
import { CardView } from './CardView';

type Lesson = {
  title: string;
  headline: string;
  art: string;
  labels: readonly (readonly [string, string])[];
  example: string;
  cards?: readonly CardId[];
  reference?: readonly ReferenceEntry[];
};

const SLIDES: readonly Lesson[] = [
  {
    title: 'Your turn', headline: 'Spend energy, then end your turn', art: duelArt,
    labels: [
      ['Energy', `The gold pips show what you have left. The base is ${ENERGY_PER_TURN} energy per turn.`],
      ['Hand', `Draw up to ${CARDS_PER_TURN} fresh cards at the start of a normal turn, before bonuses.`],
      ['Play a card', 'Tap the card. If it needs a target, tap a highlighted enemy. Guard and most utility cards resolve on you.'],
      ['End Turn', 'Enemies act. Then your next turn refreshes energy and draws cards.'],
    ],
    example: 'Try a 1-cost attack and a 1-cost Guard before you End Turn.',
    cards: ['backhand', 'darkCloak'],
  },
  {
    title: 'Read a card', headline: 'Where to look on the card', art: guardArt,
    labels: [
      ['Top left: Energy cost', 'The gold number is what you pay. 0 costs no energy.'],
      ['Artwork: Type icon and rarity', 'The icon indicates the kind of card. The diamond near the title marks rarity.'],
      ['Rules area: Effects and keywords', 'Read damage, Guard, status stacks, hit count, and limits here. Hover or tap a keyword for help.'],
      ['Bottom: Type ribbon', 'Melee, Range, Magic, Curse, Defend, Utility, or Movement tells you what the card does.'],
    ],
    example: 'Healing Potion is a 0-cost Utility card. Use 1/1 means this copy has one play before it Exhausts.',
    cards: ['healingPotion', 'arcaneBolt'],
  },
  {
    title: 'Targeting', headline: 'Reach depends on your card type', art: forestArt,
    labels: [
      [ROW_LABEL.front, 'Melee normally hits only this nearest row. An empty Frontline does not make Midline enemies legal for ordinary Melee.'],
      [ROW_LABEL.back, 'Range, Magic, and Curse can target enemies on the middle row.'],
      [ROW_LABEL.horizon, `Range and Magic shots into or out of the farthest row have a base ${Math.round(OUT_OF_RANGE_HIT_CHANCE*100)}% Out of Range hit chance. Longrange ignores that penalty.`],
      ['Special cases', 'Aloft blocks ordinary Melee. Cloak blocks direct targeting. Individual card effects can override normal reach.'],
    ],
    example: 'If Backhand cannot reach, use a spell or Charge when the Frontline is clear.',
    cards: ['backhand','arrowShot','arcaneBolt'],
  },
  {
    title: 'Movement', headline: 'Charge in or make space', art: movementArt,
    labels: [
      ['Charge', 'If the Frontline is empty and the field can shift, close one row. Gain Momentum for your next Melee card this turn.'],
      ['Back Step', `Fall back one row if there is room. Gain Reflex: +${Math.round(REFLEX_DODGE*100)}% dodge for one enemy turn.`],
      ['Movement streak', 'Consecutive moves share an escalating cost. A full turn without moving resets the streak.'],
      ['Rush and Momentum', 'Rush makes the next movements free. Momentum boosts the next Melee card by 50%; it is not an extra move.'],
    ],
    example: 'A boss that occupies both lines can block Back Step.',
  },
  {
    title: 'Card piles', headline: 'Know which cards come back', art: pileArt,
    labels: [
      ['Draw pile', 'Where your next cards come from. Tap the stack by End Turn to inspect it.'],
      ['Discard', 'Most played cards and leftover hand cards go here. When Draw runs out, Discard is shuffled back in.'],
      ['Hold', 'A card with Hold stays in hand when you end your turn.'],
      ['Remove vs. Exhaust', 'Remove lasts for the fight. Exhaust uses a per-run counter; when the last use is spent, that copy leaves the run deck.'],
    ],
    example: 'Blood Pact goes to Remove; an ordinary Backhand can return after reshuffling.',
    cards: ['bloodPact','ruin'],
  },
  {
    title: 'Enemy intent', headline: 'Plan around the enemy’s next move', art: guardArt,
    labels: [
      ['Intent badge', 'Tap the action icon next to an enemy’s health to read its next move, damage, hits, or effects.'],
      ['Guard', 'Absorbs incoming attack damage. It normally clears as your next turn begins; Brace can keep it longer.'],
      ['Armor and Protection', 'Armor reduces damage on each hit. Protection reduces incoming hit and affliction damage.'],
      ['Boss cue', 'Watch a signature wind-up or stance change, then prepare for the attack rather than spending all your energy on damage.'],
    ],
    example: '5 Guard can absorb a single 5-damage attack, before other damage or rule modifiers.',
    cards: ['darkCloak'],
  },
  ...COMBAT_STATUS_SECTIONS.map(section => ({
    ...section,
    art: targetArt,
    labels: [],
    example: '',
    reference: section.entries,
  })),
  {
    title: 'Play the turn', headline: 'Inspect, position, play, defend', art: duelArt,
    labels: [
      ['1. Inspect', 'Read enemy intent and check where each enemy stands.'],
      ['2. Position', 'Pick a legal target or spend movement if it makes your hand stronger.'],
      ['3. Play and defend', 'Use your best attack or status combo. Keep energy for Guard when an enemy will attack.'],
      ['4. End and check', 'Watch enemy actions and status ticks. Check what you drew and which cards stayed or moved.'],
    ],
    example: 'Practice the sequence in Your First Duel, then try the Card Piles, Distance and Poison lessons.',
    cards: ['backhand','darkCloak','venomDart'],
  },
];

/** A tap-through reference; the interactive tutorial lessons remain separate. */
export const CombatRulesSlides = () => {
  const [index, setIndex] = useState(0);
  const root = useRef<HTMLElement>(null);
  useEffect(() => { root.current?.parentElement?.scrollTo({ top: 0 }); }, [index]);
  const slide = SLIDES[index] ?? SLIDES[0]!;
  const go = (offset: number) => setIndex(current => Math.max(0, Math.min(SLIDES.length - 1, current + offset)));

  return (
    <section ref={root} className="combat-rules-slides" aria-label="Combat rules slides">
      <nav className="combat-rules-nav" aria-label="Slideshow navigation">
        <Button variant="menu" onClick={() => go(-1)} disabled={index === 0}>Previous</Button>
        <div className="combat-rules-position" aria-live="polite">
          <strong>{slide.title}</strong><span>{index + 1} / {SLIDES.length}</span>
        </div>
        <Button variant="menu" onClick={() => go(1)} disabled={index === SLIDES.length - 1}>Next</Button>
      </nav>
      <article key={index} className="combat-rules-slide" data-reference={slide.reference ? '' : undefined} aria-label={slide.headline}>
        {slide.reference ? <div className="combat-rules-copy">
          <h3>{slide.headline}</h3>
          <dl className="combat-rules-reference">{slide.reference.map(entry => {
            const look = entry.badge ? STATUS_LOOK[entry.badge] : undefined;
            return <div className="combat-rules-entry" key={entry.label}>
              <dt>{look && <Glyph name={look.glyph} className={'size-4 ' + look.toneClass} />} {entry.label}</dt>
              <dd><RichText text={entry.description} /></dd>
            </div>;
          })}</dl>
        </div> : <>
        <div className="combat-rules-art">
          <ProgressiveImg src={slide.art} alt="" aria-hidden="true" />
          {slide.title === 'Targeting' && <ol className="combat-rules-row-map" aria-label="Battlefield rows, farthest to nearest"><li>{ROW_LABEL.horizon}</li><li>{ROW_LABEL.back}</li><li>{ROW_LABEL.front}</li></ol>}
          {slide.cards && slide.title !== 'Targeting' && <div className="combat-rules-cards" aria-hidden="true" inert>
            {slide.cards.map(id => <CardView key={id} cardId={id} size="fan" />)}
          </div>}
        </div>
        <div className="combat-rules-copy">
          <h3>{slide.headline}</h3>
          <dl>{slide.labels.map(([label, desc]) => (
            <div key={label}><dt>{label}</dt><dd>{desc}</dd></div>
          ))}</dl>
          <p className="combat-rules-example">{slide.example}</p>
        </div>
        </>}
      </article>
      {index === SLIDES.length - 1 && <details className="combat-rules-credits">
        <summary>Icon credits</summary><p>Icons by {ICON_AUTHORS.join(', ')} from game-icons.net, CC BY 3.0.</p>
      </details>}
    </section>
  );
};
