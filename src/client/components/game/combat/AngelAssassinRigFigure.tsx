import { useId } from 'react';
import type { HeroSize } from '../../../../shared/game/types';
import art from '../../../assets/heroes/angel-assassin.webp';
import { useProgressiveImage } from '../../../hooks/useProgressiveImage';
import { BODY_HEIGHT, BODY_WIDTH } from '../../../lib/heroFigure';
import './angel-assassin-rig.css';

const ART_WIDTH = 488;
const ART_HEIGHT = 650;
const LEFT = '0,0 141,0 169,128 205,163 210,176 195,189 185,204 175,218 156,241 130,264 0,270';
const RIGHT = '488,0 347,0 316,128 284,160 278,174 293,189 305,205 315,219 345,243 373,267 488,270';
const wings = [
  { key: 'left', shape: LEFT, hinge: '194px 186px' },
  { key: 'right', shape: RIGHT, hinge: '293px 185px' },
] as const;

/** Reuses the approved painting exactly and pins each clipped wing under the shoulder. */
export function AngelAssassinRigFigure({ size }: { size: HeroSize }) {
  const id = useId();
  const { src } = useProgressiveImage(art);
  const url = (part: string) => 'url(#' + id + '-' + part + ')';

  return <svg width={BODY_WIDTH[size]} height={BODY_HEIGHT} viewBox={'0 0 ' + ART_WIDTH + ' ' + ART_HEIGHT}
    preserveAspectRatio="xMidYMax meet" overflow="visible" data-angel-assassin-rig="" className="angel-hover">
    <defs>
      <image id={id + '-paint'} href={src} width={ART_WIDTH} height={ART_HEIGHT} preserveAspectRatio="none" />
      {wings.map((wing) => <clipPath key={wing.key} id={id + '-' + wing.key}><polygon points={wing.shape} /></clipPath>)}
      <mask id={id + '-body'} maskUnits="userSpaceOnUse" x="0" y="0" width={ART_WIDTH} height={ART_HEIGHT}>
        <rect width={ART_WIDTH} height={ART_HEIGHT} fill="white" />
        {wings.map((wing) => <polygon key={wing.key} points={wing.shape} fill="black" />)}
      </mask>
    </defs>
    {wings.map(({ key, hinge }) => <g key={key} data-assassin-wing={key} style={{ transformOrigin: hinge }}>
      <use href={'#' + id + '-paint'} clipPath={url(key)} />
    </g>)}
    <use href={'#' + id + '-paint'} mask={url('body')} />
  </svg>;
}
