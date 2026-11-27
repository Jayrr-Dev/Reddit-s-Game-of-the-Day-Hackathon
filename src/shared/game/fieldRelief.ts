/** Screen-space layout only: the unit's combat row and column never change. */
export type FieldBox = { left: number; top: number; width: number; height: number };
export type ReliefPoint = { x: number; y: number };
type UnitBox = { body: FieldBox; plate?: FieldBox; health?: FieldBox; feet: ReliefPoint; row: string; movable: boolean; spots: readonly ReliefPoint[] };
type Candidate = { body: FieldBox; plate?: FieldBox; health?: FieldBox; offset: ReliefPoint; distance: number };

const area = (a: FieldBox, b: FieldBox, gap = 0) =>
  Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left) + gap) *
  Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top) + gap);

/** The rays in the reference converge at the horizon; the green lines are the row edges. */
export const reliefIntersections = (ground: FieldBox, boundary: number): ReliefPoint[] =>
  [-1.36, -.68, -.33, 0, .33, .68, 1.36].map(ray => ({
    x: ground.left + ground.width * (1 + ray * boundary) / 2,
    y: ground.top + ground.height * boundary,
  }));

/**
 * The entire band is usable: sample it at a viewport-independent density.
 * The measured body and badge widths narrow the safe interval per unit.
 */
export function laneReliefPoints(
  ground: FieldBox, far: number, near: number, feet: ReliefPoint,
  body: FieldBox, plate: FieldBox, frame: FieldBox, health?: FieldBox,
): ReliefPoint[] {
  const insetLeft = feet.x - Math.min(body.left, plate.left, health?.left ?? Infinity);
  const insetRight = Math.max(body.left + body.width, plate.left + plate.width,
    health ? health.left + health.width : -Infinity) - feet.x;
  const left = Math.max(ground.left, frame.left + insetLeft);
  const right = Math.min(ground.left + ground.width, frame.left + frame.width - insetRight);
  if (right < left || ground.height <= 0) return [];
  const at = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const top = ground.top + ground.height * far;
  const bottom = ground.top + ground.height * near;
  const xs = [at(feet.x, left, right), ...Array.from({ length: 11 }, (_, i) => left + (right - left) * i / 10)];
  const ys = [at(feet.y, top, bottom), ...Array.from({ length: 5 }, (_, i) => top + (bottom - top) * i / 4)];
  return [...new Set(xs)].flatMap(x => [...new Set(ys)].map(y => ({ x, y })));
}

const shift = (box: FieldBox, x: number, y: number) => ({ ...box, left: box.left + x, top: box.top + y });

/** Slide a selected name out of neighboring intents without moving the units. */
export function nameRelief(name: FieldBox, intents: readonly FieldBox[], frame: FieldBox): ReliefPoint {
  const costOf = (box: FieldBox) => intents.reduce((sum, intent) => sum + area(box, intent, 2), 0);
  if (!costOf(name)) return { x: 0, y: 0 };
  const fits = (box: FieldBox) => box.left >= frame.left && box.left + box.width <= frame.left + frame.width &&
    box.top >= frame.top && box.top + box.height <= frame.top + frame.height;
  const deltas = intents.flatMap(intent => [
    { x: 0, y: intent.top + intent.height + 2 - name.top },
    { x: 0, y: intent.top - name.height - 2 - name.top },
    { x: intent.left + intent.width + 2 - name.left, y: 0 },
    { x: intent.left - name.width - 2 - name.left, y: 0 },
  ]);
  const rank = ({ x, y }: ReliefPoint) => y > 0 ? 0 : x === 0 ? 1 : 2;
  return deltas.sort((a, b) => rank(a) - rank(b) || Math.abs(a.x + a.y) - Math.abs(b.x + b.y))
    .find(({ x, y }) => { const box = shift(name, x, y); return fits(box) && !costOf(box); }) ??
    { x: 0, y: 0 };
}

function placement(unit: UnitBox, offset: ReliefPoint, frame: FieldBox): Candidate {
  const { x, y } = offset;
  const body = shift(unit.body, x, y);
  const plate = unit.plate && shift(unit.plate, x, y);
  if (plate) plate.top = Math.max(frame.top, plate.top);
  const health = unit.health && shift(unit.health, x, y);
  return { body, ...(plate && { plate }), ...(health && { health }), offset, distance: x * x + y * y };
}

function clippedBox(box: FieldBox | undefined, frame: FieldBox) {
  if (!box) return 0;
  const outside = Math.max(0, frame.left - box.left) + Math.max(0, box.left + box.width - frame.left - frame.width);
  return outside * box.height * 4;
}

function clippedPlate(candidate: Candidate, frame: FieldBox) {
  return clippedBox(candidate.plate, frame) + clippedBox(candidate.health, frame);
}

