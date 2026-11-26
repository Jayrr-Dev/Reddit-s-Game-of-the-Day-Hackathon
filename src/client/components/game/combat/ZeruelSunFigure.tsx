import { useId } from 'react';
import { polar, type Point } from '../../../lib/creatureArt';

const PALETTES = {
  red: { white: '#fff8d5', light: '#ffbd62', mid: '#ff572f', dark: '#92183c', edge: '#ff894d' },
  blue: { white: '#edffff', light: '#98ebff', mid: '#397bff', dark: '#2d248f', edge: '#64c8ff' },
} as const;
const CENTER: Point = [30, 63];
const RAYS = Array.from({ length: 12 }, (_, i) => {
  const angle = i * 30 - 90;
  const start = polar(CENTER, 23, angle - 12);
  const bend = polar(CENTER, 33, angle - 10);
  const tip = polar(CENTER, i % 3 === 0 ? 39 : 34, angle + 6);
  const curl = polar(CENTER, 29, angle + 3);
  const end = polar(CENTER, 22, angle + 13);
  return `M${start} Q${bend} ${tip} Q${curl} ${end}Z`;
});

export function ZeruelSunFigure({ color }: { color: keyof typeof PALETTES }) {
  const id = useId();
  const c = PALETTES[color];
  const core = `${id}-core`;
  const glow = `${id}-glow`;
  const corona = `${id}-corona`;
  return (
    <g data-zeruel-sun={color} className="angel-hover zeruel-sun">
      <defs>
        <radialGradient id={glow}>
          <stop stopColor={c.light} stopOpacity=".8" />
          <stop offset=".6" stopColor={c.mid} stopOpacity=".4" />
          <stop offset="1" stopColor={c.mid} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={core} cx="36%" cy="31%" r="69%">
          <stop stopColor={c.white} />
          <stop offset=".42" stopColor={c.light} />
          <stop offset=".82" stopColor={c.mid} />
          <stop offset="1" stopColor={c.dark} />
        </radialGradient>
        <radialGradient id={corona} gradientUnits="userSpaceOnUse" cx="30" cy="63" r="39">
          <stop offset=".45" stopColor={c.light} />
          <stop offset=".78" stopColor={c.mid} />
          <stop offset="1" stopColor={c.edge} />
        </radialGradient>
      </defs>
      <circle cx="30" cy="63" r="43" fill={`url(#${glow})`} />
      <g fill={`url(#${corona})`}>
        {RAYS.map(d => <path key={d} d={d} />)}
      </g>
      <circle cx="30" cy="63" r="24" fill={`url(#${core})`} stroke={c.edge} strokeWidth="1.6" />
      <g fill="none" strokeLinecap="round">
        <path d="M11 60c6-9 11 1 18-7 5-5 10-6 18-3M15 77c7 6 9-5 17-4 6 1 13 5 17-5M19 47c1 3 5 6 9 4" stroke={c.dark} strokeOpacity=".4" strokeWidth="1.6" />
        <path d="M13 61c7-6 11 0 18-7 5-5 8-5 13-4M18 78c6 1 9-5 15-4 7 1 11 3 15-4" stroke={c.white} strokeOpacity=".64" />
        <path d="M11 64a19 19 0 0 1 15-21" stroke={c.white} strokeOpacity=".82" strokeWidth="1.25" />
      </g>
    </g>
  );
}
