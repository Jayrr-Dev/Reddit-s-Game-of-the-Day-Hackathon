// --- RUN CHARACTER SHEET ---
import type { ReactNode } from 'react';
import type { CharacterState } from '../../../shared/game/character';
import type { RunAction } from '../../../shared/game/run';
import { CharacterSheet, type SheetVitals } from './CharacterSheet';
import type { RespecItem } from './RespecDialog';

/** Routes sheet controls through the active run or practice reducer. */
export const RunCharacterSheet = ({ character, vitals, onAction, onClose, onRespec, levelGuide, profile, inventory, respecItem }: {
  profile?: ReactNode;
  inventory?: ReactNode;
  respecItem?: RespecItem | undefined;
  levelGuide?: "spend" | "close" | undefined;
  character: CharacterState;
  vitals?: SheetVitals | undefined;
  onRespec?: (() => void) | undefined;
  onAction: (action: RunAction) => void;
  onClose: () => void;
}) => (
  <CharacterSheet levelGuide={levelGuide} profile={profile} inventory={inventory} respecItem={respecItem}
    onSkill={(pick, rankUp) => onAction({ type: rankUp ? 'buySkill' : 'skillPath', pick })}
    onRespec={onRespec}
    character={character} vitals={vitals}
    onSetTraitNode={(trait, node, owned) => onAction({ type: 'setTraitNode', trait, node, owned })}
    onEquip={(slot, itemId, ringIndex) => onAction({ type: 'equipItem', slot, itemId, ...(ringIndex !== undefined && { ringIndex }) })}
    onClose={onClose}
  />
);

