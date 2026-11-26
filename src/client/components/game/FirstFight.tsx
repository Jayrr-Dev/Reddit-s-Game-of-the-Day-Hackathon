import { useEffect, useState, type MouseEvent } from 'react';
import { playSound } from '../../lib/gameAudio';
import {
  awardCharacterVictory,
  createCharacter,
  equipItem,
  setTraitNode,
  syncCharacterCombat,
  traitPointsAvailable,
} from '../../../shared/game/character';
import { combatOutcome, endTurn, playCard } from '../../../shared/game/combat';
import { move } from '../../../shared/game/movement';
import { ROW_LABEL } from '../../../shared/game/rules';
import type { RunAction } from '../../../shared/game/run';
import { createSandboxWith } from '../../../shared/game/sandbox';
import { Button } from '../ui/Button';
import { CombatView } from './CombatView';
import { lessons, portrait } from './tutorialLessons';

function completedLessons(key: string): string[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return lessons
      .filter((l) => Array.isArray(data) && data.includes(l.id))
      .map((l) => l.id);
  } catch {
    return [];
  }
}
export function FirstFight({
  onExit,
  onRules,
  accountId,
}: {
  onExit: () => void;
  onRules: () => void;
  accountId?: string | undefined;
}) {
  const key = 'villain-run:tutorial:v2:' + (accountId ?? 'guest');
  const [done, setDone] = useState(() => completedLessons(key));
  const [index, select] = useState<number | null>(null);
  function complete(id: string) {
    const next = [...new Set([...completedLessons(key), ...done, id])];
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Keep this session's progress. */
    }
    setDone(next);
    select(null);
  }
  if (index !== null)
    return (
      <LessonFight
        key={index}
        index={index}
        leave={() => select(null)}
        complete={complete}
      />
    );
  return (
    <main className="lesson-book">
      <header>
        <h1>How to play</h1>
        <span>
          {done.length} / {lessons.length} complete
        </span>
      </header>
      <section className="lesson-grid" aria-label="Training lessons">
        {lessons.map((lesson, i) => {
          const checked = done.includes(lesson.id);
          return (
            <button
              key={lesson.id}
              className="lesson-card"
              type="button"
              onClick={() => select(i)}
              aria-label={
                lesson.title +
                (checked ? ', completed. Replay lesson' : ', start lesson')
              }
            >
              <div className="lesson-art">
                <img src={lesson.art} alt="" />
                {checked && (
                  <span className="lesson-check" aria-hidden="true">
                    &#10003;
                  </span>
                )}
              </div>
              <div className="lesson-caption">
                <strong>{lesson.title}</strong>
                <span>{lesson.summary}</span>
              </div>
            </button>
          );
        })}
      </section>
      <footer>
        <Button variant="menu" onClick={onExit}>
          Main menu
        </Button>
        <Button variant="menu" onClick={onRules}>
          Combat rules
        </Button>
      </footer>
    </main>
  );
}
function LessonFight({
  index,
  leave,
  complete,
}: {
  index: number;
  leave: () => void;
  complete: (id: string) => void;
}) {
  const lesson = lessons[index]!;
  const [character, setCharacter] = useState(() => createCharacter());
  const [combat, setCombat] = useState(() => {
    const base = createSandboxWith(
      17 + index,
      lesson.enemies,
      true,
      'all',
      character.traits,
      character.equipment
    );
    return {
      ...base,
      hand: [...lesson.hand],
      drawPile: [...lesson.draw],
      handImbues: lesson.hand.map(() => [] as (typeof base.handImbues)[number]),
      heroes: base.heroes.map((hero, i) => ({
        ...hero,
        hp: lesson.hp[i]!,
        maxHp: lesson.hp[i]!,
        moveIndex: 0,
      })),
    };
  });
  const [stepIndex, advance] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const step = lesson.steps[stepIndex];
  const outcome = combatOutcome(combat);
  const levelUp = index === 0 && outcome === 'won';
  useEffect(() => { if (levelUp) playSound('levelUp'); }, [levelUp]);
  const [budgetAtLevel, setBudgetAtLevel] = useState(0);
  const spent = traitPointsAvailable(character) < budgetAtLevel;
  function allowed(action: RunAction) {
    if (!step) return false;
    return (
      (step.kind === 'play' &&
        action.type === 'playCard' &&
        combat.hand[action.handIndex] === step.card) ||
      (step.kind === 'move' &&
        action.type === 'move' &&
        action.move === step.move) ||
      (step.kind === 'turn' && action.type === 'endTurn')
    );
  }
  function act(action: RunAction) {
    if (action.type === 'setTraitNode' || action.type === 'equipItem') {
      const next =
        action.type === 'setTraitNode'
          ? setTraitNode(character, action.trait, action.node, action.owned)
          : equipItem(character, action.slot, action.itemId, action.ringIndex);
      setCharacter(next);
      setCombat((state) => syncCharacterCombat(state, next));
      return;
    }
    if (outcome !== 'ongoing') return;
    if (!allowed(action)) return;
    const next =
      action.type === 'playCard'
        ? playCard(
            combat,
            action.handIndex,
            action.targetUid,
            action.targetUids,
            action.imbueIndex
          )
        : action.type === 'move'
          ? move(combat, action.move)
          : action.type === 'endTurn'
            ? endTurn(combat)
            : combat;
    if (next === combat) return;
    setCombat(next);
    if (step) advance(stepIndex + 1);
    if (combatOutcome(next) === 'won') {
      if (index === 0) {
        const nextLevel = awardCharacterVictory(character);
        setBudgetAtLevel(traitPointsAvailable(nextLevel));
        setCharacter(nextLevel);
      }
    }
  }
  const practiced = !step && !levelUp && outcome !== 'lost';
  const cue = levelUp
    ? { selector: portrait, label: 'Open your character' }
    : step
      ? {
          selector:
            step.kind === 'pile'
              ? '[data-pile="' + step.pile + '"]'
              : step.kind === 'inspect'
                ? step.selector
                : step.kind === 'play'
                  ? '[data-hand-slot] [data-card-id="' + step.card + '"]'
                  : step.kind === 'move'
                    ? 'button[data-card-size][data-move="' + step.move + '"]'
                    : '.table-end',
          label: step.label,
        }
      : undefined;
  function inspect(event: MouseEvent) {
    if (
      step?.kind === 'inspect' &&
      event.target instanceof Element &&
      event.target.closest(step.selector)
    )
      advance(stepIndex + 1);
  }
  if (outcome === 'lost')
    return (
      <section className="first-fight-result">
        <h2>Regroup</h2>
        <p>Return to the lessons to try this fight again.</p>
        <Button variant="menu" onClick={leave}>
          Back to lessons
        </Button>
      </section>
    );
  return (
    <section
      className="first-fight"
      data-lesson={lesson.id}
      data-level-guide={levelUp ? (spent ? 'close' : 'spend') : undefined}
    >
      <header className="first-fight-guide">
        <div>
          <strong>{lesson.title}</strong>
          <small>
            {step &&
              !levelUp &&
              ' Step ' + (stepIndex + 1) + ' of ' + lesson.steps.length}
          </small>
          <p aria-live="polite">
            {levelUp
              ? spent
                ? 'Point spent. Close the sheet to finish.'
                : sheetOpen
                  ? 'Tap the starting star on the Traits page to preview. Tap it again to spend the point.'
                  : 'You reached level ' +
                    character.level +
                    '. Tap your highlighted portrait to spend a trait point, or finish here.'
              : (step?.tip ??
                (lesson.id === 'piles'
                  ? 'You played Backhand twice. The reshuffle returned it to your hand, Hold kept Ruin in hand, and Blood Pact stayed removed.'
                  : lesson.id === 'rows'
                    ? `You opened the ${ROW_LABEL.front} with Back Step, closed the gap with Charge, and spent Momentum on a melee hit.`
                    : 'You applied Poison and watched it trigger before the enemy acted.'))}
          </p>
        </div>
        {practiced || levelUp ? (
          <Button variant="menu" onClick={() => complete(lesson.id)}>
            Finish lesson
          </Button>
        ) : (
          <Button variant="menu" onClick={leave}>
            Lessons
          </Button>
        )}
      </header>
      <div className="relative min-h-0" onClickCapture={inspect}>
        <CombatView
          levelGuide={levelUp ? (spent ? "close" : "spend") : undefined}
          manualTurns
          allowCombatAction={allowed}
          {...(cue && { tutorialCue: cue })}
          onPileClosed={(pile) => {
            if (step?.kind === 'pile' && step.pile === pile)
              advance(stepIndex + 1);
          }}
          onCharacterOpened={() => setSheetOpen(true)}
          onCharacterClosed={() => {
            setSheetOpen(false);
            if (levelUp && spent) complete(lesson.id);
          }}
          combat={combat}
          character={character}
          deck={[...lesson.hand, ...lesson.draw]}
          terrainIndex={index}
          where={lesson.title}
          score={0}
          onAction={act}
        />
      </div>
    </section>
  );
}
