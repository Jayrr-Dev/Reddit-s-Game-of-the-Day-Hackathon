import type { RingOffer } from '../../../../shared/game/ringShop';

const metal = {
  'cinder-band': ['#db9864', '#6b3729', '#f3bc83'],
  'tideglass-ring': ['#bdd2d9', '#437080', '#7effdf'],
  'rook-signet': ['#acadb9', '#505163', '#efd49e'],
  'briar-knot': ['#b8c08b', '#53634b', '#cfff9f'],
  'quarry-ring': ['#9d9eae', '#555360', '#cfc5ce'],
  'moonstone-loop': ['#d6deef', '#6f76a3', '#bbc5ff'],
  'bellfounder-band': ['#d6a95a', '#745039', '#ffdf98'],
  'ashwood-ring': ['#b4977b', '#644338', '#dfbc9c'],
  'gatewarden-seal': ['#e9be61', '#79512c', '#f4d892'],
  'gilt-serpent': ['#f3d575', '#8f4c25', '#ff6b78'],
  'ferryman-token': ['#c5a07c', '#594033', '#78d4c8'],
  'vesper-locket': ['#e3b4be', '#745479', '#f8aef0'],
  'last-lantern': ['#ebc777', '#795335', '#ffef8b'],
} satisfies Record<RingOffer['id'], readonly [string, string, string]>;

/** A faceted item illustration with a material palette unique to its listing. */
export function ShopJewelryArt({ offer }: { offer: Pick<RingOffer, 'id' | 'slot'> }) {
  const [light, shadow, stone] = metal[offer.id];
  const flat = offer.id === 'rook-signet' || offer.id === 'gatewarden-seal';
  const simple = offer.id === 'cinder-band' || offer.id === 'quarry-ring' || offer.id === 'ashwood-ring' || offer.id === 'bellfounder-band';
  return <svg className="shop-item-art" viewBox="0 0 64 64" aria-hidden="true" fill="none">
    <ellipse cx="32" cy="51" rx="21" ry="5" fill="#100a15" opacity=".5" />
    {offer.slot === 'amulet' ? <>
      <path d="M12 11Q19 26 31 30Q45 25 52 11" stroke={shadow} strokeWidth="4" strokeLinecap="round" />
      <path d="M12 10Q19 25 31 29Q45 24 52 10" stroke={light} strokeWidth="2" strokeDasharray="2 1" strokeLinecap="round" />
      <circle cx="32" cy="29" r="3.5" stroke={light} strokeWidth="2" />
      {offer.id === 'last-lantern' ? <>
        <path d="m32 30 11 9-3 16H24l-3-16Z" fill={shadow} stroke={light} strokeWidth="2" />
        <path d="M27 40h10v10H27z" fill={stone} />
        <path d="M32 40v10m-8-12h16" stroke={shadow} />
      </> : <>
        <path d={offer.id === 'ferryman-token' ? 'M32 32a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z' : 'M32 32Q45 34 42 44Q40 49 32 54Q24 49 22 44Q19 34 32 32Z'} fill={shadow} stroke={light} strokeWidth="2.3" />
        <path d="m32 36 5 6-5 6-5-6Z" fill={stone} />
        <path d="m32 36-5 6h10" stroke="#fff4d8" opacity=".75" />
      </>}
    </> : <g transform="rotate(-21 32 34)">
      <path d="M32 16c13 0 22 8 22 18S45 51 32 51 10 43 10 34s9-18 22-18Zm0 7c-9 0-15 5-15 11s6 10 15 10 15-4 15-10-6-11-15-11Z" fill={shadow} fillRule="evenodd" />
      <path d="M32 13c13 0 22 8 22 18s-9 18-22 18S10 41 10 31s9-18 22-18Zm0 6c-9 0-15 5-15 12s6 12 15 12 15-5 15-12-6-12-15-12Z" fill={light} fillRule="evenodd" />
      <path d="M12 30c2-10 11-14 20-14m-4 31c10 2 19-3 22-8" stroke={stone} strokeWidth="1.5" strokeLinecap="round" />
      {simple ? <path d="M13 34q3 11 15 13" stroke={stone} strokeWidth="2" opacity=".8" />
        : flat ? <>
          <path d="m23 12 5-5h13l4 7-4 8H26l-4-4Z" fill={shadow} stroke={light} strokeWidth="2" />
          <path d="M29 17v-5h3v2h3v-2h3v5Z" fill={stone} />
        </> : <>
          <path d="m23 13 5-7h10l6 7-10 10Z" fill={stone} stroke={light} strokeWidth="2" strokeLinejoin="round" />
          <path d="m23 13 11-2 10 2m-10-2v12" stroke={shadow} opacity=".75" />
          <path d="m28 7 6 4 4-4" stroke="#fff4d8" opacity=".9" />
        </>}
    </g>}
  </svg>;
}
