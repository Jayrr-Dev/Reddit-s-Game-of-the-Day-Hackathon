// ===================================================================
// SCENARIO PICKER
// The target dummies' pause-menu picker, in tabs: Scenarios (preset
// lineups, SANDBOX_SCENARIOS) and Decks (themed test decks,
// SANDBOX_DECKS). Tapping a scenario starts a fight against it; tapping
// a deck deals a fresh fight from it against the same dummies.
// ===================================================================

import { MAP_NAMES } from './combat/Backdrop';
import { useState } from 'react';
import {
  SANDBOX_SCENARIOS,
  type SandboxScenario,
} from '../../../shared/game/sandbox';
import {
  SANDBOX_DECKS,
  type SandboxDeckId,
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
/** One entry: its name and a line on what it tests; lit when active. */
const EntryButton = ({
  entry,
  isActive,
  onPick,
}: {
  entry: PickerEntry;
  isActive: boolean;
  onPick: () => void;
}) => (
  <button
    type="button"
    onClick={onPick}
    aria-pressed={isActive}
    className={`flex flex-col gap-0.5 rounded-lg bg-surface-raised px-2.5 py-2 text-left ring-inset transition hover:ring-accent active:scale-[0.98] ${isActive ? 'ring-2 ring-accent' : 'ring-1 ring-accent/40'}`}
  >
    <span className="font-display text-sm font-black text-ink">
      {entry.name}
    </span>
    {entry.blurb && <span className="text-[11px] leading-tight text-ink/70">{entry.blurb}</span>}
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
  <div className="flex justify-center gap-1" role="tablist">
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
  terrainIndex,
  onPickMap,
  deckId,
  onPickScenario,
  onPickDeck,
}: {
  terrainIndex: number;
  onPickMap: (index: number) => void;
  deckId: SandboxDeckId;
  onPickScenario: (scenario: SandboxScenario) => void;
  onPickDeck: (deckId: SandboxDeckId) => void;
}) => {
  const [tab, setTab] = useState<PickerTab>('scenarios');
  return (
    <section className="flex w-full max-w-80 flex-col gap-1.5">
      <TabBar tab={tab} onTab={setTab} />
      <div className="grid grid-cols-2 gap-1.5">
        {tab === 'scenarios'
          ? SANDBOX_SCENARIOS.map((scenario) => (
              <EntryButton
                key={scenario.id}
                entry={scenario}
                isActive={false}
                onPick={() => onPickScenario(scenario)}
              />
            ))
          : tab === 'map' ? MAP_NAMES.map((name, index) => (
              <EntryButton key={name} entry={{ id: name, name }} isActive={index === terrainIndex} onPick={() => onPickMap(index)} />
            )) : SANDBOX_DECKS.map((deck) => (
              <EntryButton
                key={deck.id}
                entry={deck}
                isActive={deck.id === deckId}
                onPick={() => onPickDeck(deck.id)}
              />
            ))}
      </div>
    </section>
  );
};
