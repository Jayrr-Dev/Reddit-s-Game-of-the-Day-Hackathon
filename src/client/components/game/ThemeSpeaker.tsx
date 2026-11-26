// ===================================================================
// THEME SPEAKER
// A small speaker button on a training card that plays (or stops) that
// card's boss theme. It sits beside the card's own button, never inside
// it, so a tap here never starts the fight or picks the arena.
// ===================================================================

import { Glyph } from '../ui/Glyph';
import type { ThemePreview, ThemePreviewControls } from '../../hooks/useThemePreview';

// --- COMPONENT ---
/** Toggles one theme preview; lit while its theme is playing. */
export const ThemeSpeaker = ({
  preview,
  name,
  controls,
}: {
  preview: ThemePreview;
  name: string;
  controls: ThemePreviewControls;
}) => {
  const isPlaying = controls.playingKey === preview.key;
  const label = (isPlaying ? 'Stop theme of ' : 'Play theme of ') + name;
  return (
    <button
      type="button"
      className="training-speaker"
      aria-label={label}
      title={label}
      aria-pressed={isPlaying}
      onClick={() => controls.toggle(preview)}
    >
      <Glyph name="speaker" className="size-4" />
    </button>
  );
};
