import { useId } from 'react';
import { SinHostIdle } from './SinHostIdle';
import './sinLairMotion.css';

type Point = readonly [x: number, y: number, size: number];
const LIGHTS: Record<string, readonly Point[]> = {
  Pride: [[71,224,22],[789,248,23],[922,286,20]],
  Greed: [[460,141,25],[894,58,29],[270,215,12],[392,325,9]],
  Lust: [[418,290,25],[490,286,12],[786,292,25],[228,268,9]],
  Gluttony: [[432,225,25],[934,217,28],[525,268,15],[858,318,13],[926,389,16],[390,273,14],[898,255,17]],
};

export function SinLairMotion({ host, art }: { host: string; art: string }) {
  const id = useId();
  const pride = host === 'Pride';
  const lust = host === 'Lust';
  const lights = LIGHTS[host] ?? [];
  return <div className="sin-lair-motion" aria-hidden="true">
    <svg className="sin-motion-plane" viewBox="0 0 960 540" focusable="false">
      <defs>
        <image id={id+'-art'} href={art} width="960" height="540" />
        <clipPath id={id+'-sky'}><path d={pride ? 'M625 0H775L798 99L794 222L619 249L615 111ZM815 0H864L896 84L873 151L827 194L827 87Z' : 'M143 1H272L303 72L264 173L119 210L118 124Z'}/></clipPath>
        <radialGradient id={id+'-cloud'}><stop stopColor={pride ? '#fcb591' : '#dfa0b2'} stopOpacity=".32"/><stop offset="1" stopColor="#fbb6ac" stopOpacity="0"/></radialGradient>
        <radialGradient id={id+'-glow'}><stop stopColor="#ffe09d" stopOpacity=".84"/><stop offset=".25" stopColor="#fcb356" stopOpacity=".30"/><stop offset="1" stopColor="#e75931" stopOpacity="0"/></radialGradient>
      </defs>
      <use href={'#'+id+'-art'} />
      <SinHostIdle id={id+'-host'} host={host} artRef={'#'+id+'-art'} />
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
