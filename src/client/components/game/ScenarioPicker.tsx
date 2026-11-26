// ===================================================================
// SCENARIO PICKER
// The target dummies' pause-menu picker, in tabs: Scenarios (preset
// lineups, SANDBOX_SCENARIOS) and Decks (themed test decks,
// SANDBOX_DECKS). Tapping a scenario starts a fight against it; tapping
// a deck deals a fresh fight from it against the same dummies.
// ===================================================================

import { CustomDeckEditor } from './CustomDeckEditor';
import { MAP_IMAGES, MAP_NAMES } from './combat/Backdrop';
import { bossArenaOf, TRAINING_BOSS_ARENAS, type BossArena } from '../../content/bossArenas';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { getCard, type CardId } from '../../../shared/game/cards';
import { getHero, type HeroId } from '../../../shared/game/heroes';
import { CARD_LOOK, EDGE_ART, ELEMENT_LOOK } from '../../content/visuals';
import { HeroFigure } from './combat/HeroFigure';
import { FIGURE_BOUNDS, type FigureBounds } from '../../content/figureBounds';
import { BODY_HEIGHT, BODY_WIDTH } from '../../lib/heroFigure';
import { cssVars } from '../../lib/cssVars';
import { Glyph } from '../ui/Glyph';
import {
  SANDBOX_SCENARIOS,
  type SandboxScenario,
} from '../../../shared/game/sandbox';
import {
  SANDBOX_DECKS,
  type SandboxDeckId,
  type CustomTrainingDeck,
} from '../../../shared/game/sandboxDecks';

// --- TYPES ---
type PickerTab = 'scenarios' | 'decks' | 'map';

/** One entry in either tab. */
type PickerEntry = { id: string; name: string; blurb?: string };

// --- CONSTANTS ---
const TAB_LABELS: Record<PickerTab, string> = {
  scenarios: 'Scenarios',
  decks: 'Decks',
  map: 'Map',
};

// --- SUBCOMPONENTS ---
const DECK_EXAMPLES = {
  stackedBuffs: ['sap', 'bulwark', 'instinct'],
  all: ['twinDaggers', 'frostBolt', 'boneWard'],
  lightning: ['forkedBolt', 'staticCharge', 'overcharge'],
  hex: ['whisperHex', 'mourningCurse', 'chainsOfGrief'],
  fire: ['sear', 'emberRune', 'hexfire'],
  poison: ['venomDart', 'venomCoat', 'rainOfThorns'],
  bleed: ['hemorrhage', 'reapingCuts', 'barbedVolley'],
  afflictions: ['frostBolt', 'sapStrength', 'vexingWord'],
  sharp: ['twinDaggers', 'flurry', 'serratedSlash'],
  blunt: ['decimate', 'hurlAside', 'backhand'],
  range: ['blackArrow', 'retreatingShot', 'wildVolley'],
  movement: ['evasiveStep', 'forcePush', 'beckon'],
  defense: ['boneWard', 'spikedGuard', 'plateArmor'],
} satisfies Record<SandboxDeckId, readonly CardId[]>;

const FEATURED_HEROES: Record<string, readonly HeroId[]> = {
  holyDragon: ['holyDragon'],
  mixedRows: ['shieldmaiden', 'squire', 'bard'],
  archers: ['archer', 'archer', 'archer'],
  tankWall: ['shieldmaiden', 'priest', 'shieldmaiden'],
  elites: ['paladin', 'squire', 'archmage'],
  champion: ['valen', 'priest', 'bard'],
  ballista: ['ballista', 'archer', 'shieldmaiden'],
};

/**
 * Inline style that scales a figure so its measured drawing fills the
 * arena card by the shared margin, centred (rules in .training-portrait).
 */
