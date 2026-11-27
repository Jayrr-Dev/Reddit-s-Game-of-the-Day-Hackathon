import { useId, useMemo } from 'react';
import { hashSeed, nextFloat } from '../../../shared/game/rng';

import { ATLAS_REGIONS } from './AtlasRegions';
import { RegionalEngraving } from './RegionalEngraving';

export type AtlasMark = 'hold' | 'city' | 'village' | 'bridge' | 'depths' | 'forest' | 'peak' | 'road' | 'crossing';
export type AtlasPoint = { x: number; y: number };
export type AtlasLink = { from: AtlasPoint; to: AtlasPoint; state: 'open' | 'future' | 'past' };
export const ATLAS_WIDTH = 800;
export const ATLAS_HEIGHT = 900;
const COAST = 'M201-14 318-18 426 21 496 34 574 23 649 48 707 41 756 62 802 35 837 82 815 138 786 163 777 209 741 239 710 288 730 332 699 373 682 430 647 463 659 513 616 568 625 605 587 639 570 694 532 710 503 770 466 785 445 832 412 851 383 894 347 914 283 913 257 882 217 869 206 834 159 806 179 757 135 731 149 682 117 660 124 604 93 567 117 521 93 473 111 432 80 400 102 360 75 320 111 289 111 248 149 222 126 175 158 141 135 106 169 73 155 24Z';

export function landmarkOf(name: string, kind?: string): AtlasMark {
  if (kind === 'capital') return 'hold';
  if (kind === 'dragon' || /mountain|volcan|eyrie/i.test(name)) return 'peak';
  if (/bridge|aqueduct/i.test(name)) return 'bridge';
  if (kind === 'depths' || /dungeon|mine|cave|crypt|undercroft|ruin/i.test(name)) return 'depths';
  if (/grove|forest|wood|briar/i.test(name)) return 'forest';
  if (kind === 'city' || /city|ward|court|basilica|gates/i.test(name)) return 'city';
  return /village|town|hamlet|green|square/i.test(name) ? 'village' : 'road';
}

function House({x,y,scale=1}: {x:number;y:number;scale?:number}) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path fill="#f0d6a6" d="M3 10 14 2 26 10v16H3Z"/>
    <path fill="#b09161" d="M26 10 33 7 34 22 26 26Z"/>
    <path fill="#a95a43" d="M0 11 14 0 28 10 24 13 14 5 4 13Z"/>
    <path fill="#513a28" d="M12 26v-7q3-4 6 0v7Zm8-11v-2h2v2Z" strokeWidth=".8"/>
  </g>;
}
function Tower({x,y,tall=false}: {x:number;y:number;tall?:boolean}) {
  return <g transform={`translate(${x} ${y})`}>
    <path fill="#d9b887" d="M1 12h17v25H1Z"/><path fill="#ac8b58" d="M18 12l5-2v24l-5 3Z"/>
    {tall ? <><path fill="#9e503e" d="M0 13 10 0 20 13Z"/><path fill="none" d="M10 0v-9m0 1 10 2-10 2"/></>
      :<path fill="#f2d7a7" d="M0 14V6h4v4h4V6h4v4h4V6h4v8Z"/>}
    <path fill="#5e432a" d="M8 30v-6q2-3 4 0v6ZM7 19v-2h3v2Z" strokeWidth=".65"/>
  </g>;
}
const TREE = 'M0 0 6 8H3l5 6H2v5h-4v-5h-6l5-6h-3Z';
const PEAK = 'M-25 16-9-9-4-2 6-16 25 16 -1 11Z';
export function AtlasLandmark({mark}: {mark:AtlasMark}) {
  return <svg className="atlas-landmark" viewBox="0 0 88 64" aria-hidden="true"
    stroke="#523b2a" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round">
    <ellipse cx="44" cy="53" rx="35" ry="6" fill="#825f422e" stroke="none"/>
    {mark==='hold' ? <>
      <Tower x={33} y={12} tall/><Tower x={14} y={20}/><Tower x={54} y={20}/>
      <path fill="#e6c894" d="M21 37v-7h6v4h7v-4h6v4h7v-4h6v4h7v-4h6v23H21Z"/>
      <path fill="#6b4630" d="M38 53V44q6-10 12 0v9Z"/><House x={3} y={37} scale={.62}/><House x={66} y={37} scale={.59}/>
    </> : mark==='city' ? <>
      <Tower x={33} y={12} tall/><House x={12} y={28} scale={.9}/><House x={50} y={26} scale={.92}/><House x={35} y={37} scale={.68}/>
    </> : mark==='village' ? <>
      <House x={18} y={24} scale={.96}/><House x={42} y={32} scale={.77}/>
      <path fill="none" d="M13 53q7-4 16-3m33 3 10-1"/>
    </> : mark==='bridge' ? <>
      <path fill="#749491" stroke="none" d="M7 48q18-8 34 0t40-4v8q-20 11-40 5T7 56Z"/>
      <path fill="#d9ba88" d="M11 35q30-12 64 0l2 14H61q-2-13-10-13T39 49H26q-2-11-11-3l-2 3H9Z"/>
      <path fill="none" d="M10 35q31-16 66 0M11 40q30-15 66-1M20 38l1 5m47-6-1 5"/>
    </> : mark==='depths' ? <>
      <path fill="#9b8870" d="M7 52 20 33 26 34 40 17l9 6 8-4 18 24 6 8-29 3Z"/>
      <path fill="#48372e" d="M26 52q4-18 13-18t15 18Z"/>
      <path fill="none" d="m15 48 9-9m35-15 6 13m-41-1 14-16m19 22 10 4"/>
    </> : mark==='forest' ? <>
      <g fill="#8c9780">{[[25,26],[42,16],[58,25],[45,33]].map(([x,y])=><path key={x} d={TREE} transform={`translate(${x} ${y}) scale(1.26)`}/>)}</g>
      <path fill="none" d="M10 54q17-4 25 0m15 0 21-2"/>
    </> : mark==='peak' ? <>
      <path fill="#ab886d" d={PEAK} transform="translate(44 35) scale(1.25)"/>
      <path fill="#f1dcb2" d="M51 15l-10 17 10-4 6 5 3-3Z"/>
      <path fill="none" d="M51 31l12 17m-33-7 5-17m-16 28 11-9"/>
    </> : mark==='crossing' ? <>
      <path fill="#b5966b" d="M18 54h51l-3-8h-6V27q-2-15-17-15T26 27v19h-6Z"/>
      <path fill="#673a41" d="M34 46V28q2-9 9-9t10 9v18Z"/>
      <path stroke="#d99869" fill="none" d="m43 25-4 9 5 4-3 6"/>
    </> : <>
      <path stroke="#aa805d" strokeWidth="5" fill="none" d="M9 51q21-7 24-4t17-2q11-4 28-2"/>
      <path fill="#ad8d5e" d="M41 14h4v36h-4Zm-15 6h35l7 6-7 6H26Z"/>
      <path stroke="#60442e" fill="none" d="M33 26h22m27 24-7 2m-54 0-6 4"/>
    </>}
  </svg>;
}