function collisions(a: Candidate, b: Candidate, sameRow: boolean) {
  const cover = area(a.body, b.body, sameRow ? 3 : 0);
  // A little cross-row perspective overlap is expected. Plates still need room.
  const body = sameRow ? cover : Math.max(0, cover - .27 * Math.min(a.body.width * a.body.height, b.body.width * b.body.height));
  // A rear HP/status group must not cover a closer unit or its intent.
  return body +
    (a.health ? 4 * area(a.health, b.body, 3) + (b.plate ? 3 * area(a.health, b.plate, 3) : 0) : 0) +
    (b.health ? 4 * area(b.health, a.body, 3) + (a.plate ? 3 * area(b.health, a.plate, 3) : 0) : 0) +
    (a.health && b.health ? 3 * area(a.health, b.health, 3) : 0) +
    (a.plate && b.plate ? 3 * area(a.plate, b.plate, 3) : 0) +
    (a.plate ? 2 * area(a.plate, b.body, 2) : 0) +
    (b.plate ? 2 * area(b.plate, a.body, 2) : 0);
}

/** Use relief points for crowded bodies or crowded name/intent groups, never for an unblocked unit. */
export function chooseReliefOffsets(units: readonly UnitBox[], frame: FieldBox): ReliefPoint[] {
  const choices = units.map(unit => {
    const primary = placement(unit, { x: 0, y: 0 }, frame);
    if (!unit.movable || !unit.body.width || !unit.body.height || units.length < 2) return [primary];
    const spots = unit.spots.map(point => placement(unit, { x: point.x - unit.feet.x, y: point.y - unit.feet.y }, frame))
      .filter(({ body, plate, health, offset }) => {
        const left = Math.min(body.left, plate?.left ?? Infinity, health?.left ?? Infinity);
        const right = Math.max(body.left + body.width, plate ? plate.left + plate.width : -Infinity,
          health ? health.left + health.width : -Infinity);
        return left >= frame.left && right <= frame.left + frame.width && body.top >= frame.top &&
          unit.feet.y + offset.y <= frame.top + frame.height + .5;
      });
    return [primary, ...spots];
  });
  const selected = choices.map(options => options[0]!);
  // Reconsider neighbors after a move, so a model can return to its primary
  // position when another unit opens space. Each change reduces pair cost
  // or, on a tie, distance, keeping the result deterministic.
  for (let pass = 0; pass < units.length; pass++) {
    let changed = false;
    for (let j = 0; j < units.length; j++) {
      const i = pass % 2 ? j : units.length - j - 1;
      const unit = units[i]!;
      const options = choices[i]!;
      if (options.length < 2) continue;
      const score = (candidate: Candidate) => selected.reduce((sum, other, k) =>
        k === i ? sum : sum + collisions(candidate, other, unit.row === units[k]!.row), clippedPlate(candidate, frame));
      let winner = selected[i]!;
      let best = score(winner);
      for (const candidate of options) {
        if (!best && candidate.distance >= winner.distance) continue;
        const cost = score(candidate);
        if (!unit.plate && !unit.health && cost) continue;
        if (cost < best || (cost === best && candidate.distance < winner.distance)) {
          winner = candidate;
          best = cost;
        }
      }
      if (winner !== selected[i]) { selected[i] = winner; changed = true; }
    }
    if (!changed) break;
  }
  // Congestion can require two neighbors to move together; a small beam
  // of partial solutions escapes local minima without an exhaustive search.
  const pairCost = (a: Candidate, b: Candidate, i: number, j: number) =>
    collisions(a, b, units[i]!.row === units[j]!.row);
  const costOf = (items: readonly Candidate[]) => items.reduce((total, candidate, i) =>
    items.slice(0, i).reduce((sum, other, j) => sum + pairCost(candidate, other, i, j),
      total + clippedPlate(candidate, frame)), 0);
  if (units.some(unit => unit.plate || unit.health) && costOf(selected) > 0) {
    let beam: { assigned: Candidate[]; cost: number; distance: number }[] = [{ assigned: [], cost: 0, distance: 0 }];
    for (let i = 0; i < units.length; i++) {
      beam = beam.flatMap(partial => choices[i]!.map(candidate => ({
        assigned: [...partial.assigned, candidate],
        cost: partial.assigned.reduce((sum, other, j) => sum + pairCost(candidate, other, i, j),
          partial.cost + clippedPlate(candidate, frame)),
        distance: partial.distance + candidate.distance,
      }))).sort((a, b) => a.cost - b.cost || a.distance - b.distance).slice(0, 24);
    }
    const alternative = beam[0];
    if (alternative && alternative.cost < costOf(selected)) return alternative.assigned.map(candidate => candidate.offset);
  }
  return selected.map(candidate => candidate.offset);
}
