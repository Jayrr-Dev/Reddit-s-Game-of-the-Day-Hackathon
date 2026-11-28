import { getCard, type CardId } from '../../../shared/game/cards';
import type { HeroId } from '../../../shared/game/heroes';
import { ROW_LABEL } from '../../../shared/game/rules';
import type { MovementId } from '../../../shared/game/types';
import duelArt from '../../assets/table/melee.webp';
import pileArt from '../../assets/table/imbue.webp';
import movementArt from '../../assets/table/back-step.webp';
import poisonArt from '../../assets/table/range.webp';

// --- CARD NAMES ---
/** The first melee card's printed name, read from the card data so a rename reaches the tutorial. */
const STRIKE_CARD = getCard('backhand').name;

type Instruction = { label: string; tip: string };
export type LessonStep = Instruction &
  (
    | { kind: 'inspect'; selector: string }
    | { kind: 'pile'; pile: 'draw' | 'discard' | 'removed' }
    | { kind: 'play'; card: CardId }
    | { kind: 'move'; move: MovementId }
    | { kind: 'turn' }
  );
type Lesson = {
  id: string;
  title: string;
  summary: string;
  art: string;
  enemies: HeroId[];
  hp: number[];
  hand: CardId[];
  draw: CardId[];
  steps: LessonStep[];
};
const inspect = (selector: string, label: string, tip: string): LessonStep => ({
  kind: 'inspect',
  selector,
  label,
  tip,
});
const pile = (
  pile: 'draw' | 'discard' | 'removed',
  label: string,
  tip: string
): LessonStep => ({ kind: 'pile', pile, label, tip });
const play = (card: CardId, label: string, tip: string): LessonStep => ({
  kind: 'play',
  card,
  label,
  tip,
});
const end = (tip: string): LessonStep => ({
  kind: 'turn',
  label: 'End turn',
  tip,
});
export const portrait = '.table-player button[title="Character sheet"]';
export const lessons: Lesson[] = [
  {
    id: 'duel',
    title: 'Your first duel',
    summary: 'Intent, Guard and leveling up',
    art: duelArt,
    enemies: ['squire'],
    hp: [12],
    hand: ['backhand', 'darkCloak'],
    draw: ['frostBolt'],
    steps: [
      inspect(
        '.hero-action-chips',
        'Read intent',
        'Tap the sword beside the Squire. It announces a hit for 5.'
      ),
      inspect(
        '.table-pips',
        'Check energy',
        'Tap the gold pips. Each pip pays for one point of card cost.'
      ),
      play(
        'backhand',
        `Play ${STRIKE_CARD}`,
        `Spend 1 energy on ${STRIKE_CARD}, then strike the Squire on the ${ROW_LABEL.front}.`
      ),
      play(
        'darkCloak',
        'Gain Guard',
        'Play Dark Cloak. Compare your 5 Guard with the incoming hit.'
      ),
      end(
        'End your turn. Watch Guard absorb the swing, then look for your next attack.'
      ),
      play(
        'frostBolt',
        'Finish the duel',
        'Tap Frost Bolt, then the Squire. Winning this duel earns 100 XP.'
      ),
    ],
  },
  {
    id: 'piles',
    title: 'Follow your cards',
    summary: 'Draw, Discard, reshuffle, Hold and Remove',
    art: pileArt,
    enemies: ['squire'],
    hp: [30],
    hand: ['backhand', 'bloodPact', 'ruin', 'darkCloak'],
    draw: ['frostBolt'],
    steps: [
      pile(
        'draw',
        'Open Draw',
        'Open the draw pile beside End Turn. Only Frost Bolt is left. Close the pile to play.'
      ),
      play(
        'backhand',
        `Play ${STRIKE_CARD}`,
        `Strike the Squire with ${STRIKE_CARD}. Watch which pile receives the card.`
      ),
      pile(
        'discard',
        `Find ${STRIKE_CARD}`,
        `Open Discard beside your portrait. ${STRIKE_CARD} can return when you reshuffle.`
      ),
      play(
        'bloodPact',
        'Play Blood Pact',
        'Blood Pact grants energy and has Remove. Play it and watch where it goes.'
      ),
      pile(
        'removed',
        'Find Blood Pact',
        'Open the Remove pile. Blood Pact stays here for the rest of this fight.'
      ),
      end(
        'Leave Ruin and Dark Cloak in hand. End Turn discards Dark Cloak. Hold keeps Ruin. You draw Frost Bolt, then reshuffle Discard to keep drawing.'
      ),
      pile(
        'discard',
        'Check the reshuffle',
        'Open Discard again. It is empty because the draw pile ran out and you drew the reshuffled cards.'
      ),
      pile(
        'removed',
        'Check Remove',
        'Open Remove again. Blood Pact is still here after the reshuffle.'
      ),
      play(
        'backhand',
        `Replay ${STRIKE_CARD}`,
        `${STRIKE_CARD} is back in hand after the reshuffle. Play it again. Ruin stayed with you and Blood Pact stayed removed.`
      ),
    ],
  },
  {
    id: 'rows',
    title: 'Control the distance',
    summary: 'Three lines, Back Step and Charge',
    art: movementArt,
    enemies: ['squire', 'archer'],
    hp: [27, 17],
    hand: ['backhand', 'bloodPact', 'frostBolt'],
    draw: ['darkCloak', 'backhand'],
    steps: [
      inspect(
        '[data-hero-row="front"]',
        ROW_LABEL.front,
        `Tap the Squire on the ${ROW_LABEL.front}. ${STRIKE_CARD} can hit it here. The Archer starts one line farther away.`
      ),
      {
        kind: 'move',
        move: 'backStep',
        label: 'Back Step',
        tip: `Play Back Step. Watch the Squire move to the ${ROW_LABEL.back} and the Archer to the ${ROW_LABEL.horizon}.`,
      },
      inspect(
        '[data-hero-row="back"]',
        ROW_LABEL.back,
        `Tap the Squire again. The ${ROW_LABEL.front} is empty, so ${STRIKE_CARD} has no target.`
      ),
      inspect(
        '[data-hero-row="horizon"]',
        ROW_LABEL.horizon,
        `Tap the Archer on the ${ROW_LABEL.horizon}. Range and Magic shots into or out of the ${ROW_LABEL.horizon} can miss. Longrange ignores that penalty.`
      ),
      play(
        'bloodPact',
        'Gain energy',
        'Play Blood Pact to gain energy for Charge and a follow-up attack.'
      ),
      {
        kind: 'move',
        move: 'charge',
        label: 'Charge',
        tip: 'Play Charge. Moving again costs more. You close one line and gain Momentum.',
      },
      play(
        'backhand',
        'Use Momentum',
        `The Squire is back on the ${ROW_LABEL.front}. Strike it with ${STRIKE_CARD} to use Momentum for extra melee damage.`
      ),
    ],
  },
  {
    id: 'poison',
    title: 'Win with Poison',
    summary: 'Status stacks and a mixed formation',
    art: poisonArt,
    enemies: ['squire', 'archer'],
    hp: [24, 17],
    hand: ['venomDart', 'darkCloak', 'backhand'],
    draw: ['frostBolt', 'venomDart'],
    steps: [
      play(
        'venomDart',
        'Apply Poison',
        'Fire Poison Dart at a glowing enemy. Look for the new status badge beside its health.'
      ),
      inspect(
        '.enemy-status-grid button[aria-label^="Poison"]',
        'Inspect Poison',
        'Tap Poison. It deals damage before each enemy action, then loses 1 stack.'
      ),
      play(
        'darkCloak',
        'Prepare Guard',
        'Play Dark Cloak before the enemies act. Watch their intents as you end the turn.'
      ),
      end(
        'End Turn and watch Poison trigger before the poisoned enemy acts. Compare the remaining Poison stacks with the count before the turn.'
      ),
    ],
  },
];
