import { useId, type CSSProperties } from 'react';
import type { HeroSize } from '../../../../shared/game/types';
import type { HeroAction } from '../../../content/heroLooks';
import { useProgressiveImage } from '../../../hooks/useProgressiveImage';
import { BODY_WIDTH } from '../../../lib/heroFigure';
import staff from '../../../assets/heroes/cerviel-staff.webp';
import swords from '../../../assets/cerviel/Villain-Run-Cerviel-Sword-Grips.webp';
import openHands from '../../../assets/cerviel/Villain-Run-Cerviel-Open-Hands.webp';
import closedFists from '../../../assets/cerviel/Villain-Run-Cerviel-Closed-Fists.webp';
import bow from '../../../assets/heroes/cerviel-bow.webp';
import { ArcherSprite } from './ArcherSprite';
import './cerviel-rig.css';

type Form = 'staff' | 'sword' | 'bow';
type Point = readonly [number, number];
type Layer = { name: string; mask: string; root: Point; side: -1 | 1; row: 0 | 1 | 2 };

/** Art coordinates, approximately half the native image resolution. */
const VIEW_W = 598;
const VIEW_H = 658;
const HALO = '207,83 220,48 278,17 346,9 380,14 389,43 358,62 304,86 243,102 212,99';
// The pointed ivory breastplate is static; its tip sits over the robe's hinge.
const ROBE = '223,285 260,257 271,261 298,308 327,256 346,258 373,291 403,344 475,425 540,492 540,658 54,658 49,493 132,429 198,346';

const shoulder = (name: string, mask: string, root: Point, side: -1 | 1, row: 0 | 1 | 2): Layer =>
  ({ name, mask, root, side, row });

const PALMS = [
  shoulder('upper-left', '136,26 213,25 212,92 248,115 258,148 240,177 165,177 140,159 134,151', [235, 146], -1, 0),
  shoulder('upper-right', '387,26 476,26 476,155 432,179 358,177 343,153 351,123 385,95', [359, 147], 1, 0),
  shoulder('middle-left', '69,178 138,172 177,197 223,172 244,165 253,189 229,231 198,250 192,251 125,246 68,229', [233, 186], -1, 1),
  shoulder('middle-right', '351,165 378,174 420,200 477,159 547,149 548,226 440,257 400,252 368,224 348,187', [365, 187], 1, 1),
  shoulder('lower-left', '243,225 269,243 251,270 223,289 194,337 197,415 183,432 129,429 127,336 189,248', [250, 254], -1, 2),
  shoulder('lower-right', '345,225 330,249 346,271 377,282 403,329 406,419 441,430 476,428 478,336 410,246', [351, 253], 1, 2),
] as const;

const BLADE_ARMS = [
  shoulder('upper-left', '57,0 184,0 219,103 244,118 257,150 243,184 151,190 124,150 121,108', [237, 157], -1, 0),
  shoulder('upper-right', '414,0 529,0 475,110 471,157 440,189 352,185 342,153 354,122 396,110', [354, 156], 1, 0),
  shoulder('middle-left', '7,183 105,179 153,189 185,214 223,188 241,173 252,199 229,230 188,267 146,269 103,243 5,210', [234, 192], -1, 1),
  shoulder('middle-right', '355,172 392,209 421,219 474,191 589,176 590,205 487,247 439,268 392,265 370,237 344,198', [362, 190], 1, 1),
  shoulder('lower-left', '242,229 270,244 252,274 225,303 185,350 172,372 57,483 41,473 104,363 128,335 184,281 198,252', [249, 258], -1, 2),
  shoulder('lower-right', '346,230 325,245 347,272 386,302 415,347 428,377 537,479 559,479 506,387 460,338 414,280 395,252', [351, 258], 1, 2),
] as const;

const STAFF_ARMS = PALMS.map(({ name, mask, root, side, row }) =>
  name === 'middle-left'
    // The crystal, staff, and gripping fingers move as one layer.
    ? shoulder(name, '73,21 134,21 136,155 141,188 173,200 230,168 244,167 254,192 224,227 191,248 151,248 139,238 134,435 80,431', root, side, row)
    : shoulder(name, mask, root, side, row));

const BOW_ARMS = PALMS.map(({ name, mask, root, side, row }) =>
  name === 'middle-left'
    // Bow, string, arrow and hand are pinned together until authored release.
    ? shoulder(name, '10,45 125,45 129,133 162,166 228,177 249,189 255,223 207,235 190,255 140,301 135,319 128,397 5,397', root, side, row)
    : name === 'middle-right'
      ? shoulder(name, '345,167 387,171 451,194 460,227 447,252 397,244 348,235 329,224 330,209', root, side, row)
      : shoulder(name, mask, root, side, row));

