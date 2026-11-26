import { useId, type ReactNode } from 'react';
import type { HeroAction } from '../../../content/heroLooks';
import type { HeroSize } from '../../../../shared/game/types';
import { BODY_HEIGHT, BODY_WIDTH } from '../../../lib/heroFigure';
import prideArt from '../../../assets/heroes/pride.webp';
import slothArt from '../../../assets/heroes/sloth.webp';
import envyArt from '../../../assets/heroes/envy.webp';
import { ProgressiveSvgImage } from '../../ui/ProgressiveImage';
import './sin-boss-motion.css';

type BossProps = { size: HeroSize; action?: HeroAction | null | undefined };
type Sin = 'pride' | 'sloth' | 'envy';
const ART = {
  pride: { src: prideArt, w: 397, h: 480, inset: 2 },
  sloth: { src: slothArt, w: 960, h: 640, inset: 10 },
  envy: { src: envyArt, w: 850, h: 543, inset: 10 },
};
/** Signature motion follows the existing combat charge/release, never the other way around. */
const poseFor = (action: BossProps['action']) =>
  !action ? 'idle' : action.isSignature
  ? action.isCharging === true ? 'charge' : action.isCharging === false ? 'strike' : 'signature'
  : action.style === 'support' ? 'guard' : 'attack';

function Stage({ sin, size, action, children }: BossProps & { sin: Sin; children: ReactNode }) {
  const art = ART[sin];
  return (
    <svg x={0} y={art.inset / 2} width={BODY_WIDTH[size]} height={BODY_HEIGHT - art.inset}
      viewBox={`0 0 ${art.w} ${art.h}`} preserveAspectRatio="xMidYMax meet" overflow="visible"
      data-sin-motion={sin} data-sin-pose={poseFor(action)} className={size === 3 ? 'sin-boss-live' : undefined}>
      {children}
    </svg>
  );
}

/** Move the visible wing panels about their roots without moving the body or feet. */
export function PrideMotionFigure(props: BossProps) {
  const id = useId();
  const { src, w, h } = ART.pride;
  if (props.size !== 3) return <Stage sin="pride" {...props}><ProgressiveSvgImage href={src} width={w} height={h} /></Stage>;
  const left = 'M0 0H162V109L168 132 147 149 128 174 115 192 114 261H0Z';
  const right = 'M397 0H240V106L232 131 248 152 263 184 277 212 279 261H397Z';
  return (
    <Stage sin="pride" {...props}>
      <defs>
        <clipPath id={`${id}-left`}><path d={left} /></clipPath>
        <clipPath id={`${id}-right`}><path d={right} /></clipPath>
        <mask id={`${id}-body`} x={0} y={0} width={w} height={h} maskUnits="userSpaceOnUse">
          <rect width={w} height={h} fill="white" /><path d={left} fill="black" /><path d={right} fill="black" />
        </mask>
      </defs>
      <g className="sin-pride-still"><ProgressiveSvgImage href={src} width={w} height={h} /></g>
      <g className="sin-pride-layers">
        <path fill="#372239" d="M131 144l27-11 16 20-15 13-20-2-10 18zM266 144l-27-11-16 20 15 13 20-2 10 18z" />
        <g className="sin-pride-wing left"><g clipPath={`url(#${id}-left)`}><ProgressiveSvgImage href={src} width={w} height={h} /></g></g>
        <g className="sin-pride-wing right"><g clipPath={`url(#${id}-right)`}><ProgressiveSvgImage href={src} width={w} height={h} /></g></g>
        <g mask={`url(#${id}-body)`}><ProgressiveSvgImage href={src} width={w} height={h} /></g>
      </g>
    </Stage>
  );
}

/** Sloth braces before a slam; moving shoulder feathers would break the weight of stone. */
export function SlothMotionFigure(props: BossProps) {
  const { src, w, h } = ART.sloth;
  return <Stage sin="sloth" {...props}>
    <g className="sin-sloth-body"><ProgressiveSvgImage href={src} width={w} height={h} /></g>
    <g className="sin-sloth-impact" fill="none" stroke="#ec986d" strokeLinecap="round">
      <path d="m469 596-43 21-103 4-44 14m209-39 42 23 97 5 47 13m-187-32 1 24" strokeWidth="9" />
      <path d="m469 596-43 21-103 4-44 14m209-39 42 23 97 5 47 13m-187-32 1 24" stroke="#ffcc9e" strokeWidth="3" />
      <path d="m282 590 22-33 19 11-8 21zm352 4 8-32 23-13 13 20-25 26z" fill="#32252a" strokeWidth="3" />
    </g>
  </Stage>;
}

/** The original faceted slime stretches from its floor contact, never floating off it. */
export function EnvyMotionFigure(props: BossProps) {
  const { src, w, h } = ART.envy;
  return <Stage sin="envy" {...props}>
    <g className="sin-envy-body"><ProgressiveSvgImage href={src} width={w} height={h} /></g>
    <g className="sin-envy-splash" fill="#bce775" stroke="#527751" strokeWidth="3">
      <path d="m330 435-27-32 1 26 19 25zm206-10 31-30-5 27-17 16zm-282 55-37-18 11 26 22 9zm337 0 34-24-13 28-20 11z" />
    </g>
  </Stage>;
}
