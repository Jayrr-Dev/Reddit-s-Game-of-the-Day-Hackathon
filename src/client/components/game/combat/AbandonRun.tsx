// ===================================================================
// ABANDON RUN
// The pause menu's way out of a run. One tap asks first; the second
// confirms. Abandoning ends the march like a defeat: the score so far
// is kept and the results screen follows.
// ===================================================================

import { useState } from 'react';
import { Button } from '../../ui/Button';

// --- COMPONENT ---
/** Renders "Abandon run", then a confirm / keep-going pair. */
export const AbandonRun = ({ onConfirm }: { onConfirm: () => void }) => {
  const [isAsking, setIsAsking] = useState(false);
  if (!isAsking)
    return (
      <Button
        variant="menu"
        onClick={() => setIsAsking(true)}
      >
        Abandon run
      </Button>
    );
  return (
    <div className="grid w-full gap-2">
      <p className="text-center text-xs text-ink-muted">
        End the march here? Your score so far is kept.
      </p>
      <Button variant="menuPrimary" onClick={onConfirm}>
        Yes, abandon
      </Button>
      <Button variant="menu" onClick={() => setIsAsking(false)}>
        Keep marching
      </Button>
    </div>
  );
};