const positions = (form: Form, action?: HeroAction | null) => {
  if (form === 'staff') return { art: staff, arms: STAFF_ARMS };
  if (form === 'bow') return { art: bow, arms: BOW_ARMS };
  if (action?.style === 'magic') return { art: openHands, arms: PALMS };
  if (action?.style === 'support') return { art: closedFists, arms: PALMS };
  return { art: swords, arms: BLADE_ARMS };
};

type Props = { form: Form; size: HeroSize; action?: HeroAction | null | undefined };

export function CervielRigFigure({ form, size, action }: Props) {
  const id = useId();
  const { art, arms } = positions(form, action);
  const { src } = useProgressiveImage(art);
  const localId = (part: string) => id + '-' + part;
  const fragment = (part: string) => '#' + localId(part);
  const resource = (part: string) => 'url(' + fragment(part) + ')';
  const width = form === 'bow' ? 87 : 104;
  const height = width * 1316 / 1195;
  const x = (BODY_WIDTH[size] - width) / 2;
  const y = 97 - height;
  const isShot = form === 'bow' && action?.style === 'range';
  const layers = [...arms.map((arm) => ({ name: arm.name, mask: arm.mask })), { name: 'halo', mask: HALO }, { name: 'robe', mask: ROBE }];
  const pose = action?.style ?? 'idle';

  return <g data-cerviel-form={form} data-cerviel-rig="" data-cerviel-pose={pose} data-cerviel-charging={action?.isCharging ? '' : undefined}>
    {isShot ? (
      <foreignObject x={x} y={y} width={width} height={height} pointerEvents="none">
        <div className="relative size-full">
          <ArcherSprite heroId="cervielBow" action={action} />
        </div>
      </foreignObject>
    ) : (
      <svg x={x} y={y} width={width} height={height} overflow="visible" viewBox={'0 0 ' + VIEW_W + ' ' + VIEW_H}>
        <defs>
          <image id={localId('art')} href={src} width={VIEW_W} height={VIEW_H} preserveAspectRatio="none" />
          {layers.map((layer) => <clipPath id={localId(layer.name)} key={layer.name}>
            <polygon points={layer.mask} />
          </clipPath>)}
          <mask id={localId('body')} x="0" y="0" width={VIEW_W} height={VIEW_H} maskUnits="userSpaceOnUse">
            <rect width={VIEW_W} height={VIEW_H} fill="white" />
            {layers.map((layer) => <polygon key={layer.name} points={layer.mask} fill="black" />)}
          </mask>
          <mask id={localId('cloth-cut')} x="0" y="0" width={VIEW_W} height={VIEW_H} maskUnits="userSpaceOnUse">
            <polygon points={ROBE} fill="white" />
            {arms.map((arm) => <polygon key={arm.name} points={arm.mask} fill="black" />)}
          </mask>
          <radialGradient id={localId('pulse')}>
            <stop stopColor="#fff2c7" stopOpacity=".9" />
            <stop offset=".45" stopColor="#e3b7f1" stopOpacity=".66" />
            <stop offset="1" stopColor="#8b59b9" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="cerviel-rig-robe" style={{ transformOrigin: '300px 280px' }}>
          <use href={fragment('art')} mask={resource('cloth-cut')} />
        </g>
        {[...arms].reverse().map(({ name, root, side, row }) => (
          <g key={name} className="cerviel-rig-arm"
            data-cerviel-arm={name} data-cerviel-arm-row={row}
            style={{ '--cerviel-side': side, '--cerviel-arm-delay': row * 28 + 'ms',
              transformOrigin: root[0] + 'px ' + root[1] + 'px' } as CSSProperties}>
            <use href={fragment('art')} clipPath={resource(name)} />
          </g>
        ))}
        <use href={fragment('art')} mask={resource('body')} />
        <g className="cerviel-rig-halo" style={{ transformOrigin: '301px 55px' }}>
          <use href={fragment('art')} clipPath={resource('halo')} />
        </g>
        <circle className="cerviel-rig-pulse" cx={form === 'sword' ? 299 : 300} cy={form === 'sword' ? 194 : 191}
          r={66} fill={resource('pulse')} />
      </svg>
    )}
  </g>;
}