const portraitStyle = (heroId: HeroId, bounds: FigureBounds): CSSProperties =>
  cssVars({
    '--body-width': BODY_WIDTH[getHero(heroId).size],
    '--body-height': BODY_HEIGHT,
    '--fit-x': bounds.x,
    '--fit-y': bounds.y,
    '--fit-width': bounds.width,
    '--fit-height': bounds.height,
  });

/** One hero in a lineup preview; a measured boss is fitted to the card. */
const PreviewFigure = ({ heroId, isLead }: { heroId: HeroId; isLead: boolean }) => {
  const bounds = isLead ? FIGURE_BOUNDS[heroId] : undefined;
  return (
    <span
      className={bounds ? 'training-portrait' : 'training-figure'}
      style={bounds && portraitStyle(heroId, bounds)}
    >
      <HeroFigure heroId={heroId} size={getHero(heroId).size} />
    </span>
  );
};

const ScenarioPreview = ({
  scenario,
  terrain,
}: {
  scenario: SandboxScenario;
  terrain: string | undefined;
}) => (
  <span className="training-art training-lineup" aria-hidden="true">
    <img alt="" src={terrain} />
    {(FEATURED_HEROES[scenario.id] ?? scenario.heroIds.slice(0, 3)).map(
      (heroId, i) => (
        <PreviewFigure heroId={heroId} isLead={i === 0} key={i} />
      )
    )}
  </span>
);

const DeckPreview = ({ cards }: { cards: readonly CardId[] }) => (
  <span className="training-art training-deck-art" aria-hidden="true">
    {cards.map((cardId, index) => {
      const card = getCard(cardId);
      const look = CARD_LOOK[card.type];
      const glyph = card.element
        ? ELEMENT_LOOK[card.element].glyph
        : ((card.edge && EDGE_ART[card.edge]) ?? look.glyph);
      return (
        <span
          className={`training-card ${look.frameClass}`}
          key={index}
          data-card-id={cardId}
          data-card-type={card.type}
        >
          <span className="training-card-art">
            <Glyph name={glyph} />
          </span>
          <span className="training-card-name">{card.name}</span>
        </span>
      );
    })}
  </span>
);

/** One entry: its name and a line on what it tests; lit when active. */
const EntryButton = ({
  entry,
  preview,
  isActive,
  onPick,
}: {
  entry: PickerEntry;
  preview: ReactNode;
  isActive: boolean;
  onPick: () => void;
}) => (
  <button
    type="button"
    onClick={onPick}
    aria-pressed={isActive}
    className="training-entry"
  >
    {preview}
    <span className="training-entry-copy">
      <span className="font-display text-sm font-black text-ink">
        {entry.name}
      </span>
      {entry.blurb && (
        <span className="text-[11px] leading-tight text-ink/70">
          {entry.blurb}
        </span>
      )}
    </span>
  </button>
);

/** The practice menu tabs. */
const TabBar = ({
  tab,
  onTab,
}: {
  tab: PickerTab;
  onTab: (tab: PickerTab) => void;
}) => (
  <div className="training-tabs grid grid-cols-3 gap-1" role="tablist">
    {(Object.keys(TAB_LABELS) as PickerTab[]).map((id) => (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={tab === id}
        onClick={() => onTab(id)}
        className={`rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-widest transition ${tab === id ? 'bg-accent text-on-accent' : 'text-ink/60 hover:text-ink'}`}
      >
        {TAB_LABELS[id]}
      </button>
    ))}
  </div>
);

