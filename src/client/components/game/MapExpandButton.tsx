import { useEffect, useState } from 'react';
import { exitExpandedMode, requestExpandedMode, showToast } from '@devvit/web/client';
import { Button } from '../ui/Button';
import { redditViewMode, useMapExpansionScope, writeMapHandoff, type MapHandoff } from '../../lib/mapExpansion';

/** Expand the current map with Reddit's native view controls. */
export function MapExpandButton({ view }: { view?: MapHandoff | undefined }) {
  const scope = useMapExpansionScope();
  const [mode, setMode] = useState(redditViewMode);
  useEffect(() => {
    const refresh = () => setMode(redditViewMode());
    window.addEventListener('focus', refresh);
    window.addEventListener('resize', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('resize', refresh);
    };
  }, []);
  if (!scope || !mode) return null;
  const expanded = mode === 'expanded';
  const label = expanded ? 'Exit full screen' : 'Full screen';
  return <Button variant="menu" className="gap-2"
    onClick={event => {
      try {
        if (expanded) {
          exitExpandedMode(event.nativeEvent);
          setMode('inline');
        } else {
          writeMapHandoff(scope, view ?? {});
          requestExpandedMode(event.nativeEvent, 'default');
          setMode('expanded');
        }
      } catch {
        showToast('Could not switch map views.');
      }
    }}>
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={expanded ? 'M3 8h5V3m8 0v5h5M3 16h5v5m8 0v-5h5' : 'M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5'} />
    </svg>
    {label}
  </Button>;
}
