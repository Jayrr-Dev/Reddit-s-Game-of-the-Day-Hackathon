import { ATLAS_REGIONS } from './AtlasRegions';

type Theme = typeof ATLAS_REGIONS[number];

/** Marginal illustrations distinguish the angels without adding selectable nodes. */
export function RegionalEngraving({ theme }: { theme: Theme }) {
  const { terrain, ink, accent } = theme;
  const sun = terrain === 'eclipse' || terrain === 'dunes' || terrain === 'twins';
  return <g transform="translate(671 452)" stroke={ink} strokeWidth="2" fill="none" opacity=".85" strokeLinejoin="round">
    <circle r="44" strokeWidth="1" strokeDasharray="1 3" />
    {sun && <>
      <circle cx={terrain === 'twins' ? -13 : 0} cy="-8" r="21" fill={accent}/>
      {terrain === 'twins' ? <><circle cx="11" cy="-5" r="18" fill="#8095b6"/><circle cx="-16" cy="-9" r="15" fill="#a85c58"/></> :
        terrain === 'eclipse' ? <circle cx="7" cy="-13" r="16" fill={ink}/> :
        <path d="M0-40v7m32 26h7m-78 0h7m8-26 5 6m43-6-5 6"/>}
      <path d="M-32 28q17-15 30-6t34-6M-28 35q17-12 32-6t25-4"/>
    </>}
    {terrain === 'glacier' && <><path fill={accent} d="m-33 22 10-28 10-6 8-17 11 12 9-6 18 45-27 11Z"/><path d="m-13-12 2 20-8 13m25-38 1 21-12 11m12-11 17 11"/></>}
    {terrain === 'woods' && <><path d="M-27 29-14 10h-8l12-17h-7L0-31 17-7h-7l12 17h-8l13 19Z" fill={accent}/><path d="M-15 33V19l15-7 15 7v14L0 27Zm15-21v15"/></>}
    {terrain === 'sanctum' && <><path d="M-29 26h58m-49-4V3l7-13 7 13v19m0 0V-9L0-28 6-9v31m0 0V3l7-13 7 13v19" fill={accent}/><path d="M-30 30h60M0 8v14"/></>}
    {terrain === 'badlands' && <><path d="m-32 20 10-12 10 1 3-16h19l4 12 8-3 12 15v9h-66Z" fill={accent}/><path d="M-9-7v-16h5v4h6v-4h7v16M-27 18h12m28-7h11"/></>}
    {terrain === 'stars' && <><path d="m-27 18 12-26 14 9 20-23 9 37-29-14-8 30"/>{[[-27,18],[-15,-8],[-1,1],[19,-22],[28,15],[-9,31]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="3.5" fill={accent}/>)}</>}
    {terrain === 'summit' && <><path d="M-34 24 0-31l35 55Z" fill={accent}/><path d="m-15-4 9 3 6-7 8 7 6-4m-25 27V10a11 11 0 0 1 22 0v12Z"/><path d="M-38 29q7-8 16 0t16 0m13 6q6-5 11 0t17-1"/></>}
  </g>;
}
