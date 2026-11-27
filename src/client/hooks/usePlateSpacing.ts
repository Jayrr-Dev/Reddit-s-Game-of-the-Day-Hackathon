import { useLayoutEffect, useRef, type RefObject } from 'react';
import { isAnchored, rowDepth } from '../../shared/game/battlefield';
import { prefersReducedMotion } from '../lib/motion';
import type { HeroUnit } from '../../shared/game/types';
import { isBoss } from '../content/heroLooks';
import { rowPerspective } from '../components/game/combat/rowPerspective';
import { chooseReliefOffsets, laneReliefPoints, type FieldBox as Box } from '../../shared/game/fieldRelief';

export const PLATE_UID_ATTR = 'data-plate-uid';
export const FLOATING_UID_ATTR = 'data-floating-uid';
export const HERO_LAYOUT_ATTR = 'data-hero-layout';
const GAP = 3;
const HEALTH_GAP = 11;
const HEALTH_FLOOR_PADDING = 12;
/**
 * LAYOUT TOLERANCE (px): how far a measure must move before the spacing
 * is solved again. The side-step gait bobs and tilts the sprites while
 * they walk, which nudges their boxes by a pixel or two every frame;
 * re-solving on that noise flipped the chosen spots back and forth, and
 * the heroes shook instead of settling.
 */
const RELAYOUT_TOLERANCE = 3;

/** True when any measure moved past RELAYOUT_TOLERANCE (or the set changed). */
const hasMoved = (previous: readonly number[], next: readonly number[]): boolean =>
  previous.length !== next.length ||
  next.some((value, i) => Math.abs(value - previous[i]!) > RELAYOUT_TOLERANCE);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

type Placement = { shift: number; lift: number; labelOffset: number };
type PlacementMotion = Placement & { at: number };

/**
 * REPOSITION WALK PACE: how heroes walk to a new spot when the field
 * re-spaces them. EASE_MS is the ease-out time constant (larger is a
 * softer approach); WALK_SPEED caps the pace in px per ms (0.18 = 180
 * px/s, a calm walk instead of a slide).
 */
const EASE_MS = 220;
const WALK_SPEED = 0.18;

/** Follow the layout target with an eased, speed-capped walk, not a CSS jump. */
const easeStep = (value: number, target: number, elapsed: number): number => {
  const delta = target - value;
  if (Math.abs(delta) <= .55) return target;
  const eased = delta * (1 - Math.exp(-elapsed / EASE_MS));
  return value + clamp(eased, -WALK_SPEED * elapsed, WALK_SPEED * elapsed);
};

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.left + a.width + GAP, b.left + b.width + GAP) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.top + a.height + GAP, b.top + b.height + GAP) - Math.max(a.top, b.top));

/** Fit the label vertically without shifting its hero off the chosen ground point. */
function fitPlate(natural: Box, placed: readonly Box[], figures: readonly Box[], frame: Box, head: number) {
  const yMax = Math.min(frame.top + frame.height, head - GAP) - natural.height;
  const obstacles = [...placed, ...figures];
  const ys = [natural.top, frame.top, yMax, ...obstacles.flatMap(box => [box.top - natural.height - GAP, box.top + box.height + GAP])];
  let best = natural;
  let bestCost = Infinity;
  for (const y of ys) {
    const top = clamp(y, frame.top, Math.max(frame.top, yMax));
    const box = { ...natural, top };
    const cost = obstacles.reduce((sum, other) => sum + overlap(box, other), 0);
    if (cost < bestCost || (cost === bestCost && Math.abs(top - natural.top) < Math.abs(best.top - natural.top))) {
      best = box;
      bestCost = cost;
    }
    if (!cost && top === natural.top) break;
  }
  return best;
}

