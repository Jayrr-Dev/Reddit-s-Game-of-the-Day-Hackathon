// ===================================================================
// SHROUD GAIN POPS
// When you gain Shroud, a bare shield + "+N" in the Shroud chip's
// colour (no background) floats up and fades out.
// ===================================================================

import { STATUS_LOOK } from '../../../content/visuals';
import { useGainPops } from '../../../hooks/useGainPops';
import { Glyph } from '../../ui/Glyph';

// --- COMPONENT ---
/** Renders the floating "+N" Shroud gains, anchored above their parent. */
export const ShroudGainPops = ({ shroud }: { shroud: number }) => {
  const pops = useGainPops(shroud);
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2">
      {pops.map((pop) => (
        <span
          key={pop.id}
          className={`absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-0.5 font-display text-xl font-black whitespace-nowrap animate-gain-float drop-shadow-[0_0_3px_black] [-webkit-text-stroke:1px_var(--color-surface-sunken)] ${STATUS_LOOK.shroud.toneClass}`}
        >
          <Glyph name={STATUS_LOOK.shroud.glyph} className="size-5" />
          {`+${pop.amount}`}
        </span>
      ))}
    </div>
  );
};
