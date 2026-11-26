// ===================================================================
// RESPEC DIALOG
// Asks before a respec, showing the item it costs and how many the
// player owns. Admins see the same dialog but may confirm for free.
// ===================================================================
import { useLayoutEffect, useRef } from 'react';
import { Glyph, type GlyphName } from '../ui/Glyph';

// --- TYPES ---
/** The item a respec spends, as the dialog shows it. */
export type RespecItem = {
  name: string;
  pluralName: string;
  icon: GlyphName;
  owned: number;
  /** True for admins: confirming spends nothing. */
  isFree: boolean;
};

// --- DIALOG ---
/** A modal confirm; Cancel or Escape closes it without spending anything. */
export const RespecDialog = ({ item, onConfirm, onCancel }: {
  item: RespecItem;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const canConfirm = item.isFree || item.owned > 0;
  // Open as a modal on mount so it sits above the character sheet.
  useLayoutEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="respec-dialog"
      aria-labelledby="respec-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <Glyph name={item.icon} className="respec-dialog-icon" />
      <h3 id="respec-dialog-title">Use a {item.name}?</h3>
      <p>Respec returns every trait point so you can spend them again.</p>
      <p className="respec-dialog-owned">
        You have <b>{item.owned}</b> {item.owned === 1 ? item.name : item.pluralName}.
      </p>
      {item.isFree && <p className="respec-dialog-note">Admin: this respec is free.</p>}
      {!canConfirm && <p className="respec-dialog-note">You need a {item.name} to respec.</p>}
      <div className="respec-dialog-actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="button" data-own-sound disabled={!canConfirm} onClick={onConfirm}>
          Use {item.name}
        </button>
      </div>
    </dialog>
  );
};
