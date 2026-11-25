import { useLayoutEffect, type RefObject } from 'react';
import { rowDepth } from '../../shared/game/battlefield';
import type { HeroUnit } from '../../shared/game/types';

export const PLATE_UID_ATTR = 'data-plate-uid';
export const FLOATING_UID_ATTR = 'data-floating-uid';
const GAP = 3;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

type Box = { left: number; top: number; width: number; height: number };
/** Spread crowded neighbors horizontally before trying a different vertical line. */
function spreadRow(boxes: Box[], frame: Box) {
  if (boxes.length < 2 || boxes.reduce((sum, box) => sum + box.width, 0) + GAP * (boxes.length - 1) > frame.width) return;
  const naturalSum = boxes.reduce((sum, box) => sum + box.left, 0);
  let start = frame.left;
  for (const box of boxes) {
    box.left = Math.max(start, box.left);
    start = box.left + box.width + GAP;
  }
  let end = frame.left + frame.width;
  for (let i = boxes.length - 1; i >= 0; i--) {
    const box = boxes[i]!;
    box.left = Math.min(end - box.width, box.left);
    end = box.left - GAP;
  }
  const shift = (naturalSum - boxes.reduce((sum, box) => sum + box.left, 0)) / boxes.length;
  const last = boxes[boxes.length - 1]!;
  const correction = clamp(shift, frame.left - boxes[0]!.left, frame.left + frame.width - (last.left + last.width));
  for (const box of boxes) box.left += correction;
}

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.left + a.width + GAP, b.left + b.width + GAP) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.top + a.height + GAP, b.top + b.height + GAP) - Math.max(a.top, b.top));

/** Keep the plate over its hero when possible. Neighbors can use either side or another line. */
function fitPlate(natural: Box, placed: readonly Box[], figures: readonly Box[], frame: Box, head: number) {
  const xMax = frame.left + frame.width - natural.width;
  const yMax = Math.min(frame.top + frame.height, head - GAP) - natural.height;
  const obstacles = [...placed, ...figures];
  const xs = [natural.left, frame.left, xMax, ...obstacles.flatMap(box => [box.left - natural.width - GAP, box.left + box.width + GAP])];
  const ys = [natural.top, frame.top, yMax, ...obstacles.flatMap(box => [box.top - natural.height - GAP, box.top + box.height + GAP])];
  let best = natural;
  let bestFigureOverlap = Infinity;
  let bestOverlap = Infinity;
  let bestDistance = Infinity;
  for (const x of xs) for (const y of ys) {
    const left = clamp(x, frame.left, xMax);
    const top = clamp(y, frame.top, Math.max(frame.top, yMax));
    const box = { ...natural, left, top };
    const occupied = placed.reduce((sum, other) => sum + overlap(box, other), 0);
    const covered = figures.reduce((sum, figure) => sum + overlap(box, figure), 0);
    const distance = 2 * (left - natural.left) ** 2 + (top - natural.top) ** 2;
    if (occupied < bestOverlap || (occupied === bestOverlap &&
      (covered < bestFigureOverlap || (covered === bestFigureOverlap && distance < bestDistance)))) {
      best = box;
      bestFigureOverlap = covered;
      bestOverlap = occupied;
      bestDistance = distance;
    }
    if (!covered && !occupied && x === natural.left && y === natural.top) return box;
  }
  return best;
}