/** Follow the models with separate head and feet anchors in one read/write pass. */
export const usePlateSpacing = (fieldRef: RefObject<HTMLElement | null>, heroes: readonly HeroUnit[], introPlaying: boolean) => {
  const placements = useRef(new WeakMap<HTMLElement, PlacementMotion>());
  useLayoutEffect(() => {
    const motion = placements.current;
    const field = fieldRef.current;
    const table = field?.closest('.dueling-table');
    const layer = table?.querySelector<HTMLElement>('.hero-plate-layer');
    const header = table?.querySelector<HTMLElement>('.table-header');
    const console = table?.querySelector<HTMLElement>('.table-console');
    if (!field || !layer) return;
    // Plates are hidden during the cinematic. Re-layout must not steer a falling boss.
    if (introPlaying) {
      field.querySelectorAll<HTMLElement>('[' + HERO_LAYOUT_ATTR + ']').forEach(layout => {
        layout.style.removeProperty('translate');
        layout.removeAttribute('data-spacing-walk');
        layout.removeAttribute('data-relief-position');
        motion.delete(layout);
      });
      return;
    }
    // Rear units have the least room above their heads. Place those rows first.
    const ordered = [...heroes].sort((a, b) => rowDepth(b.row) - rowDepth(a.row) || a.col - b.col || a.uid - b.uid);
    layer.toggleAttribute('data-crowded', ordered.length >= 3);
    const findPlates = () => ordered.flatMap(unit => {
      const anchor = field.querySelector<HTMLElement>(`[${PLATE_UID_ATTR}="${unit.uid}"]`);
      const plate = layer.querySelector<HTMLElement>(`[${FLOATING_UID_ATTR}="${unit.uid}"]`);
      const intent = plate?.querySelector<HTMLElement>('.hero-action-chips');
      const figure = anchor?.closest<HTMLElement>('.hero-flight');
      const layout = figure?.closest<HTMLElement>('[' + HERO_LAYOUT_ATTR + ']');
      const hitbox = figure?.closest<HTMLButtonElement>('button[data-hero-uid]');
      return anchor && plate && intent && figure && layout && hitbox
        ? [{ anchor, plate, intent, figure, layout, hitbox, unit }] : [];
    });
    let entries = findPlates();
    let previous: number[] = [];
    let targets: (Placement | undefined)[] = [];
    const position = (time = performance.now()) => {
      const bounds = layer.getBoundingClientRect();
      if (!bounds.width || !bounds.height || !entries.length) return;
      const sx = layer.clientWidth / bounds.width;
      const sy = layer.clientHeight / bounds.height;
      const top = Math.max(0, ((header?.getBoundingClientRect().bottom ?? bounds.top) - bounds.top) * sy) + GAP;
      const floor = Math.min(bounds.bottom, field.getBoundingClientRect().bottom,
        console?.getBoundingClientRect().top ?? bounds.bottom);
      const frame = { left: GAP, top, width: layer.clientWidth - GAP * 2, height: (floor - bounds.top) * sy - top - GAP };
      const measures = entries.map(({anchor, plate, intent, figure, layout, hitbox, unit}) => {
        const { row } = unit;
        const rect = anchor.getBoundingClientRect();
        const body = figure.getBoundingClientRect();
        // Remove this hook's translation before reading the normal placement.
        const rowBox = layout.getBoundingClientRect();
        const scaleX = rowBox.width / layout.offsetWidth || 1;
        const scaleY = rowBox.height / layout.offsetHeight || 1;
        const [tx = 0, ty = 0] = layout.style.translate.split(' ').map(value => Number.parseFloat(value) || 0);
        const shift = tx * scaleX;
        const lift = ty * scaleY;
        // Use the rendered figure itself as the horizontal anchor, even during an attack.
        const center = (body.left + body.width / 2 - shift - bounds.left) * sx;
        const silhouette = {
          left: (body.left + body.width * .18 - shift - bounds.left) * sx,
          top: (rect.bottom - lift - bounds.top) * sy,
          width: body.width * .64 * sx,
          height: Math.max(0, body.bottom - rect.bottom) * sy,
        };
        const ground = { left: (rowBox.left - shift - bounds.left) * sx,
          top: (rowBox.top - lift - bounds.top) * sy, width: rowBox.width * sx, height: rowBox.height * sy };
        // The button's layout dimensions exclude the attack, aim and idle transforms of the sprite.
        const feet = { x: ground.left + (hitbox.offsetLeft + hitbox.offsetWidth / 2) * scaleX * sx,
          y: ground.top + (hitbox.offsetTop + hitbox.offsetHeight) * scaleY * sy };
        const bodyWidth = figure.offsetWidth * .84 * scaleX * sx;
        const bodyHeight = figure.offsetHeight * .86 * scaleY * sy;
        const bodyLane = { left: feet.x - bodyWidth / 2, top: feet.y - bodyHeight, width: bodyWidth, height: bodyHeight };
        const width = intent.offsetWidth;
        const height = intent.offsetHeight;
        const naturalTop = silhouette.top - height - GAP;
        const natural = { width, height, left: center - width / 2, top: naturalTop };
        const healthY = (body.bottom - lift - bounds.top) * sy + HEALTH_GAP;
        const relief = { body: bodyLane, feet, row, movable: !isBoss(unit) && !isAnchored(unit) };
        return { width, silhouette, relief, ground, center, scaleX, scaleY, naturalTop, natural, healthY, plateWidth: plate.offsetWidth };
      });
      const key = [frame.width, frame.height, top, ...measures.flatMap(({width, natural, silhouette, relief, ground}) =>
        [width, natural.width, natural.height, natural.left, natural.top, silhouette.top, silhouette.width, silhouette.height,
          relief.feet.x, relief.feet.y, relief.body.width, relief.body.height, ground.width, ground.height])];
      if (hasMoved(previous, key)) {
        previous = key;
        const groundBottom = Math.max(...measures.map(({ground}) => ground.top + ground.height));
        const layoutFrame = { ...frame, height: groundBottom - frame.top };
        const offsets = chooseReliefOffsets(measures.map(({relief, natural, ground}) => {
          const { farBoundary, boundary } = rowPerspective(relief.row);
          return { ...relief, plate: natural, spots: relief.movable
            ? laneReliefPoints(ground, farBoundary, boundary, relief.feet, relief.body, natural, layoutFrame) : [] };
        }), layoutFrame);
        const placed: Box[] = [];
        const figures = measures.map(({silhouette}, i) => ({
          ...silhouette, left: silhouette.left + offsets[i]!.x, top: silhouette.top + offsets[i]!.y,
        }));
        targets = measures.map(({ width, natural, naturalTop }, i) => {
          const { x: shift, y: lift } = offsets[i]!;
          if (!width || !natural.height) return { shift, lift, labelOffset: 0 };
          const aboveHead = naturalTop + lift;
          const intentFrame = { ...frame, top: Math.max(0, Math.min(frame.top, aboveHead)) };
          const box = fitPlate({ ...natural, left: natural.left + shift, top: aboveHead },
            placed, figures.filter((_, index) => index !== i), intentFrame, figures[i]!.top);
          placed.push(box);
          return { shift, lift, labelOffset: box.top - naturalTop - lift };
        });
      }
      // The model and portaled plate use the same interpolated offset. The
      // base anchor still follows attacks and row transitions without lag.
      const reduced = prefersReducedMotion();
      measures.forEach(({ center, scaleX, scaleY, naturalTop, healthY, plateWidth }, i) => {
        const { plate, layout } = entries[i]!;
        const target = targets[i];
        if (!target) return;
        const prior = motion.get(layout);
        const dt = clamp(time - (prior?.at ?? time), 0, 34);
        const shift = prior && !reduced ? easeStep(prior.shift, target.shift, dt) : target.shift;
        const lift = prior && !reduced ? easeStep(prior.lift, target.lift, dt) : target.lift;
        const labelOffset = prior && !reduced
          ? easeStep(prior.labelOffset, target.labelOffset, dt) : target.labelOffset;
        motion.set(layout, { shift, lift, labelOffset, at: time });
        const walking = !reduced && !!prior && (Math.hypot(shift - target.shift, lift - target.lift) > 4 || Math.hypot(shift - prior.shift, lift - prior.lift) > 1);
        if (layout.hasAttribute('data-spacing-walk') !== walking) layout.toggleAttribute('data-spacing-walk', walking);
        const relief = Math.hypot(target.shift, target.lift) > 0.5;
        if (layout.hasAttribute('data-relief-position') !== relief) layout.toggleAttribute('data-relief-position', relief);
        const translate = (shift / (sx * scaleX)).toFixed(3) + 'px ' + (lift / (sy * scaleY)).toFixed(3) + 'px';
        const x = center + shift;
        const left = (x - plateWidth / 2).toFixed(3) + 'px';
        const edgeSpan = Math.max(1, 2 * Math.min(x - GAP, frame.width + GAP - x)).toFixed(3) + 'px';
        const intentY = clamp(naturalTop + lift + Math.min(0, labelOffset), 0, frame.top + frame.height).toFixed(3) + 'px';
        const hpY = Math.min(healthY + lift, frame.top + frame.height - HEALTH_FLOOR_PADDING).toFixed(3) + 'px';
        if (layout.style.translate !== translate) layout.style.translate = translate;
        if (plate.style.left !== left) plate.style.left = left;
        if (plate.style.getPropertyValue('--hero-edge-span') !== edgeSpan) plate.style.setProperty('--hero-edge-span', edgeSpan);
        if (plate.style.getPropertyValue('--hero-intent-y') !== intentY) plate.style.setProperty('--hero-intent-y', intentY);
        if (plate.style.getPropertyValue('--hero-hp-y') !== hpY) plate.style.setProperty('--hero-hp-y', hpY);
        if (plate.style.visibility !== 'visible') plate.style.visibility = 'visible';
      });
    };
    // React inserts portal children in a second commit; the field can already have its final size.
    const mounted = new MutationObserver(() => { entries = findPlates(); previous = []; position(); });
    mounted.observe(layer, { childList: true });
    position();
    let frameId = 0;
    const follow = (time: number) => { position(time); frameId = requestAnimationFrame(follow); };
    frameId = requestAnimationFrame(follow);
    return () => { mounted.disconnect(); cancelAnimationFrame(frameId); };
  }, [fieldRef, heroes, introPlaying]);
};
