// ===================================================================
// CHARGE BUTTON
// Shown while the front row is empty and heroes hold the back: the
// villain can pay CHARGE_COST energy to charge, bringing the back row
// up and gaining Momentum. Greyed out when there isn't enough energy.
// ===================================================================

import { CHARGE_COST } from '../../../../shared/game/rules';
import { Glyph } from '../../ui/Glyph';

// --- COMPONENT ---
/** The Charge pill with its energy cost. */
export const ChargeButton = ({
  isAffordable,
  onCharge,
}: {
  isAffordable: boolean;
  onCharge: () => void;
}) => (
  <button
    type="button"
    onClick={onCharge}
    disabled={!isAffordable}
    title="Charge: the back row steps up, and your next Melee card this turn deals 50% more damage."
    className="flex items-center gap-1.5 rounded-full bg-blood py-1 pl-1 pr-3 font-display text-sm font-black uppercase tracking-widest text-ink shadow-[0_0_14px_var(--color-blood)] ring-1 ring-accent transition active:scale-95 enabled:animate-pulse disabled:opacity-40 disabled:shadow-none"
  >
    <span className="flex size-5 items-center justify-center rounded-full bg-energy text-xs text-surface-sunken">
      {CHARGE_COST}
    </span>
    <Glyph name="bolt" className="size-4" />
    Charge
  </button>
);
