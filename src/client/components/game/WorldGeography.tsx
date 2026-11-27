// --- WORLD GEOGRAPHY ---
// Map features and the interactive region pins share these coordinates.
export const WORLD_PLACES = [
  [178, 421], [431, 437], [617, 391], [665, 259], [413, 270],
  [176, 239], [216, 124], [444, 155], [619, 88],
] as const;

const COAST = 'M135 76Q164 63 181 72L213 63 232 72Q250 85 272 70L304 61 327 74Q345 87 364 69L395 49 418 51 435 39 465 44 486 29 520 43 548 37 574 47 605 31 632 42 646 58 674 59 689 76 718 84 725 106 709 122 719 144 706 161 721 181 708 202 720 219 704 241 721 259 711 285 729 301 707 322 716 346 691 365 705 382 687 401 696 413 674 433 647 434 631 451 591 449 572 469 548 472 529 493 501 483 469 499 446 478 427 479 406 492 375 480 344 481 321 461 286 472 261 461 231 475 212 461 189 462 169 446 150 456 131 447 103 457 81 438 77 417 58 407 74 386 61 368 80 349 83 324 103 313 88 294 98 271 83 248 112 226 105 196 118 180 107 151 121 135 114 113 129 98Z';
const ROUTES = [
  'M178 421C252 414 263 389 305 401S367 437 431 437',
  'M431 437C499 445 510 413 553 410S586 406 617 391',
  'M617 391C646 366 644 332 628 308S646 274 665 259',
  'M665 259C611 242 587 274 547 279S476 253 413 270',
  'M413 270C366 285 325 242 286 249S215 263 176 239',
  'M176 239C149 211 182 196 185 168S196 137 216 124',
  'M216 124C283 117 302 158 358 169S407 156 444 155',
  'M444 155C491 151 507 121 552 113S589 99 619 88',
];
const RIVERS = [
  'M398 345Q377 358 346 331T298 313Q265 315 250 340T198 367Q142 367 109 415',
  'M331 278Q314 300 298 313',
  'M570 320Q594 317 618 333T663 349L721 333',
  'M605 278Q596 302 618 333',
  'M616 127Q603 159 573 174T552 211Q587 226 616 215T715 205',
  'M657 161Q629 175 606 175T552 211',
  'M418 195Q407 211 377 213T319 210Q281 194 245 206T105 196',
];
const TERRAIN = [
  [141, 133, 'dune', .82], [165, 114, 'dune', .66], [244, 96, 'dune', 1.36], [277, 105, 'dune', .97],
  [215, 183, 'dune', .75], [243, 171, 'dune', .82], [283, 144, 'dune', .76],
  [130, 225, 'hill', .86], [167, 217, 'hill', 1.02], [222, 222, 'peak', .78], [249, 228, 'peak', 1.15],
  [119, 284, 'hill', .92], [140, 307, 'hill', .8], [177, 295, 'hill', 1.02], [201, 323, 'hill', .76],
  [106, 381, 'hill', .78], [141, 397, 'hill', .89], [210, 400, 'hill', .88], [241, 430, 'hill', .67],
  [259, 359, 'mesa', .9], [282, 327, 'mesa', .85], [322, 352, 'mesa', .9], [350, 323, 'mesa', 1.1],
  [376, 324, 'mesa', .78], [468, 309, 'mesa', .82], [500, 308, 'mesa', .92], [526, 319, 'mesa', .72],
  [314, 120, 'peak', .89], [340, 106, 'peak', 1.32], [367, 130, 'peak', 1.07], [386, 108, 'peak', 1.18],
  [414, 124, 'peak', .98], [419, 91, 'peak', 1.35], [450, 89, 'peak', 1.09], [479, 114, 'peak', .96],
  [503, 81, 'ice', 1.05], [527, 91, 'ice', 1.13], [551, 72, 'ice', 1.01], [580, 89, 'ice', 1.39],
  [654, 102, 'ice', 1.37], [676, 115, 'ice', 1.04], [695, 130, 'ice', .8],
  [479, 208, 'hill', .77], [503, 211, 'hill', .72], [527, 196, 'hill', .84], [555, 230, 'hill', .77],
  [601, 238, 'hill', .72], [678, 229, 'hill', .77], [693, 302, 'hill', .82],
  [348, 405, 'ice', .96], [373, 394, 'ice', 1.05], [399, 411, 'ice', .95], [437, 403, 'ice', 1.14],
  [469, 397, 'ice', 1.22], [492, 416, 'ice', .87], [479, 465, 'ice', .84],
] as const;
const GROVES = [[548,353,13],[570,380,9],[620,364,12],[646,415,8],[667,389,10],[601,430,8],[243,291,8],[226,376,7],[546,249,7],[652,196,7]] as const;

