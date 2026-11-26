import { useId } from 'react';
import seraphArt from '../../../assets/heroes/apollyon-seraph.webp';
import './ApollyonSeraphFigure.css';

const WIDTH = 1536;
const HEIGHT = 1024;
type Point = readonly [number, number];

interface Pair {
  name: 'upper' | 'middle' | 'lower';
  pivot: Point;
  outline: Point[];
}

// Coordinates follow the approved Watcher art. Wing roots overlap under the center eye.
const wings: Pair[] = [
  {
    name: 'upper',
    pivot: [694, 477],
    outline: [[279,17],[360,146],[231,107],[320,232],[369,249],[252,243],[344,321],
      [416,336],[324,359],[420,401],[480,385],[436,423],[513,434],[530,465],
      [614,470],[637,502],[670,493],[724,478],[727,465],[691,389],[659,371],
      [629,324],[638,273],[538,180]],
  },
  {
    name: 'middle',
    pivot: [687, 544],
    outline: [[69,554],[321,478],[424,446],[465,456],[498,501],[575,480],[648,515],
      [705,530],[717,556],[690,596],[643,618],[633,596],[588,641],[584,610],
      [522,656],[523,627],[453,694],[473,612],[406,719],[393,694],[277,772],
      [306,666],[206,721],[233,663],[176,687],[207,630],[101,642],[166,579]],
  },
  {
    name: 'lower',
    pivot: [697, 604],
    outline: [[729,578],[716,637],[691,670],[724,742],[705,791],[689,840],[673,791],
      [672,855],[606,939],[604,901],[486,1003],[514,925],[429,954],[451,856],
      [383,902],[471,733],[577,671],[649,612]],
  },
];
const core = '768,431 827,469 861,477 899,524 894,553 850,562 821,596 806,601 768,642 731,601 715,594 684,565 641,553 637,523 674,477 708,469';

export const ApollyonSeraph = () => {
  const id = useId();
  return (
    <g data-apollyon-seraph="" transform="translate(7 10) scale(.0885)">
      <defs>
        <image id={id + '-art'} href={seraphArt} width={WIDTH} height={HEIGHT} />
        <clipPath id={id + '-eye'} clipPathUnits="userSpaceOnUse">
          <polygon points={core} />
        </clipPath>
        {wings.flatMap(({ name, outline }) =>
          [false, true].map(right => {
            const suffix = right ? '-right' : '-left';
            const points = outline.map(([x, y]) => (right ? WIDTH - x : x) + ',' + y).join(' ');
            return (
              <clipPath key={name + suffix} id={id + name + suffix} clipPathUnits="userSpaceOnUse">
                <polygon points={points} />
              </clipPath>
            );
          }),
        )}
      </defs>
      <g className="apollyon-seraph-feathers">
        {wings.flatMap(({ name, pivot: [x, y] }) =>
          [false, true].map(right => {
            const suffix = right ? '-right' : '-left';
            return (
              <g key={name + suffix} data-apollyon-wing={name + suffix}
                className={'apollyon-seraph-wing apollyon-seraph-wing--' + name + ' apollyon-seraph-wing-' + (right ? 'right' : 'left')}
                style={{ transformOrigin: (right ? WIDTH - x : x) + 'px ' + y + 'px' }}>
                <use href={'#' + id + '-art'} clipPath={'url(#' + id + name + suffix + ')'} />
              </g>
            );
          }),
        )}
        <use data-apollyon-eye="" href={'#' + id + '-art'} clipPath={'url(#' + id + '-eye)'} />
      </g>
    </g>
  );
};
