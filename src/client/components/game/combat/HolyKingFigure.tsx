// --- HOLY KING FIGURE ---
import type { HeroFigureProps } from './HeroFigure';

const LIGHT = '#eee3cd';
const IVORY = '#d2c1a8';
const STEEL = '#aa9785';
const SHADOW = '#806e66';
const WHITE = '#fff5e6';
const PURPLE = '#78598c';
const PLUM = '#51365f';
const DARK = '#35263f';
const GOLD = '#d8ac50';
const BRONZE = '#997039';
const INK = '#312329';
const SKIN = '#d3aa88';
const SKIN_SHADE = '#ac7f64';

type Point = readonly [number, number];

/** Keeps the right-facing shadow facets symmetrical. */
const Facets = ({ left, lit, shade }: { left: readonly Point[]; lit: string; shade: string }) => (
  <>
    <polygon points={left.map(([x,y]) => x + ',' + y).join(' ')} fill={lit} />
    <polygon points={left.map(([x,y]) => (150-x) + ',' + y).join(' ')} fill={shade} />
  </>
);

/** A tall crowned boss, with a fixed hilt anchor and a separately animated sword. */
export const HolyKingFigure = ({ action, mood = 'calm' }: Pick<HeroFigureProps, 'action' | 'mood'>) => (
  <svg viewBox="0 0 150 100" className="h-full w-full overflow-visible" aria-hidden="true"
    data-action={action?.style} data-swing={action?.style === 'melee' ? action.swing : undefined}>
    <g transform="translate(0 -17.46) scale(1 1.18)">
      <Facets left={[[75,24],[59,25],[43,32],[37,61],[32,95],[48,98],[75,95]]} lit={PLUM} shade={DARK} />
      <Facets left={[[62,31],[49,37],[40,90],[49,95],[65,85],[68,50]]} lit={PURPLE} shade={PLUM} />
      <Facets left={[[60,65],[73,68],[73,78],[71,89],[72,95],[68,97],[52,97],[53,92],[54,82],[54,75]]} lit={IVORY} shade={STEEL} />
      <Facets left={[[55,75],[59,71],[67,70],[73,76],[70,83],[63,86],[56,82]]} lit={LIGHT} shade={IVORY} />
      <Facets left={[[56,86],[62,88],[67,86],[68,92],[64,95],[54,95],[55,90]]} lit={WHITE} shade={IVORY} />
      <Facets left={[[75,56],[65,57],[59,76],[70,71],[75,83]]} lit={PURPLE} shade={PLUM} />
      <Facets left={[[65,57],[60,72],[69,69],[75,78],[75,82],[68,72],[58,77]]} lit={GOLD} shade={BRONZE} />
      <Facets left={[[75,27],[58,28],[49,34],[51,43],[58,52],[62,58],[75,64]]} lit={IVORY} shade={STEEL} />
      <Facets left={[[75,30],[62,30],[55,35],[54,39],[59,44],[68,47],[75,47]]} lit={LIGHT} shade={IVORY} />
      <Facets left={[[75,48],[62,46],[56,43],[57,50],[63,55],[75,57]]} lit={STEEL} shade={SHADOW} />
      <Facets left={[[53,32],[46,37],[45,44],[48,50],[56,51],[60,44],[59,36]]} lit={STEEL} shade={SHADOW} />
      <g aria-hidden="true">
        {[false, true].map(right => (
          <g key={String(right)} transform={right ? 'translate(150 0) scale(-1 1)' : undefined}>
            <path d="M64 35 C65 28 60 22 52 22 C44 22 37 27 35 35 L33 39 Q41 46 53 44 Q61 42 64 35Z" fill={right ? STEEL : IVORY} stroke={right ? BRONZE : GOLD} strokeWidth="1.7" />
            <path d="M35 37 41 28Q47 24 54 24L59 28 53 33 45 36 38 41Z" fill={right ? IVORY : LIGHT} />
            <path d="M38 39 Q50 40 61 30 M41 42 Q53 42 61 34" fill="none" stroke={right ? BRONZE : GOLD} strokeWidth="1" />
            <path d="M42 36 46 30 53 27 M46 38 51 33 57 29" fill="none" stroke={right ? STEEL : WHITE} strokeWidth=".7" />
            <circle cx="54" cy="41" r="1.4" fill={right ? IVORY : WHITE} />
          </g>
        ))}
      </g>
      <Facets left={[[67,24],[62,26],[60,29],[70,34],[75,34],[75,28]]} lit={WHITE} shade={IVORY} />
      <polygon points="75,30 78.4,32 78.4,35.6 75,38 71.6,35.6 71.6,32" fill={GOLD} />
      <polygon points="75,32 77,34 75,36 73,34" fill={BRONZE} />
      <Facets left={[[75,13],[67,13],[67,21],[69,25],[75,29]]} lit={SKIN} shade={SKIN_SHADE} />
      <Facets left={[[67,20],[68,23],[70,24],[71,23],[75,22.5],[75,31],[71,29.5],[68,26]]} lit={WHITE} shade={IVORY} />
      <Facets left={[[75,23],[72,24],[69.2,24.1],[70.8,27.3],[73,28],[75,30],[74,25.5]]} lit={LIGHT} shade={STEEL} />
      <path d="M72 25.1 75 24.7 78 25.1" fill="none" stroke={INK} strokeWidth=".65" />
      <path d={mood === 'fierce' ? 'M68.8 17.7 73.5 19.2 M81.2 17.7 76.5 19.2' : 'M68.8 18.1 73.4 18.6 M81.2 18.1 76.6 18.6'}
        fill="none" stroke={STEEL} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M70 20h2.2m5.6 0H80M75 18.7l-1 3.3 2.1-.1" fill="none" stroke={INK}
        strokeWidth=".65" strokeLinecap="round" />
      <polygon data-holy-king-crown="" points="66,14 64.5,7 66.8,7.7 68,10 69.1,4.8 71.3,5.9 72.3,9.2 73.6,3 75,1.6 76.5,3 77.7,9.2 78.7,5.9 80.9,4.8 82,10 83.2,7.7 85.5,7 84,14 75,15.3" fill={GOLD} />
      <polygon points="75,1.6 76.5,3 77.7,9.2 78.7,5.9 80.9,4.8 82,10 83.2,7.7 85.5,7 84,14 75,15.3" fill={BRONZE} />
      <path d="M66 14 75 15.3 84 14" fill="none" stroke={WHITE} strokeWidth="1" />
      <polygon points="75,9 77,11.7 75,13.4 73,11.7" fill={PURPLE} />
      <Facets left={[[50,42],[46,47],[48,53],[55,55],[68,55],[73,51],[67,47],[57,46],[56,42]]} lit={LIGHT} shade={IVORY} />
      <Facets left={[[49,48],[53,45],[59,47],[64,53],[56,54],[50,52]]} lit={IVORY} shade={STEEL} />
      <g className="hero-prop" style={{ transformOrigin: '75px 51px' }}>
        <path d="M75 47v10" fill="none" stroke={BRONZE} strokeWidth="2.9" strokeLinecap="round" />
        <polygon points="63,57 67,54 75,56 83,54 87,57 84,60 78,58.5 75,62 72,58.5 66,60" fill={GOLD} />
        <polygon points="72,60 75,62 78,60 77.6,90 75,98 72.4,90" fill={LIGHT} />
        <polygon points="75,62 78,60 77.6,90 75,98" fill={IVORY} />
        <path d="M75 65v22" fill="none" stroke={WHITE} strokeWidth=".6" />
      </g>
      <polygon points="67,46 71,45 76,48 76,52 72,54 67,52" fill={LIGHT} />
      <polygon points="76,48 81,47 84,50 82,54 77,55 73,52" fill={IVORY} />
      <path d="M70 47 74 49.3m-5 0L73 52m6-3.4L77 51m4.5-1.4L79 53" fill="none" stroke={STEEL} strokeWidth=".9" strokeLinecap="round" />
    </g>
  </svg>
);

