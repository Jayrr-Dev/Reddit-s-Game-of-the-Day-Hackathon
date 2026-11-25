// --- DEFEAT TRANSITION ---
import { playSound } from '../../lib/gameAudio';
import { useEffect, useId, useRef } from 'react';
import { Button } from '../ui/Button';
import { Glyph } from '../ui/Glyph';
import './deathScreen.css';

type DeathScreenProps = {
  onContinue: () => void;
  buttonLabel?: string;
  title?: string;
  epitaph?: string;
};

/** Holds focus above the final battlefield until the player chooses to continue. */
export const DeathScreen = ({
  onContinue,
  buttonLabel = 'Continue',
  title = 'You have fallen',
  epitaph = 'At dawn, the kingdom counts its living.',
}: DeathScreenProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const epitaphId = useId();
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    playSound('remove', .61, .85);
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="death-screen"
      aria-labelledby={headingId}
      aria-describedby={epitaphId}
      onCancel={(event) => {
        event.preventDefault();
        onContinue();
      }}
    >
      <div className="death-script">
        <div className="death-device" aria-hidden="true">
          <i />
          <Glyph name="crown" className="death-crown" />
          <i />
        </div>
        <h1 id={headingId}>{title}</h1>
        <p id={epitaphId}>{epitaph}</p>
        <Button variant="menuPrimary" onClick={onContinue}>
          {buttonLabel}
        </Button>
      </div>
    </dialog>
  );
};
