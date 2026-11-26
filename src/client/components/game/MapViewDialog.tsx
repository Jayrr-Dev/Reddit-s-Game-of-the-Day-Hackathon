// ===================================================================
// MAP VIEW DIALOG
// Opened from a boss arena or region map card's info icon: the map's full
// backdrop, its name and an X to close. While it is open the map's theme
// plays (through the shared theme preview), and closing it stops it.
// Viewing never picks the map or starts a fight.
// ===================================================================

import { useEffect, useId, useRef } from 'react';
import { IconButton } from '../ui/IconButton';
import type { ThemePreview, ThemePreviewControls } from '../../hooks/useThemePreview';

// --- TYPES ---
/** What the dialog shows and which theme it plays. */
export type MapView = { name: string; image: string | undefined; theme: ThemePreview };

// --- COMPONENT ---
/** Renders the open map viewer; the parent unmounts it to close. */
export const MapViewDialog = ({
  view,
  themePreview,
  onClose,
}: {
  view: MapView;
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

  // The theme plays for as long as this map is on screen.
  const { theme } = view;
  useEffect(() => {
    play(theme);
    return stop;
  }, [theme, play, stop]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="arena-dialog"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <img alt={view.name} src={view.image} />
      <h2 id={titleId}>{view.name}</h2>
      <IconButton icon="close" label="Close" className="arena-dialog-close" onClick={onClose} autoFocus />
    </dialog>
  );
};
