// ===================================================================
// SCENARIO PICKER
// The target dummies' pause-menu picker, in tabs: Scenarios (preset
// lineups, SANDBOX_SCENARIOS, in unit type sections), Units (every hero
// in the catalog, one by one, to fight alone), Decks (themed test decks,
// SANDBOX_DECKS), Map and Sounds (every music loop and sound effect). Tapping a scenario asks first (fight or not), so a
// stray tap never drops the player into a boss; tapping a deck deals a
// fresh fight from it against the same dummies.
// ===================================================================

import { CustomDeckEditor } from './CustomDeckEditor';
import { MAP_IMAGES, MAP_NAMES } from './combat/Backdrop';
import { bossArenaOf, TRAINING_BOSS_ARENAS, type BossArena } from '../../content/bossArenas';
import { Fragment, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { getCard, type CardId } from '../../../shared/game/cards';
import { newestCardIds } from '../../../shared/game/cardReleases';
import { getHero, type HeroId } from '../../../shared/game/heroes';
import { describeHeroMoveList } from '../../../shared/game/describe';
import { CARD_LOOK, EDGE_ART, ELEMENT_LOOK, TIER_NAME_CLASS } from '../../content/visuals';
import { MoveEffect } from './MoveEffect';
import { HeroFigure } from './combat/HeroFigure';
import { FIGURE_BOUNDS, type FigureBounds } from '../../content/figureBounds';
import { BODY_HEIGHT, BODY_WIDTH } from '../../lib/heroFigure';
import { cssVars } from '../../lib/cssVars';
import { Glyph } from '../ui/Glyph';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ThemeSpeaker } from './ThemeSpeaker';
import { MapViewDialog, type MapView } from './MapViewDialog';
import { SoundLibrary } from './menu/SoundLibrary';
import type { ThemePreviewControls } from '../../hooks/useThemePreview';
import {
  groupScenariosByUnitType,
  groupUnitsByUnitType,
  scenarioTier,
  soloUnitScenario,
  type SandboxScenario,
} from '../../../shared/game/sandbox';
import {
  SANDBOX_DECKS,
  type SandboxDeckId,
  type CustomTrainingDeck,
} from '../../../shared/game/sandboxDecks';

// --- TYPES ---
type PickerTab = 'scenarios' | 'units' | 'decks' | 'map' | 'sounds';

/** One entry in either tab; nameClass colours the name (scenario tier). */
type PickerEntry = { id: string; name: string; blurb?: string; nameClass?: string };

/** One headed section of either tab: a unit type, or Stationary on Units. */
type PickerSection = { id: string; label: string; scenarios: readonly SandboxScenario[] };

// --- CONSTANTS ---
const TAB_LABELS: Record<PickerTab, string> = {
  scenarios: 'Scenarios',
  units: 'Units',
  decks: 'Decks',
  map: 'Map',
  sounds: 'Sounds',
};

/** Scenarios in unit type sections; the catalog is static, so group once. */
const SCENARIO_GROUPS: readonly PickerSection[] = groupScenariosByUnitType().map((group) => ({
  ...group,
  id: group.unitType,
}));
/** Every unit as a one-on-one scenario, in the same unit type sections. */
const UNIT_GROUPS: readonly PickerSection[] = groupUnitsByUnitType().map((group) => ({
  ...group,
  scenarios: group.heroIds.map(soloUnitScenario),
}));

// --- SUBCOMPONENTS ---
/** A full-width heading that starts a section of the entry grid. */
const SectionHeading = ({ children }: { children: ReactNode }) => (
  <h3 className="col-span-full mt-1 text-xs font-bold uppercase tracking-widest text-[#f2d29b]">
    {children}
  </h3>
);