// --- COMPONENT ---
/** Renders the tabs and the active tab's entries in a two-column grid. */
export const ScenarioPicker = ({
  renderHeader,
  terrainIndex,
  onPickMap,
  activeArena,
  onPickArena,
  deckId,
  customDecks,
  activeCustomId,
  onPickCustom,
  onSaveCustom,
  onPickScenario,
  onPickDeck,
}: {
  /** Renders the banner above the tabs; openDeck jumps to a new custom deck. */
  renderHeader: (openDeck: () => void) => ReactNode;
  terrainIndex: number;
  onPickMap: (index: number) => void;
  activeArena?: BossArena | undefined;
  onPickArena: (arena: BossArena) => void;
  deckId: SandboxDeckId;
  customDecks: readonly CustomTrainingDeck[];
  activeCustomId: string | null;
  onPickCustom: (id: string) => void;
  onSaveCustom: (name: string, cards: CardId[], id?: string) => void;
  onPickScenario: (scenario: SandboxScenario) => void;
  onPickDeck: (deckId: SandboxDeckId) => void;
}) => {
  const [tab, setTab] = useState<PickerTab>('scenarios');
  const [editing, setEditing] = useState<string | null>(null);
  const draft = customDecks.find((deck) => deck.id === editing);
  return (
    <>
    {renderHeader(() => { setTab('decks'); setEditing(''); })}
    <section className="training-picker">
      <TabBar tab={tab} onTab={setTab} />
      {editing !== null && (
        <CustomDeckEditor
          initial={draft}
          onClose={() => setEditing(null)}
          onSave={(name, cards) => {
            onSaveCustom(name, cards, draft?.id);
            setEditing(null);
          }}
        />
      )}
      <div
        key={tab}
        className="training-entries"
        role="tabpanel"
        aria-label={TAB_LABELS[tab]}
      >
        {tab === 'scenarios' ? (
          SANDBOX_SCENARIOS.map((scenario) => (
            <EntryButton
              key={scenario.id}
              entry={scenario}
              preview={
                <ScenarioPreview
                  scenario={scenario}
                  terrain={bossArenaOf(scenario.heroIds)?.image ?? MAP_IMAGES[terrainIndex]}
                />
              }
              isActive={false}
              onPick={() => onPickScenario(scenario)}
            />
          ))
        ) : tab === 'map' ? (
          <>
          <h3 className="col-span-full mt-1 text-xs font-bold uppercase tracking-widest text-[#f2d29b]">Boss arenas</h3>
          {TRAINING_BOSS_ARENAS.map(arena => (
            <button key={arena.name} type="button" className="training-map"
              aria-pressed={arena.name === activeArena?.name} onClick={() => onPickArena(arena)}>
              <img alt="" loading="lazy" src={arena.image} />
              <span>{arena.name}</span>
            </button>
          ))}
          <h3 className="col-span-full mt-1 text-xs font-bold uppercase tracking-widest text-[#f2d29b]">Region maps</h3>
          {MAP_NAMES.map((name, index) => (
            <button
              key={name}
              type="button"
              className="training-map"
              aria-pressed={!activeArena && index === terrainIndex}
              onClick={() => onPickMap(index)}
            >
              <img alt="" loading="lazy" src={MAP_IMAGES[index]} />
              <span>{name}</span>
            </button>
          ))}
          </>
        ) : (
          <>
            {customDecks.map((deck) => (
              <div className="training-custom-tile" key={deck.id}>
                <EntryButton
                  entry={{
                    id: deck.id,
                    name: deck.name,
                    blurb: deck.cards.length + ' cards',
                  }}
                  preview={
                    <DeckPreview cards={[...new Set(deck.cards)].slice(0, 3)} />
                  }
                  isActive={activeCustomId === deck.id}
                  onPick={() => onPickCustom(deck.id)}
                />
                <button
                  type="button"
                  className="training-deck-edit"
                  aria-label={'Edit ' + deck.name}
                  onClick={() => setEditing(deck.id)}
                >
                  Edit
                </button>
              </div>
            ))}
            {SANDBOX_DECKS.map((deck) => (
              <EntryButton
                key={deck.id}
                entry={deck}
                preview={<DeckPreview cards={DECK_EXAMPLES[deck.id]} />}
                isActive={!activeCustomId && deck.id === deckId}
                onPick={() => onPickDeck(deck.id)}
              />
            ))}
          </>
        )}
      </div>
    </section>
    </>
  );
};