/** The coastline is the region's silhouette; ink details are seeded, not tiled. */
function geography(seed: string, terrain: (typeof ATLAS_REGIONS)[number]['terrain']) {
  let state=hashSeed(seed);
  const take=()=>{ const [value,next]=nextFloat(state); state=next; return value; };
  const stamps=(centers: readonly (readonly [number,number])[], count: number, radius: number) =>
    centers.flatMap(([cx,cy])=>Array.from({length:count},()=>{
      const angle=take()*Math.PI*2, r=Math.sqrt(take())*radius;
      return {x:cx+Math.cos(angle)*r,y:cy+Math.sin(angle)*r*.66,s:.54+take()*.67};
    })).sort((a,b)=>a.y-b.y);
  const rugged = terrain === 'glacier' || terrain === 'summit' || terrain === 'twins' || terrain === 'badlands';
  const dry = terrain === 'dunes' || terrain === 'badlands';
  const mountains=stamps([[182,151],[631,190],[600,286],[176,427],[586,530],[171,640],[510,772]],rugged ? 9 : dry ? 3 : 5,rugged ? 80 : 63);
  const trees=stamps([[152,257],[607,385],[201,546],[535,678],[257,814],[409,373]],terrain === 'woods' ? 26 : rugged || dry ? 3 : 13,terrain === 'woods' ? 90 : 62);
  const wash = take()*55-26;
  return {mountains,trees,wash};
}
export function AtlasInk({seed,links,selected,regionIndex}: {seed:string;regionIndex:number;links:readonly AtlasLink[]; selected?:AtlasPoint | undefined}) {
  const uid=useId();
  const theme = ATLAS_REGIONS[regionIndex] ?? ATLAS_REGIONS[0]!;
  const { terrain, ink, accent, land, sea } = theme;
  const {mountains,trees,wash}=useMemo(()=>geography(seed,terrain),[seed,terrain]);
  const snow = terrain === 'glacier' || terrain === 'summit';
  const dry = terrain === 'dunes' || terrain === 'badlands';
  const celestial = terrain === 'stars' || terrain === 'twins';
  const mountainShape = terrain === 'badlands' ? 'M-28 16-19 5-9 3-7-12 11-12 16 4 28 16 8 14Z'
    : terrain === 'dunes' ? 'M-28 16Q-7 12 6-6Q13 5 26 16Z' : PEAK;
  return <svg className="conquest-map-ink" viewBox={`0 0 ${ATLAS_WIDTH} ${ATLAS_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <clipPath id={uid+'-coast'}><path d={COAST}/></clipPath>
      <radialGradient id={uid+'-land'}><stop stopColor={land[0]}/><stop offset="1" stopColor={land[1]}/></radialGradient>
      <pattern id={uid+'-waves'} width="57" height="38" patternUnits="userSpaceOnUse">
        <path d="M6 14q6-4 12 0t12 0m7 15q5-3 11 0" fill="none" stroke={accent} strokeOpacity=".55"/>
      </pattern>
      <filter id={uid+'-paper'} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".64" numOctaves="3" seed="28"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
    </defs>
    <rect width="800" height="900" fill={sea}/>
    <rect width="800" height="900" fill={`url(#${uid}-waves)`}/>
    <path d={COAST} fill="none" stroke={land[0]} strokeWidth="12" opacity=".64"/>
    <path d={COAST} fill={`url(#${uid}-land)`} stroke={ink} strokeWidth="2.5"/>
    <g clipPath={`url(#${uid}-coast)`}>
      <path d={`M100 700Q260 ${458+wash} 800 590M85 498Q390 ${288+wash} 756 349M145 260Q338 120 755 182`}
        fill="none" stroke={ink} strokeWidth="63" opacity=".096"/>
      <g stroke={snow ? "#52849c" : dry ? "#905544" : "#567f75"} fill="none" strokeLinecap="round">
        <path d={`M690 209C540 242 597 339 451 350S332 ${506+wash} 230 518 129 478 79 522M627 590Q566 568 498 654T323 732 173 725`}
          strokeWidth="4.5" opacity=".66"/>
        <path d="M425 359q-49-38-79-103m-34 222q29 35 24 70m153 119q-19-42-66-49" strokeWidth="1.75" opacity=".6"/>
      </g>
      <g stroke={ink} strokeWidth="1.35" strokeLinejoin="round" opacity=".67">
        {mountains.map((p,i)=><g key={i} transform={`translate(${p.x} ${p.y}) scale(${p.s})`}>
          <path d={mountainShape} fill={land[1]}/>{!dry && <path d="M6-16-4-2-9-9-25 16-12 12 4-8 7 0 12 4Z" fill={snow ? "#f9ffff" : accent}/>}
          <path d="m-2 6-8 7m23-9 8 9" fill="none"/>
        </g>)}
      </g>
      <g fill={snow ? "#8096a0" : terrain === "woods" ? "#648664" : land[1]} stroke={ink} strokeWidth="1.15" opacity=".64">
        {trees.map((p,i)=><path key={i} d={TREE} transform={`translate(${p.x} ${p.y}) scale(${p.s})`}/>)}
      </g>
      {snow && <path d="M129 350q43 5 76-56t34-107m338 157q-48-11-65 28m-364 290q43-35 39-87m327 148 48-97" stroke={accent} strokeWidth="5" fill="none" opacity=".72"/>}
      {celestial && <path d="M117 275q276-210 599 27m-582 89q89-62 192-41m21 368q120 11 275-128" stroke={accent} strokeDasharray="1 13" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".82"/>}
      {dry && <path d="M144 287q82-23 154-1m-105 143q96-44 172-13m-145 225q121-59 212-25m55-254q77-39 177-14" stroke={ink} strokeDasharray="21 6 9 5" fill="none" opacity=".43"/>}
    </g>
    <RegionalEngraving theme={theme} />
    <g stroke="#63503a" fill="none" transform="translate(706 704)" opacity=".69">
      <circle r="23"/><circle r="17"/><path fill="#c59a68" d="M0-33 6-6 33 0 6 6 0 33-6 6-33 0-6-6Z"/><path d="M0-32v64m-32-32h64"/>
      <text y="-39" textAnchor="middle" fill="#63503a" stroke="none" fontFamily="Georgia" fontSize="13">N</text>
    </g>
    <rect width="800" height="900" filter={`url(#${uid}-paper)`} opacity=".14" style={{mixBlendMode:'multiply'}}/>
    {links.map(({from,to,state},i)=>{
      const dy=(to.y-from.y)*.56;
      const focus= state==='open' && selected?.x===to.x && selected.y===to.y;
      return <path key={i} d={`M${from.x} ${from.y} C${from.x} ${from.y+dy} ${to.x} ${to.y-dy} ${to.x} ${to.y}`}
        className="atlas-branch" data-state={state} data-selected={focus || undefined} vectorEffect="non-scaling-stroke"/>;
    })}
  </svg>;
}