const DECK_EXAMPLES = {
  stackedBuffs: ['sap', 'bulwark', 'instinct'],
  all: ['twinDaggers', 'frostBolt', 'boneWard'],
  newCards: newestCardIds(3),
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
      <span className={`font-display text-sm font-black ${entry.nameClass ?? 'text-ink'}`}>
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
  <div className="training-tabs grid grid-cols-5 gap-1" role="tablist">
    {(Object.keys(TAB_LABELS) as PickerTab[]).map((id) => (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={tab === id}
        onClick={() => onTab(id)}
        className={`rounded-full px-0.5 py-0.5 text-[10px] font-bold uppercase tracking-normal transition sm:px-1 sm:text-xs sm:tracking-widest ${tab === id ? 'bg-accent text-on-accent' : 'text-ink/60 hover:text-ink'}`}
      >
        {TAB_LABELS[id]}
      </button>
    ))}
  </div>
);

/** One unit's moves, in the order it cycles them, each with its effects. */
const UnitMoveList = ({ heroId }: { heroId: HeroId }) => (
  <ol className="unit-move-list">
    {describeHeroMoveList(heroId).map((move, index) => (
      <li key={index} data-signature={move.isSignature || undefined}>
        <span className="unit-move-name">
          <span className="unit-move-step">{index + 1}</span>
          {move.name}
          {move.isSignature && <span className="unit-move-tag">Signature</span>}
        </span>
        <ul>
          {move.intents.map((intent, i) => <MoveEffect key={i} intent={intent} />)}
        </ul>
      </li>
    ))}
  </ol>
);

/**
 * Asks whether to fight the tapped scenario before it starts. With
 * showMoves (a unit's info icon), it also lists that unit's attacks.
 */
const FightPrompt = ({
  scenario,
  showMoves,
  onFight,
  onBack,
}: {
  scenario: SandboxScenario;
  showMoves: boolean;
  onFight: () => void;
  onBack: () => void;
}) => {
  const [heroId] = scenario.heroIds;
  return (
    <ConfirmDialog
      title={(showMoves ? '' : 'Fight ') + scenario.name + (showMoves ? '' : '?')}
      confirmLabel="Fight"
      cancelLabel={showMoves ? 'Close' : 'Not now'}
      onConfirm={onFight}
      onCancel={onBack}
    >
      {scenario.blurb}
      {showMoves && heroId && <UnitMoveList heroId={heroId} />}
    </ConfirmDialog>
  );
};

/** A boss arena in the map viewer: its backdrop and the boss theme. */
const arenaView = (arena: BossArena): MapView => ({
  name: arena.name,
  image: arena.image,
  theme: { key: 'arena:' + arena.name, isBoss: true, arena },
});

/** A region map in the map viewer: its backdrop and its own score. */
const regionView = (name: string, index: number): MapView => ({
  name,
  image: MAP_IMAGES[index],
  theme: { key: 'region:' + name, isBoss: false, mapId: name },
});

/** The round "i" that opens a unit's attacks, over the corner of its card. */
const InfoButton = ({ name, onInfo, label = 'Attacks' }: { name: string; onInfo: () => void; label?: string }) => (
  <button type="button" className="training-info" aria-label={label + ' of ' + name} title={label} onClick={onInfo}>
    i
  </button>
);

/** Scenarios under unit type headings; a tap asks to fight first. */
const ScenarioSections = ({
  groups,
  terrainIndex,
  onPick,
  onInfo,
  themePreview,
}: {
  groups: readonly PickerSection[];
  terrainIndex: number;
  onPick: (scenario: SandboxScenario) => void;
  /** Set on the Units tab: each card gets an info icon for its attacks. */
  onInfo?: ((scenario: SandboxScenario) => void) | undefined;
  themePreview: ThemePreviewControls;
}) =>
  groups.map((group) => (
    <Fragment key={group.id}>
      <SectionHeading>{group.label}</SectionHeading>
      {group.scenarios.map((scenario) => (
        <div className="training-custom-tile" key={scenario.id}>
        <ScenarioEntry
          scenario={scenario}
          terrainIndex={terrainIndex}
          onPick={onPick}
          themePreview={themePreview}
        />
        {onInfo && <InfoButton name={scenario.name} onInfo={() => onInfo(scenario)} />}
        </div>
      ))}
    </Fragment>
  ));

