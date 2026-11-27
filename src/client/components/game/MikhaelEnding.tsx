import { useEffect, useState } from 'react';
import { playSound } from '../../lib/gameAudio';
import { Button } from '../ui/Button';
import { ProgressiveImg } from '../ui/ProgressiveImage';
import { bossArenaOf } from '../../content/bossArenas';
import { MikhaelArenaMotion } from './combat/MikhaelArenaMotion';
import { HeroFigure } from './combat/HeroFigure';
import './mikhaelEnding.css';

const SEAL_HOLD_MS = 3200;

/** Mikhael survives the duel and seals Wraith; no combat death overlay appears. */
export function MikhaelEnding({ gold, onContinue }: { gold?: number | undefined; onContinue: () => void }) {
  const [sealed, setSealed] = useState(false);
  const image = bossArenaOf(['archangelMikhael'])?.image;
  useEffect(() => {
    const cue = window.setTimeout(() => playSound('cervielSeal', .8, .78), 480);
    const close = window.setTimeout(() => setSealed(true), SEAL_HOLD_MS);
    return () => { window.clearTimeout(cue); window.clearTimeout(close); };
  }, []);
  return <section className="mikhael-ending" aria-label="The Last Seal" data-sealed={sealed || undefined}>
    {image && <ProgressiveImg className="mikhael-ending-backdrop" src={image} alt="" />}
    <MikhaelArenaMotion />
    <div className="mikhael-ending-stage" aria-hidden="true">
      <div className="mikhael-ending-mikhael"><HeroFigure heroId="archangelMikhael" size={3} phase={2} /></div>
      <svg className="mikhael-ending-seal" viewBox="0 0 300 300" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="150" cy="150" r="136" /><circle cx="150" cy="150" r="120" strokeDasharray="3 5" />
        <path d="M150 22 278 150 150 278 22 150ZM150 44 242 230H58ZM150 256 58 70h184Z" />
        <circle cx="150" cy="150" r="46" /><path d="M150 108v84m-42-42h84" />
      </svg>
    </div>
    <div className="mikhael-ending-copy">
      <p className="mikhael-ending-kicker">Archangel Mikhael · Taxiarch</p>
      <blockquote>“My sword cannot end thee. I will not send thee back to rise again.”</blockquote>
      {sealed && <div className="mikhael-ending-result">
        <h1>Wraith is sealed</h1>
        <p>To be continued.</p>
        {gold !== undefined && <small>Victory: +{gold} Gold</small>}
        <Button variant="menuPrimary" onClick={onContinue}>View conquest results</Button>
      </div>}
    </div>
  </section>;
}
