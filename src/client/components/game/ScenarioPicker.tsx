// ===================================================================
// SCENARIO PICKER
// The target dummies' list of preset lineups (SANDBOX_SCENARIOS), shown
// in the practice pause menu. Tapping one starts a fight against it.
// ===================================================================

import {
  SANDBOX_SCENARIOS,
  type SandboxScenario,
} from '../../../shared/game/sandbox';

// --- SUBCOMPONENTS ---
/** One scenario: its name and a line on what it tests. */
const ScenarioButton = ({
  scenario,
  onPick,
}: {
  scenario: SandboxScenario;
  onPick: (scenario: SandboxScenario) => void;
}) => (
  <button
    type="button"
    onClick={() => onPick(scenario)}
    className="flex flex-col gap-0.5 rounded-lg bg-surface-raised px-2.5 py-2 text-left ring-1 ring-accent/40 transition hover:ring-accent active:scale-[0.98]"
  >
    <span className="font-display text-sm font-black text-ink">
      {scenario.name}
    </span>
    <span className="text-[11px] leading-tight text-ink/70">
      {scenario.blurb}
    </span>
  </button>
);

// --- COMPONENT ---
/** Renders the scenarios as a two-column grid under a small heading. */
export const ScenarioPicker = ({
  onPick,
}: {
  onPick: (scenario: SandboxScenario) => void;
}) => (
  <section className="flex w-full max-w-80 flex-col gap-1.5">
    <h3 className="text-center text-xs font-bold tracking-widest text-ink/60 uppercase">
      Scenarios
    </h3>
    <div className="grid grid-cols-2 gap-1.5">
      {SANDBOX_SCENARIOS.map((scenario) => (
        <ScenarioButton key={scenario.id} scenario={scenario} onPick={onPick} />
      ))}
    </div>
  </section>
);
