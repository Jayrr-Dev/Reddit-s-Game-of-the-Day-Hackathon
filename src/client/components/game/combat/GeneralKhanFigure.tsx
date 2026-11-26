import { useEffect, useState, type CSSProperties } from 'react';
import type { HeroAction } from '../../../content/heroLooks';
import type { HeroSize } from '../../../../shared/game/types';
import { HERO_ATTACK_MS, SIGNATURE_CHARGE_MS } from '../../../hooks/useHeroTurn';
import { BODY_HEIGHT, BODY_WIDTH } from '../../../lib/heroFigure';
import idle from '../../../assets/heroes/archangels/general-khan.webp';
import cleave from '../../../assets/heroes/archangels/general-khan-cleave-strip.webp';
import charge from '../../../assets/heroes/archangels/general-khan-charge-strip.webp';
import slam from '../../../assets/heroes/archangels/general-khan-slam-strip.webp';
import { ProgressiveSvgImage } from '../../ui/ProgressiveImage';
import './general-khan.css';

const clips = {
  cleave: { url: cleave, frames: 13, time: HERO_ATTACK_MS },
  charge: { url: charge, frames: 17, time: SIGNATURE_CHARGE_MS },
  slam: { url: slam, frames: 9, time: 360 },
};
type Clip = keyof typeof clips;
const previewWindup = 680;

function Strip({ clip, preview }: { clip: Clip; preview?: boolean }) {
  const { url, frames, time } = clips[clip];
  return <div className="khan-strip-gate" data-khan-preview={preview ? clip : undefined}
    style={{ '--khan-preview-windup': `${previewWindup}ms` } as CSSProperties}>
    <div className="khan-strip" data-khan-clip={clip} style={{
      backgroundImage: `url("${url}")`,
      '--khan-frames': frames,
      '--khan-atlas-width': `${frames * 100}%`,
      '--khan-duration': `${preview && clip === 'charge' ? previewWindup : time}ms`,
    } as CSSProperties} />
  </div>;
}

export function GeneralKhanFigure({ size, action }: { size: HeroSize; action?: HeroAction | null }) {
  const phase = action?.khanAttackPhase;

  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.all(Object.values(clips).map(({ url }) => {
      const preloader = new Image();
      preloader.src = url;
      return preloader.decode();
    })).then(() => { if (active) setReady(true); }).catch(() => { /* Keep still art on failed loads. */ });
    return () => { active = false; };
  }, []);

  const activePhase = ready ? phase : undefined;
  const width = Math.min(BODY_WIDTH[size], BODY_HEIGHT * 1.5);
  const height = width / 1.5;
  return <g>
    <ProgressiveSvgImage href={idle} x={0} y={0} width={BODY_WIDTH[size]} height={BODY_HEIGHT}
      preserveAspectRatio="xMidYMax meet" className={activePhase ? 'khan-idle-during-attack' : undefined} />
    {activePhase && (
      <foreignObject key={activePhase} className="khan-sprite" x={(BODY_WIDTH[size] - width) / 2}
        y={BODY_HEIGHT - height} width={width} height={height}>
        {activePhase === 'signature-preview' ? <><Strip clip="charge" preview /><Strip clip="slam" preview /></> :
          <Strip clip={activePhase} />}
      </foreignObject>
    )}
  </g>;
}
