// ===================================================================
// SHROUD GAIN POPS
// When you gain Shroud, a "+N" chip in the same look as the Shroud
// chip under it (shield + number) floats up and fades out.
// ===================================================================

import { STATUS_LOOK } from '../../../content/visuals';
import { useGainPops } from '../../../hooks/useGainPops';
import { Chip } from '../../ui/Chip';

// --- COMPONENT ---
/** Renders the floating "+N Shroud" chips, anchored above their parent. */
export const ShroudGainPops = ({ shroud }: { shroud: number }) => {
  const pops = useGainPops(shroud);
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2">
      {pops.map((pop) => (
        <span
          key={pop.id}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 origin-bottom scale-150"
        >
          <span className="block animate-gain-float">
            <Chip {...STATUS_LOOK.shroud} text={`+${pop.amount}`} />
          </span>
        </span>
      ))}
    </div>
  );
};
