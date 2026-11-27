import { useState } from 'react';
import { borrowedBenefit, borrowedPrice, type BorrowedPower } from '../../../shared/game/borrowedPowers';
import { Button } from '../ui/Button';
import { Glyph } from '../ui/Glyph';
import { ModalDialog } from '../ui/ModalDialog';
import './borrowedPower.css';

/** Show the full benefit and price before the player commits a choice. */
export function BorrowedPowerChoices({ powers, caption, onPick, onBack }: {
  powers: readonly BorrowedPower[]; caption: string; onPick: (index: number) => void; onBack?: () => void;
}) {
  const [selected, setSelected] = useState<number>();
  return <main className="run-results results-layout borrowed-power-view" aria-label="Choose a Borrowed Power">
    <header><h1>Borrowed Power</h1><p className="mt-2 text-sm text-ink-muted">{caption}</p></header>
    <div className="borrowed-options">
      {powers.map((power, index) => <button className="borrowed-option" key={index} type="button"
        aria-pressed={selected === index} data-power-rarity={power.rarity} onClick={() => setSelected(index)}>
        <span>{power.rarity}</span>
        <strong>{borrowedBenefit(power)}</strong>
        {borrowedPrice(power) && <small>{borrowedPrice(power)}</small>}
      </button>)}
    </div>
    <div className={'results-actions' + (onBack ? '' : ' draft-primary')}>
      <Button variant="menuPrimary" disabled={selected === undefined}
        onClick={() => { if (selected !== undefined) onPick(selected); }}>Take power</Button>
      {onBack && <Button variant="menu" onClick={onBack}>Back</Button>}
    </div>
  </main>;
}

/** A permanent run buff with an inspectable ledger of all selected powers. */
export function BorrowedPowerBuff({ powers }: { powers: readonly BorrowedPower[] }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="borrowed-power-buff" type="button" aria-label={'Borrowed Power, ' + powers.length + ' active'}
      title="Borrowed Power" aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <Glyph name="swirl" className="size-3.5" />
      <span>{powers.length}</span>
    </button>
    {open && <ModalDialog title="Borrowed Power" onDismiss={() => setOpen(false)}
      actions={<Button className="col-span-2" variant="menu" onClick={() => setOpen(false)}>Done</Button>}>
      <ul className="borrowed-options">
        {powers.map((power, index) => <li className="borrowed-option" key={index} data-power-rarity={power.rarity}>
          <span>{power.rarity}</span>
          <strong>{borrowedBenefit(power)}</strong>
          {borrowedPrice(power) && <small>{borrowedPrice(power)}</small>}
        </li>)}
      </ul>
    </ModalDialog>}
  </>;
}