/** Engraved coastline, terrain, rivers and the winding conquest road. */
export function WorldGeography({ current }: { current: number }) {
  return <svg className="world-atlas-ink" viewBox="0 0 800 520" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <clipPath id="world-coast-fit"><path d={COAST}/></clipPath>
      <linearGradient id="world-paper" x2="0" y2="1"><stop stopColor="#efddb7"/><stop offset=".52" stopColor="#e2c69a"/><stop offset="1" stopColor="#c49665"/></linearGradient>
      <radialGradient id="world-sea"><stop stopColor="#79938d"/><stop offset="1" stopColor="#415c5a"/></radialGradient>
      <radialGradient id="world-ice"><stop stopColor="#dce8dc"/><stop offset="1" stopColor="#bcc9c6" stopOpacity="0"/></radialGradient>
      <radialGradient id="world-wood"><stop stopColor="#829670" stopOpacity=".86"/><stop offset="1" stopColor="#85966d" stopOpacity="0"/></radialGradient>
      <radialGradient id="world-dune"><stop stopColor="#d79957" stopOpacity=".85"/><stop offset="1" stopColor="#d79957" stopOpacity="0"/></radialGradient>
      <radialGradient id="world-rock"><stop stopColor="#9d899a" stopOpacity=".85"/><stop offset="1" stopColor="#9d899a" stopOpacity="0"/></radialGradient>
      <pattern id="world-paper-lines" patternUnits="userSpaceOnUse" width="14" height="12">
        <path d="M0 2l14 3m-6 4 3 1M1 10l4 1" stroke="#744d31" strokeWidth=".46" opacity=".17"/>
      </pattern>
      <pattern id="world-sea-lines" patternUnits="userSpaceOnUse" width="43" height="31">
        <path d="M2 8h21m5 0h7m-12 14h17M1 26h7" stroke="#e8d6a8" strokeWidth=".65" opacity=".27"/>
      </pattern>
      <g id="world-peak" strokeWidth="1.3" strokeLinejoin="round">
        <path d="M-23 10 -10 -8 -6 -6 3 -22 22 10 10 9 4 13 -2 8Z" fill="currentColor"/><path d="M3-22 8-3l6 8 8 5-12-1-6 4 1-11-8-11Z" fill="#695460" opacity=".6"/><path d="m-16 3 6-11 4 2m1 13L3-22" fill="none"/>
      </g>
      <g id="world-icepeak" strokeWidth="1.3" strokeLinejoin="round">
        <path d="M-24 12-10-6-6-5 3-24 24 12 12 10 6 15-2 10Z" fill="#c6d5cd"/><path d="M3-24 12-8 7-10 4-4 1-10-5-8Z" fill="#f0ecda"/><path d="M3-24 6 0l8 10 10 2-12-2-6 5 1-10-8-10Z" fill="#7e979c" opacity=".64"/>
      </g>
      <g id="world-dunes" strokeWidth="1.3" fill="none" strokeLinecap="round">
        <path d="M-23 7Q-12 5-4-5T17 1L24 5M-31 13Q-15 11-6 6T18 8M-5 14Q8 9 26 14"/>
      </g>
      <g id="world-hill" strokeWidth="1.25" fill="none" strokeLinecap="round">
        <path d="M-21 6Q-11-10 0 0 13-12 23 7M-16 10Q-8 3-4 5m18 1 5 4M-10 13h17"/>
      </g>
      <g id="world-mesa" strokeWidth="1.25" strokeLinejoin="round">
        <path d="M-23 9-13 5-10-9 8-11 11 1 22 9 12 12-5 10-12 13Z" fill="#ae7962"/><path d="m8-11-3 14 7 9 10-3-11-8Z" fill="#856457"/><path d="M-18 8-5 7 0-8m1 18 7-1" fill="none"/>
      </g>
      <g id="world-tree" strokeWidth=".9"><path d="M0-8 -5 1 -2 1 -6 6 6 6 2 1 5 1Z" fill="#6f8666"/><path d="M0-6V9" fill="none"/></g>
    </defs>
    <rect width="800" height="520" fill="url(#world-sea)"/>
    <rect width="800" height="520" fill="url(#world-sea-lines)"/>
    <path d={COAST} fill="none" stroke="#d8cba4" strokeWidth="25" strokeLinejoin="round" opacity=".26"/>
    <path d={COAST} fill="none" stroke="#ebd3a9" strokeWidth="13" strokeLinejoin="round" opacity=".63"/>
    <path d={COAST} fill="url(#world-paper)" stroke="#513a2e" strokeWidth="2.5" strokeLinejoin="round"/>
    <g clipPath="url(#world-coast-fit)">
      <ellipse cx="535" cy="95" rx="218" ry="120" fill="url(#world-rock)"/>
      <ellipse cx="621" cy="72" rx="143" ry="108" fill="url(#world-ice)"/>
      <ellipse cx="429" cy="427" rx="153" ry="96" fill="url(#world-ice)"/>
      <ellipse cx="241" cy="129" rx="145" ry="95" fill="url(#world-dune)"/>
      <ellipse cx="633" cy="383" rx="154" ry="112" fill="url(#world-wood)"/>
      <ellipse cx="174" cy="321" rx="113" ry="124" fill="url(#world-wood)" opacity=".57"/>
      <rect width="800" height="520" fill="url(#world-paper-lines)"/>
      <path d={COAST} fill="none" stroke="#9b724e" strokeWidth="13" strokeLinejoin="round" opacity=".46"/>
      <path d={COAST} fill="none" stroke="#f1d9aa" strokeWidth="8" strokeLinejoin="round" opacity=".58"/>
      <g fill="none" stroke="#806c58" strokeWidth="1" opacity=".43">
        <path d="M294 113q46-46 113-42t140 1 122-9m-362 85q39-27 78-20t88 18 81-12m-265 248q61-28 109-18t116 17m-232 16q71-24 123-13t93 12m26-84q34-36 67-40m-533-15q50-41 88-15m-74 166q25-18 57-29m245-9q47 7 64 38m-17 9q-40-5-63 12"/>
        <path d="M108 352q30-18 67-19m125-188q16 27 2 47m342 103q32 21 59 19m-289-20q52-7 83 9m-111-57q55-34 112-2m-254 195q25 17 63 11" strokeDasharray="2 4"/>
      </g>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {RIVERS.map((d,i) => <path key={d} d={d} stroke="#f0dbb1" strokeWidth={i % 3 === 0 ? 6 : 4}/>)}
        {RIVERS.map((d,i) => <path key={d} d={d} stroke="#557975" strokeWidth={i % 3 === 0 ? 3.1 : 2.1}/>)}
      </g>
      <g stroke="#66554b" color="#a4989a">
        {TERRAIN.map(([x,y,kind,scale]) => <use key={x+':'+y} href={'#world-'+(kind === 'ice' ? 'icepeak' : kind === 'dune' ? 'dunes' : kind)} transform={`translate(${x} ${y}) scale(${scale})`}/>)}
      </g>
      <g stroke="#475c49">
        {GROVES.flatMap(([x,y,count]) => Array.from({ length: count }, (_,i) =>
          <use key={x+':'+i} href="#world-tree" transform={`translate(${x+((i*31)%49)-24} ${y+((i*13)%32)-16}) scale(${.72+(i%4)*.14})`}/>))}
      </g>
    </g>
    <path d="M742 168l13-6 13 8-3 15-20 8-10-8Z M57 173l15-8 12 8-6 12-16 4-10-6Z M724 429l18-12 12 4-3 16-20 9-11-10Z" fill="#cbb18b" stroke="#e4cda1" strokeWidth="2.5"/>
    {ROUTES.map(d=><path key={d} d={d} fill="none" stroke="#eddbb8" strokeWidth="5.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity=".8"/>)}
    {ROUTES.map((d,i)=><path key={d} d={d} fill="none" stroke={i < current ? '#934331' : '#644632'} strokeWidth="1.9" strokeDasharray={i < current ? undefined : '4 4'} strokeLinecap="round" vectorEffect="non-scaling-stroke"/>)}
    <rect x="5" y="5" width="790" height="510" rx="5" fill="none" stroke="#e0c798" opacity=".55"/>
  </svg>;
}
