/** Each soft vector pins the edge of a moving part to the original room. */
type Vector = readonly [x: number, y: number, rx: number, ry: number, dx: number, dy: number];
type IdleMotion = {
  bounds: readonly [x: number, y: number, width: number, height: number];
  vectors: readonly Vector[];
  seconds: number;
  poses: string;
};
const IDLES: Record<string, IdleMotion> = {
  Pride: {
    bounds: [125, 0, 370, 200], seconds: 6.2, poses: '0;13;0;-6;0',
    vectors: [[196, 49, 73, 103, 5, 97], [427, 49, 71, 106, -5, 97]],
  },
  Greed: {
    bounds: [564, 65, 307, 252], seconds: 5.4, poses: '0;12;0;-8;0',
    vectors: [[750, 186, 57, 43, 18, 97], [810, 209, 53, 49, 92, -12], [621, 256, 43, 43, -84, -15]],
  },
  Envy: {
    bounds: [64, 13, 466, 301], seconds: 4.7, poses: '0;20;0;-14;0',
    vectors: [[356, 78, 46, 63, 78, 41], [398, 147, 39, 60, -91, -36], [279, 203, 94, 60, 25, 76], [136, 260, 60, 29, -78, 47]],
  },
  Lust: {
    bounds: [525, 74, 245, 275], seconds: 7.2, poses: '0;14;0;-9;0',
    vectors: [[575, 167, 41, 69, -78, 23], [668, 186, 43, 61, 88, 31], [706, 308, 53, 33, 88, 7], [575, 319, 48, 28, -79, 11]],
  },
  Gluttony: {
    bounds: [477, 4, 447, 377], seconds: 5.8, poses: '0;18;0;-14;0',
    vectors: [[558, 129, 70, 59, 55, 69], [699, 67, 69, 58, 84, -17], [824, 78, 65, 57, -84, 58], [864, 167, 57, 68, -67, 34],
      [514, 239, 36, 45, -71, -46], [529, 312, 45, 40, 40, -70], [742, 331, 47, 44, -55, 78], [696, 190, 37, 32, 0, 36]],
  },
  Sloth: {
    bounds: [244, 5, 510, 278], seconds: 8.1, poses: '0;12;0;-7;0',
    vectors: [[413, 120, 68, 69, -24, 74], [596, 69, 92, 53, 31, 80], [538, 140, 54, 59, 10, 60], [676, 166, 47, 55, 36, 32]],
  },
};

const NEUTRAL = 128;
const cubic = '.4 0 .6 1';

/** Data URI sampled by the SVG filter, not a second or altered piece of artwork. */
function vectorTexture({ bounds: [x, y, w, h], vectors }: IdleMotion) {
  const gradients = vectors.map(([, , , , dx, dy], i) => `<radialGradient id="v${i}"><stop stop-color="rgb(${NEUTRAL+dx},${NEUTRAL+dy},128)"/><stop offset=".35" stop-color="rgb(${Math.round(NEUTRAL+dx*.63)},${Math.round(NEUTRAL+dy*.63)},128)" stop-opacity=".94"/><stop offset="1" stop-color="#808080" stop-opacity="0"/></radialGradient>`).join('');
  const fields = vectors.map(([cx, cy, rx, ry], i) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#v${i})"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><defs>${gradients}</defs><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#808080"/>${fields}</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

const TEXTURES = new Map(Object.values(IDLES).map(idle => [idle, vectorTexture(idle)]));

/** Redraws only the registered idle patch; the still original remains underneath. */
export function SinHostIdle({ id, host, artRef }: { id: string; host: string; artRef: string }) {
  const idle = IDLES[host];
  if (!idle) return null;
  const [x, y, width, height] = idle.bounds;
  return <g className="sin-motion-host" data-sin-layer="host-idle" data-sin-host={host}>
    <defs>
      <filter id={id} filterUnits="userSpaceOnUse" x={x} y={y} width={width} height={height} colorInterpolationFilters="sRGB">
        <feImage href={TEXTURES.get(idle)} x={x} y={y} width={width} height={height} result="vectors" />
        <feDisplacementMap in="SourceGraphic" in2="vectors" scale="0" xChannelSelector="R" yChannelSelector="G">
          <animate attributeName="scale" values={idle.poses} keyTimes="0;.27;.54;.75;1" dur={idle.seconds+'s'}
            repeatCount="indefinite" calcMode="spline" keySplines={Array(4).fill(cubic).join(';')} />
        </feDisplacementMap>
      </filter>
      <radialGradient id={id+'-ember'}>
        <stop stopColor="#ff9623" stopOpacity=".63" /><stop offset=".53" stopColor="#f55719" stopOpacity=".27" />
        <stop offset="1" stopColor="#f55719" stopOpacity="0" />
      </radialGradient>
    </defs>
    <use href={artRef} filter={'url(#'+id+')'} />
    {host === 'Gluttony' && <ellipse className="sin-motion-eye" cx="697" cy="190" rx="36" ry="33" fill={'url(#'+id+'-ember)'} />}
  </g>;
}
