import type { CSSProperties } from 'react';
import type { HeroAction } from '../../../content/heroLooks';
import type { HeroSize } from '../../../../shared/game/types';
import { BODY_WIDTH } from '../../../lib/heroFigure';
import originalArt from '../../../assets/heroes/grandangel-raziel.webp';
import { ProgressiveSvgImage } from '../../ui/ProgressiveImage';
import './raziel-rig.css';

type Arm = {
  root: string;
  elbow: string;
  wrist: string;
  upper: string;
  upperFacet: string;
  lower: string;
  lowerFacet: string;
  hand: string;
};

// Left-hand silhouettes traced from the approved Raziel, in the original pose.
// Opposite sides share geometry but have offset timing and opposite facet light.
const ARMS: readonly Arm[] = [
  {
    root: '206px 217px', elbow: '128px 155px', wrist: '117px 70px',
    upper: '206,206 197,219 163,195 128,155 121,119 141,150 177,185',
    upperFacet: '128,155 141,150 177,185 206,206 197,219 164,193',
    lower: '128,155 114,71 119,68 140,150 150,164',
    lowerFacet: '128,155 114,71 128,127 140,150 150,164',
    hand: '113,75 119,58 124,37 130,23 144,10 137,21 129,34 133,40 139,28 152,21 146,30 138,39 136,49 143,39 152,34 144,43 137,51 133,61 126,64 120,75',
  },
  {
    root: '207px 216px', elbow: '111px 252px', wrist: '64px 189px',
    upper: '203,213 207,222 124,256 106,259 103,245 185,221',
    upperFacet: '106,259 121,246 205,216 207,222 126,256',
    lower: '106,259 61,191 64,184 116,237 123,247 121,257',
    lowerFacet: '106,259 61,191 109,239 119,245 121,257',
    hand: '66,193 55,185 43,177 34,169 28,146 34,153 42,168 41,154 46,144 44,158 48,169 59,174 59,162 53,156 52,150 62,159 70,176',
  },
  {
    root: '205px 267px', elbow: '145px 315px', wrist: '65px 308px',
    upper: '202,266 206,273 145,320 138,306 140,298 178,280',
    upperFacet: '139,308 181,285 205,271 206,275 145,320',
    lower: '145,320 65,311 62,305 141,297 145,307',
    lowerFacet: '65,311 128,308 145,307 145,320',
    hand: '69,304 61,301 54,296 35,293 42,299 50,301 41,307 20,306 16,311 35,312 25,317 15,319 35,320 51,316 68,311',
  },
  {
    root: '205px 323px', elbow: '123px 392px', wrist: '76px 444px',
    upper: '204,319 207,328 170,360 131,394 118,400 118,383 175,342',
    upperFacet: '118,383 136,376 204,319 207,328 130,395 118,400',
    lower: '119,383 132,392 78,445 72,443 81,428',
    lowerFacet: '81,428 118,382 124,391 78,445 72,443',
    hand: '79,437 77,446 84,455 86,477 79,462 75,457 71,469 73,482 77,493 70,485 65,472 64,465 62,474 65,495 60,482 57,472 59,460 63,452 68,446 69,438',
  },
];

type ArmStyle = CSSProperties & Record<'--rz-delay' | '--rz-lift' | '--rz-aim' | '--rz-draw', string>;

/** The original anchor stays fixed while each side and each arm moves at its own pace. */
const variable = (side: number, index: number, origin: string): ArmStyle => ({
  transformOrigin: origin,
  '--rz-delay': `${-index * 0.23 + (side > 0 ? 0.17 : -0.18)}s`,
  '--rz-lift': `${[6, -9, -8, 7][index]}deg`,
  '--rz-aim': `${[-5, 10, 9, -7][index]}deg`,
  '--rz-draw': `${[2, -5, -6, 6][index]}deg`,
});