/** One scenario card; a boss scenario also gets a speaker for its theme. */
const ScenarioEntry = ({
  scenario,
  terrainIndex,
  onPick,
  themePreview,
}: {
  scenario: SandboxScenario;
  terrainIndex: number;
  onPick: (scenario: SandboxScenario) => void;
  themePreview: ThemePreviewControls;
}) => {
  const tier = scenarioTier(scenario);
  const arena = bossArenaOf(scenario.heroIds);
  const card = (
    <EntryButton
      entry={{ ...scenario, nameClass: TIER_NAME_CLASS[tier] }}
      preview={
        <ScenarioPreview scenario={scenario} terrain={arena?.image ?? MAP_IMAGES[terrainIndex]} />
      }
      isActive={false}
      onPick={() => onPick(scenario)}
    />
  );
  if (tier !== 'boss') return card;
  return (
    <>
      {card}
      <ThemeSpeaker
        preview={{ key: 'scenario:' + scenario.id, isBoss: true, arena }}
        name={scenario.name}
        controls={themePreview}
      />
    </>
  );
};

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
  themePreview,
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
  /** Plays a boss arena's theme from the speaker on its card. */
  themePreview: ThemePreviewControls;
}) => {
  const [tab, setTab] = useState<PickerTab>('scenarios');
  const [editing, setEditing] = useState<string | null>(null);
  // The scenario waiting on the fight-or-not answer, if any.
  const [pending, setPending] = useState<SandboxScenario | null>(null);
  // The boss arena shown full size in its info dialog, if any.
  const [viewedMap, setViewedMap] = useState<MapView | null>(null);
  // True when the prompt was opened from a unit's info icon (lists its attacks).
  const [isShowingMoves, setShowingMoves] = useState(false);
  const askToFight = (scenario: SandboxScenario, showMoves: boolean) => {
    setShowingMoves(showMoves);
    setPending(scenario);
  };
  const draft = customDecks.find((deck) => deck.id === editing);
  // Closing the menu (resume, pause toggle) ends any theme preview.
  const stopPreview = themePreview.stop;
  useEffect(() => stopPreview, [stopPreview]);
  return (
    <>
    {renderHeader(() => { setTab('decks'); setEditing(''); })}
    <section className="training-picker">
      <TabBar tab={tab} onTab={setTab} />
      {pending && (
        <FightPrompt
          scenario={pending}
          showMoves={isShowingMoves}
          onFight={() => { setPending(null); onPickScenario(pending); }}
          onBack={() => setPending(null)}
        />
      )}
      {viewedMap && (
        <MapViewDialog view={viewedMap} themePreview={themePreview} onClose={() => setViewedMap(null)} />
      )}
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
        {tab === 'scenarios' || tab === 'units' ? (
          <ScenarioSections
            groups={tab === 'units' ? UNIT_GROUPS : SCENARIO_GROUPS}
            terrainIndex={terrainIndex}
            onPick={(scenario) => askToFight(scenario, false)}
            onInfo={tab === 'units' ? (scenario) => askToFight(scenario, true) : undefined}
            themePreview={themePreview}
          />
        ) : tab === 'sounds' ? (
          <SoundLibrary renderHeading={(label) => <SectionHeading key={label}>{label}</SectionHeading>} />
        ) : tab === 'map' ? (
          <>
          <SectionHeading>Boss arenas</SectionHeading>
          {TRAINING_BOSS_ARENAS.map(arena => (
            <div key={arena.name} className="training-custom-tile">
              <button type="button" className="training-map"
                aria-pressed={arena.name === activeArena?.name} onClick={() => onPickArena(arena)}>
                <img alt="" loading="lazy" src={arena.image} />
                <span>{arena.name}</span>
              </button>
              <InfoButton name={arena.name} label="View" onInfo={() => setViewedMap(arenaView(arena))} />
            </div>
          ))}
          <SectionHeading>Region maps</SectionHeading>
          {MAP_NAMES.map((name, index) => (
            <div key={name} className="training-custom-tile">
              <button
                type="button"
                className="training-map"
                aria-pressed={!activeArena && index === terrainIndex}
                onClick={() => onPickMap(index)}
              >
                <img alt="" loading="lazy" src={MAP_IMAGES[index]} />
                <span>{name}</span>
              </button>
              <InfoButton name={name} label="View" onInfo={() => setViewedMap(regionView(name, index))} />
            </div>
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
