import { playSound } from '../../lib/gameAudio';
// --- SKILL TREE ---
import { useLayoutEffect, useRef, useState } from 'react';
import { skillArtworkFor } from './skillArtwork';
import type { CharacterState } from '../../../shared/game/character';
import {
  branchNames,
  tiers,
  skillCap,
  skillPointsLeft,
  skillRank,
  skillPurchases,
  skillEffectOf,
  planSkillPath,
  type SkillPick,
} from '../../../shared/game/skills';

const colors = ['movement', 'melee', 'range', 'utility', 'curse'];
const overviewHeights = [-104, -144, -171, -201];
const focusedHeights = [-18, -94, -170, -246];
type Detail = {
  pick: SkillPick;
  target: SVGGElement;
};

/** Activate circles directly, with rank details in a small popover. */
export function SkillTree({
  character,
  onSkill,
}: {
  character: CharacterState;
  onSkill: (pick: SkillPick, rankUp?: boolean) => void;
}) {
  const [branch, setBranch] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const chart = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const heights = branch === null ? overviewHeights : focusedHeights;
  const picks = character.skillPicks ?? [];
  const active = detail?.pick;
  const local = picks.filter((p) => p.branch === active?.branch);
  const rank = active ? skillRank(local, active.tier, active.slot) : 0;

  const activeArt = active ? skillArtworkFor(active) : undefined;

  useLayoutEffect(() => {
    const box = chart.current;
    const tip = popover.current;
    if (!detail || !box || !tip) return;
    const { target } = detail;

    /** Prefer a free side of the node, then clamp the portrait panel inside the chart. */
    function place() {
      if (!box || !tip) return;
      const gap = 8;
      const width = tip.offsetWidth;
      const height = tip.offsetHeight;
      box.style.setProperty('--skill-detail-height', Math.ceil(tip.getBoundingClientRect().height) + 'px');
      const area = box.getBoundingClientRect();
      const node = target.getBoundingClientRect();
      const before = node.left - area.left - gap - width;
      const after = node.right - area.left + gap;
      const above = node.top - area.top - gap - height;
      const below = node.bottom - area.top + gap;
      const cx = (node.left + node.right) / 2 - area.left;
      const cy = (node.top + node.bottom) / 2 - area.top;
      const side = after + width <= area.width ? after : before >= 0 ? before : null;
      const left = side ?? cx - width / 2;
      const top = side !== null
        ? cy - height / 2
        : below + height <= area.height ? below : above;
      tip.style.left = Math.max(0, Math.min(area.width - width, left)) + 'px';
      tip.style.top = Math.max(0, Math.min(area.height - height, top)) + 'px';
    }

    place();
    const observer = new ResizeObserver(place);
    observer.observe(box);
    observer.observe(tip);
    return () => {
      observer.disconnect();
      box.style.removeProperty('--skill-detail-height');
    };
  }, [detail]);

  /** Open details, purchasing the path first when the circle is reachable. */
  function activate(pick: SkillPick, target: SVGGElement) {
    playSound('runeClick', 1, 0.72);
    // TWO-CLICK BUY: the first click only selects (shows the tooltip);
    // clicking the selected circle again spends the point.
    const isSelected =
      active?.branch === pick.branch &&
      active.tier === pick.tier &&
      active.slot === pick.slot;
    const ownedRank = skillRank(
      picks.filter((p) => p.branch === pick.branch),
      pick.tier,
      pick.slot
    );
    setDetail({ pick, target });
    if (!isSelected) return;
    if (ownedRank === 0) {
      for (const step of skillPurchases(character, pick).steps)
        onSkill(step, true);
    } else if (ownedRank < skillCap(pick.tier)) {
      if (skillPurchases(character, pick).steps.length) onSkill(pick, true);
    }
  }

  return (
    <section className="cs-skill-tree cs-paper" aria-label="Skill tree">
      <strong aria-live="polite">
        {skillPointsLeft(character)} skill points available
      </strong>
      <div className="cs-branch-picker" role="group" aria-label="Path view">
        {[null, ...branchNames.keys()].map((b) => (
          <button
            type="button"
            key={b ?? 'all'}
            aria-pressed={branch === b}
            onClick={() => {
              setBranch(b);
              setDetail(null);
            }}
          >
            {b === null ? (
              'All paths'
            ) : (
              <>
                <span
                  className="cs-path-swatch"
                  style={{
                    backgroundColor: 'var(--color-card-' + colors[b] + ')',
                  }}
                  aria-hidden="true"
                />
                {branchNames[b]} · {picks.filter((p) => p.branch === b).length}
              </>
            )}
          </button>
        ))}
      </div>
      <div
        ref={chart}
        className="cs-skill-chart" data-detail-open={!!detail}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setDetail(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && detail) {
            e.preventDefault();
            e.stopPropagation();
            setDetail(null);
          }
        }}
      >
        <svg
          className={branch !== null ? 'cs-focused-path' : undefined}
          viewBox={branch !== null ? '0 -48 265 108' : '-219 -218 438 229'}
          role="group"
          aria-label="Skill paths"
          onClick={() => setDetail(null)}
        >
          {branchNames.map((name, b) => {
            if (branch !== null && branch !== b) return null;
            const owned = picks.filter((p) => p.branch === b);
            const color = 'var(--color-card-' + colors[b] + ')';
            const rotation = branch === null ? (b - 2) * 38 : 90;
            return (
              <g
                key={name}
                stroke={color}
                transform={`rotate(${rotation})`}
              >
                <path d={'M0 0 V' + heights[0]} data-lit={owned.length > 0} />
                {tiers.map((row, t) =>
                  row.map((node, s) =>
                    node.parents.map((parent) => {
                      const x = tiers[t - 1]![parent]!.x,
                        mid = (heights[t]! + heights[t - 1]!) / 2;
                      return (
                        <path
                          key={[t, s, parent].join('-')}
                          data-lit={
                            !!skillRank(owned, t, s) &&
                            !!skillRank(owned, t - 1, parent)
                          }
                          d={`M${x} ${heights[t - 1]} C${x} ${mid} ${node.x} ${mid} ${node.x} ${heights[t]}`}
                        />
                      );
                    })
                  )
                )}
                {tiers.map((row, t) =>
                  row.map((node, s) => {
                    const r = skillRank(owned, t, s);
                    const pick = { branch: b, tier: t, slot: s };
                    const effect = skillEffectOf(pick);
                    const icon = skillArtworkFor(pick);
                    const radius = branch !== null
                      ? skillCap(t) === 1 ? 13 : 10.5
                      : skillCap(t) === 1 ? 10 : 5.5;
                    const plan = skillPurchases(character, pick);
                    const label =
                      (effect ? `${effect.name}. ${effect.description}. ${name}` : name) +
                      ', step ' +
                      (t + 1) +
                      ', circle ' +
                      (s + 1) +
                      ', rank ' +
                      r +
                      '/' +
                      skillCap(t) +
                      '. ' +
                      plan.message;
                    return (
                      <g
                        key={t + '-' + s}
                        role="button"
                        aria-disabled={!plan.steps.length && !r}
                        tabIndex={0}
                        aria-label={label}
                        className="cs-click-node"
                        onClick={(e) => {
                          e.stopPropagation();
                          activate(pick, e.currentTarget);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (!e.repeat) activate(pick, e.currentTarget);
                          }
                        }}
                      >
                        <title>{label}</title>
                        <circle
                          cx={node.x}
                          cy={heights[t]}
                          r={branch !== null ? 15 : skillCap(t) === 1 ? 13 : 9}
                          style={{ fill: 'transparent', stroke: 'none' }}
                        />
                        <circle
                          cx={node.x}
                          cy={heights[t]}
                          r={radius}
                          style={r ? { fill: color } : undefined}
                        />
                        {icon && (
                          <image
                            href={icon}
                            x={node.x - radius * 0.88}
                            y={heights[t]! - radius * 0.88}
                            width={radius * 1.76}
                            height={radius * 1.76}
                            transform={`rotate(${-rotation} ${node.x} ${heights[t]})`}
                            pointerEvents="none"
                            aria-hidden="true"
                          />
                        )}
                        {branch !== null && (
                          <text
                            // RANK UNDER THE CIRCLE: the path is turned 90°,
                            // so +x here is down on screen.
                            transform={
                              'translate(' +
                              (node.x + (skillCap(t) === 1 ? 13 : 10.5) + 8) +
                              ' ' +
                              heights[t] +
                              ') rotate(-90)'
                            }
                            textAnchor="middle"
                            dominantBaseline="central"
                            stroke="none"
                            fill="var(--color-on-parchment)"
                            fontSize="9"
                            fontWeight="700"
                            pointerEvents="none"
                          >
                            {r}/{skillCap(t)}
                          </text>
                        )}
                      </g>
                    );
                  })
                )}
              </g>
            );
          })}
        </svg>
        {detail && active && (
          <div
            ref={popover}
            className="cs-node-detail"
            role="group"
            aria-label="Circle details"
            data-branch={active.branch}
          >
            {activeArt && (
              <div className="cs-skill-art" aria-hidden="true">
                <img src={activeArt} alt="" draggable={false} />
              </div>
            )}
            <div className="cs-node-copy">
              <strong>
                {skillEffectOf(active)?.name ?? branchNames[active.branch]} ·{' '}
                {rank}/{skillCap(active.tier)}
              </strong>
              {skillEffectOf(active) && (
                <small>{skillEffectOf(active)!.description}</small>
              )}
              {rank === 0 && (
                <small>{skillPurchases(character, active).message}</small>
              )}
              {rank < skillCap(active.tier) && skillPurchases(character, active).steps.length > 0 && (
                <small>Click again to spend a point</small>
              )}
              {rank > 0 && rank < skillCap(active.tier) && (
                <button
                  className="cs-rank-up"
                  type="button"
                  disabled={!skillPurchases(character, active).steps.length}
                  onClick={() => onSkill(active, true)}
                >
                  Rank up to {rank + 1}/{skillCap(active.tier)}
                </button>
              )}
              {rank > 0 && (
                <button
                  className="cs-refund"
                  type="button"
                  onClick={() => {
                    onSkill(active);
                    setDetail(null);
                  }}
                >
                  {planSkillPath(character, active).message}
                </button>
              )}
            </div>
            <button
              className="cs-tip-close"
              type="button"
              aria-label="Close circle details"
              onClick={() => setDetail(null)}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
