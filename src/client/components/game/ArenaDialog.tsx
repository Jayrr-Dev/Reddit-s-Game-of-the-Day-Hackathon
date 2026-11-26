// ===================================================================
// ARENA DIALOG
// Opened from a boss arena card's info icon: the arena's full backdrop,
// its name and an X to close. While it is open the arena's theme plays
// (through the shared theme preview), and closing it stops the theme.
// Viewing never picks the arena or starts a fight.
// ===================================================================

import { useEffect, useId, useRef } from 'react';
import { IconButton } from '../ui/IconButton';
import type { BossArena } from '../../content/bossArenas';
import type { ThemePreviewControls } from '../../hooks/useThemePreview';

// --- COMPONENT ---
/** Renders the open arena viewer; the parent unmounts it to close. */
export const ArenaDialog = ({
  arena,
  themePreview,
  onClose,
}: {
  arena: BossArena;
  themePreview: ThemePreviewControls;
  onClose: () => void;
}) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { play, stop } = themePreview;

  // Open on mount; close on unmount so the top layer never keeps a ghost.
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  // The theme plays for as long as this arena is on screen.
  useEffect(() => {
    play({ key: 'arena:' + arena.name, arena });
    return stop;
  }, [arena, play, stop]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="arena-dialog"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <img alt={arena.name} src={arena.image} />
      <h2 id={titleId}>{arena.name}</h2>
      <IconButton icon="close" label="Close" className="arena-dialog-close" onClick={onClose} autoFocus />
    </dialog>
  );
};
