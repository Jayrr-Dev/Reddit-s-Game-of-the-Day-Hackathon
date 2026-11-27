import { useId } from 'react';
import './sinLairMotion.css';

type Point = readonly [x: number, y: number, size: number];
const LIGHTS: Record<string, readonly Point[]> = {
  Pride: [[71,224,22],[789,248,23],[922,286,20]],
  Greed: [[460,141,25],[894,58,29],[270,215,12],[392,325,9]],
  Lust: [[418,290,25],[490,286,12],[786,292,25],[228,268,9]],
  Gluttony: [[432,225,25],[934,217,28],[525,268,15],[858,318,13],[926,389,16],[390,273,14],[898,255,17]],
};

/** Spatially graded vectors: wing tips move while the shoulders stay registered. */
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="370" height="193" viewBox="125 0 370 193"><defs><radialGradient id="l"><stop stop-color="#83e880"/><stop offset=".43" stop-color="#81c280"/><stop offset="1" stop-color="#808080"/></radialGradient><radialGradient id="r"><stop stop-color="#7de880"/><stop offset=".43" stop-color="#7fc280"/><stop offset="1" stop-color="#808080"/></radialGradient></defs><rect x="125" width="370" height="193" fill="#808080"/><ellipse cx="196" cy="46" rx="74" ry="110" fill="url(#l)"/><ellipse cx="427" cy="48" rx="71" ry="108" fill="url(#r)"/></svg>';
const WING_VECTORS = 'data:image/svg+xml,' + encodeURIComponent(svg);

export function SinLairMotion({ host, art }: { host: string; art: string }) {
  const id = useId();
  const pride = host === 'Pride';
  const lust = host === 'Lust';
  const lights = LIGHTS[host] ?? [];
  return <div className="sin-lair-motion" aria-hidden="true">
    <svg className="sin-motion-plane" viewBox="0 0 960 540" focusable="false">
      <defs>
        <image id={id+'-art'} href={art} width="960" height="540" />
        <clipPath id={id+'-wings'}><path d="M130 0H270V190H130ZM351 0H495V190H351Z"/></clipPath>
        <filter id={id+'-flap'} filterUnits="userSpaceOnUse" x="125" y="0" width="370" height="193" colorInterpolationFilters="sRGB">
          <feImage href={WING_VECTORS} x="125" y="0" width="370" height="193" result="wind"/>
          <feDisplacementMap in="SourceGraphic" in2="wind" scale="0" xChannelSelector="R" yChannelSelector="G">
            <animate attributeName="scale" values="0;11;0;-5;0" keyTimes="0;.26;.55;.8;1" dur="6.2s" repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .6 1;.4 0 .6 1;.4 0 .6 1;.4 0 .6 1"/>
          </feDisplacementMap>
        </filter>
        <clipPath id={id+'-sky'}><path d={pride ? 'M625 0H775L798 99L794 222L619 249L615 111ZM815 0H864L896 84L873 151L827 194L827 87Z' : 'M143 1H272L303 72L264 173L119 210L118 124Z'}/></clipPath>
        <radialGradient id={id+'-cloud'}><stop stopColor={pride ? '#fcb591' : '#dfa0b2'} stopOpacity=".32"/><stop offset="1" stopColor="#fbb6ac" stopOpacity="0"/></radialGradient>
        <radialGradient id={id+'-glow'}><stop stopColor="#ffe09d" stopOpacity=".84"/><stop offset=".25" stopColor="#fcb356" stopOpacity=".30"/><stop offset="1" stopColor="#e75931" stopOpacity="0"/></radialGradient>
      </defs>
      <use href={'#'+id+'-art'} />
      {pride && <g className="sin-motion-wings" data-sin-layer="pinned-wings" clipPath={'url(#'+id+'-wings)'}>
        <use href={'#'+id+'-art'} filter={'url(#'+id+'-flap)'}/>
      </g>}
      {(pride || lust) && <g clipPath={'url(#'+id+'-sky)'} data-sin-layer="drifting-clouds">
        <g className="sin-motion-clouds" fill={'url(#'+id+'-cloud)'}>
          <ellipse cx={pride ? 697 : 185} cy={pride ? 173 : 93} rx="103" ry="12" transform={pride ? 'rotate(-17 697 173)' : 'rotate(-8 185 93)'}/>
          <ellipse cx={pride ? 811 : 245} cy={pride ? 104 : 120} rx="99" ry="9" transform={pride ? 'rotate(-14 811 104)' : 'rotate(-5 245 120)'}/>
          <ellipse cx={pride ? 744 : 152} cy={pride ? 219 : 70} rx="95" ry="15" />
        </g>
      </g>}
      {!!lights.length && <g data-sin-layer="candlelight" fill={'url(#'+id+'-glow)'}>
        {lights.map(([x,y,size], i) => <circle className="sin-motion-flame" key={x} cx={x} cy={y} r={size} style={{animationDelay: -i*.57+'s', animationDuration: 2.15+i%3*.53+'s'}}/>)}
      </g>}
    </svg>
  </div>;
}