function ArmLayer({ arm, index, side }: { arm: Arm; index: number; side: number }) {
  return (
    <g transform={side > 0 ? 'translate(433 0) scale(-1 1)' : undefined}>
      <g className="rz-shoulder" style={variable(side, index, arm.root)} data-rz-arm={`${side}:${index}`}>
        <polygon points={arm.upper} fill={side < 0 ? '#e4e5e4' : '#e8e8e8'} />
        <polygon points={arm.upperFacet} fill="#c9cdcd" />
        <g className="rz-elbow" style={variable(side, index, arm.elbow)}>
          <polygon points={arm.lower} fill="#f3f4f4" />
          <polygon points={arm.lowerFacet} fill="#d4d8d8" />
          <g className="rz-hand" style={variable(side, index, arm.wrist)}>
            <polygon points={arm.hand} fill="#f5f7f6" />
            <circle className="rz-spark" cx={Number(arm.wrist.split('px')[0])} cy={Number(arm.wrist.split('px')[1])} r="6" fill="#fff8ce" />
          </g>
        </g>
      </g>
    </g>
  );
}

function RazielBody() {
  return <>
    <path fill="#e0e3e3" d="M197 130 194 155l-15 14 7-17-8 6 9-14-6 3zm39 0 15 18-6-3 10 14-9-5 8 18-16-14z" />
    <path fill="#d7dada" d="M194 145l9 24-3 67-20-27 6 1-8-18 10 7-10-23 9 6zm45 0-9 24 3 67 19-27-5 1 8-18-10 7 10-23-9 6z" />
    <path fill="#f0f0f0" d="M216 140l20 43-5 40 5 96 17 145-9 36 6 47-23 96-11-170-12 170-22-97 6-50-10-33 18-144 5-97-4-41z" />
    <path fill="#d4d7d7" d="M197 181l19 13-9 76 9 10-1 65-11 48-12 83-10 70 22 97 12-173 0-125-20-22 5-99z" />
    <path fill="#e0e1e1" d="M236 182l-20 12 10 77-10 10 1 42 10 19 19 124-2 34 6 47-23 96-11-173 0-127 19-25-4-96z" />
    <path fill="#fafafa" d="M216 141l13 39-13 5-13-5z" />
    <path fill="#f9fafa" d="M216 118c10 0 11 12 6 19l-6 6-5-6c-6-8-5-19 5-19z" />
    <g className="rz-halo">
      <ellipse cx="216.5" cy="106" rx="19" ry="6" fill="none" stroke="#eff8f7" strokeWidth="3" />
      <ellipse className="rz-halo-light" cx="216.5" cy="106" rx="19" ry="6" fill="none" stroke="#fff5cd"
        strokeWidth="3.3" strokeLinecap="round" strokeDasharray="17 70" pathLength="87" />
    </g>
  </>;
}

export function RazielRigFigure({ size, action }: { size: HeroSize; action?: HeroAction | null }) {
  const width = size === 3 ? 94 : BODY_WIDTH[size];
  const height = width * 117 / 94;
  const pose = !action ? 'idle' : action.isSignature
    ? action.isCharging === true ? 'gather' : action.isCharging === false ? 'burst' : 'revelation'
    : action.style === 'support' ? 'seal' : 'word';
  if (size !== 3) return <ProgressiveSvgImage href={originalArt} x={0} y={97 - height} width={width} height={height} />;
  return (
    <g data-grandangel-raziel="" data-raziel-pose={pose} className="raziel-animated">
      <svg x={(BODY_WIDTH[size] - width) / 2} y={97 - height} width={width} height={height} viewBox="0 0 433 650" overflow="visible">
        <ProgressiveSvgImage className="rz-static" href={originalArt} width={433} height={650} />
        <g className="rz-float">
          {[-1, 1].flatMap((side) => ARMS.map((arm, index) => <ArmLayer key={`${side}:${index}`} arm={arm} side={side} index={index} />))}
          <RazielBody />
        </g>
      </svg>
    </g>
  );
}
