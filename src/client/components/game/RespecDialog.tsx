// ===================================================================
// RESPEC DIALOG
// Asks before a respec, showing the item it costs and how many the
// player owns. Admins see the same dialog but may confirm for free.
// ===================================================================
import { ConfirmDialog } from '../ui/ConfirmDialog';
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
/** The shared confirm dialog, worded for spending a respec item. */
export const RespecDialog = ({ item, onConfirm, onCancel }: {
  item: RespecItem;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const canConfirm = item.isFree || item.owned > 0;
  return (
    <ConfirmDialog
      title={`Use a ${item.name}?`}
      confirmLabel={`Use ${item.name}`}
      cancelLabel="Cancel"
      isConfirmDisabled={!canConfirm}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p className="flex items-center justify-center gap-1.5">
        <Glyph name={item.icon} className="size-5 text-blood" />
        Refunds all trait points. <b className="text-ink">{item.owned}</b> left.
      </p>
    </ConfirmDialog>
  );
};