/** Position portaled bars from their actual figure anchors in a single read/write pass. */
export const usePlateSpacing = (fieldRef: RefObject<HTMLElement | null>, heroes: readonly HeroUnit[]) => {
  useLayoutEffect(() => {
    const field = fieldRef.current;
    const table = field?.closest('.dueling-table');
    const layer = table?.querySelector<HTMLElement>('.hero-plate-layer');
    const header = table?.querySelector<HTMLElement>('.table-header');
    if (!field || !layer) return;
    // Rear units have the least room above their heads. Place those rows first.
    const ordered = [...heroes].sort((a, b) => rowDepth(b.row) - rowDepth(a.row) || a.col - b.col || a.uid - b.uid);
    layer.toggleAttribute('data-crowded', ordered.some(unit => ordered.filter(other => other.row === unit.row).length >= 3));
    const findPlates = () => ordered.flatMap(unit => {
      const anchor = field.querySelector<HTMLElement>(`[${PLATE_UID_ATTR}="${unit.uid}"]`);
      const plate = layer.querySelector<HTMLElement>(`[${FLOATING_UID_ATTR}="${unit.uid}"]`);
      const figure = anchor?.closest('.hero-flight');
      return anchor && plate && figure ? [{ anchor, plate, figure, row: unit.row }] : [];
    });
    let entries = findPlates();
    let previous = '';
    const position = () => {
      const bounds = layer.getBoundingClientRect();
      if (!bounds.width || !bounds.height || !entries.length) return;
      const sx = layer.clientWidth / bounds.width;
      const sy = layer.clientHeight / bounds.height;
      const top = Math.max(0, ((header?.getBoundingClientRect().bottom ?? bounds.top) - bounds.top) * sy) + GAP;
      const floor = Math.min(bounds.bottom, field.getBoundingClientRect().bottom,
        table?.querySelector('.table-console')?.getBoundingClientRect().top ?? bounds.bottom);
      const frame = { left: GAP, top, width: layer.clientWidth - GAP * 2, height: (floor - bounds.top) * sy - top - GAP };
      const measures = entries.map(({anchor, plate, figure}) => {
        const rect = anchor.getBoundingClientRect();
        const body = figure.getBoundingClientRect();
        const silhouette = {
          left: (body.left + body.width * .18 - bounds.left) * sx,
          top: (rect.bottom - bounds.top) * sy,
          width: body.width * .64 * sx,
          height: Math.max(0, body.bottom - rect.bottom) * sy,
        };
        const width = plate.offsetWidth;
        const height = plate.offsetHeight;
        // The centered name and chip strip span 128% of the HP bar.
        const footprint = Math.min(frame.width, Math.max(width * 1.28, (plate.querySelector<HTMLElement>('.hero-plate-details')?.offsetWidth ?? 0) * .8));
        return { width, silhouette, center: (rect.left + rect.width / 2 - bounds.left) * sx, natural: { width: footprint, height,
          left: (rect.left + rect.width / 2 - bounds.left) * sx - footprint / 2,
          top: (rect.bottom - bounds.top) * sy - height } };
      });
      // No layout writes while figures, viewport and card content are stationary.
      const key = [frame.width, frame.height, top, ...measures.flatMap(({width, natural, silhouette}) =>
        [width, natural.height, natural.left.toFixed(2), natural.top.toFixed(2), silhouette.width.toFixed(2), silhouette.height.toFixed(2)])].join(',');
      if (key === previous) return;
      previous = key;
      for (const row of new Set(entries.map(entry => entry.row))) {
        spreadRow(measures.flatMap((measure, i) => entries[i]!.row === row ? [measure.natural] : []), frame);
      }
      const placed: Box[] = [];
      const figures = measures.map(measure => measure.silhouette);
      measures.forEach(({ width, natural }, i) => {
        if (!width || !natural.height) return;
        // Search sideways when a rear unit occupies the space above this head.
        const box = fitPlate(natural, placed, figures, frame, figures[i]!.top);
        placed.push(box);
        const plate = entries[i]!.plate;
        plate.style.left = box.left + (box.width - width) / 2 + 'px';
        plate.style.top = box.top + 'px';
        plate.style.visibility = 'visible';
      });
    };
    // React inserts portal children in a second commit; the field can already have its final size.
    const mounted = new MutationObserver(() => { entries = findPlates(); previous = ''; position(); });
    mounted.observe(layer, { childList: true });
    position();
    let frameId = 0;
    const follow = () => { position(); frameId = requestAnimationFrame(follow); };
    frameId = requestAnimationFrame(follow);
    return () => { mounted.disconnect(); cancelAnimationFrame(frameId); };
  }, [fieldRef, heroes]);
};
