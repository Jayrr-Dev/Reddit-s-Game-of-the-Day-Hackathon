import { playSound } from '../../lib/gameAudio';
// --- SKILL TREE ---
import { useLayoutEffect, useRef, useState } from 'react';
import { SkillGlyph } from './SkillGlyph';
import { RichText } from '../ui/RichText';
import { Glyph } from '../ui/Glyph';
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

  useLayoutEffect(() => {
    const box = chart.current;
    const tip = popover.current;
    if (!detail || !box || !tip) return;
    const { target } = detail;

    /** Prefer above the node, then below, then a free side; clamp the panel inside the chart. */
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
      // The panel may rise past the chart over the path buttons, up to the section's top.
      const ceiling = (box.closest('.cs-skill-tree')?.getBoundingClientRect().top ?? area.top) - area.top;
      const vertical = above >= ceiling ? above : below + height <= area.height ? below : null;
      const side = after + width <= area.width ? after : before >= 0 ? before : null;
      const left = vertical !== null || side === null ? cx - width / 2 : side;
      const top = vertical ?? (side !== null ? cy - height / 2 : above);
      tip.style.left = Math.max(0, Math.min(area.width - width, left)) + 'px';
      tip.style.top = Math.max(ceiling, Math.min(area.height - height, top)) + 'px';
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
    const canRankUp = skillPurchases(character, pick).steps.length > 0;
    if (ownedRank === 0) {
      for (const step of skillPurchases(character, pick).steps)
        onSkill(step, true);
    } else if (ownedRank < skillCap(pick.tier) && canRankUp) {
      onSkill(pick, true);
    } else {
      // DOUBLE-CLICK REFUND: an owned circle that can't rank up refunds on
      // the second click, same as its Refund button.
      onSkill(pick);
      setDetail(null);
    }
  }

  return (
    <section className="cs-skill-tree cs-paper" aria-label="Skill tree">
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
          data-skill-map
          className={branch !== null ? 'cs-focused-path' : undefined}
          viewBox={branch !== null ? '0 -48 265 108' : '-219 -218 438 229'}
          role="group"
          aria-label="Skill paths"
          onClick={() => setDetail(null)}
        >
          <defs>
            {/* WARM PLATE: the amber wash behind every learned circle. */}
            <radialGradient id="cs-skill-plate" cx="50%" cy="38%" r="65%">
              <stop offset="0%" className="cs-skill-plate-glow" />
              <stop offset="100%" className="cs-skill-plate-edge" />
            </radialGradient>
          </defs>
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
                <path className="cs-skill-link" d={'M0 0 V' + heights[0]} data-lit={owned.length > 0} />
                {tiers.map((row, t) =>
                  row.map((node, s) =>
                    node.parents.map((parent) => {
                      const x = tiers[t - 1]![parent]!.x,
                        mid = (heights[t]! + heights[t - 1]!) / 2;
                      return (
                        <path
                          key={[t, s, parent].join('-')}
                          className="cs-skill-link"
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
                        data-owned={r > 0}
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
                          className="cs-skill-plate"
                          r={radius}
                        />
                        <g
                          transform={`translate(${node.x} ${heights[t]}) rotate(${-rotation}) scale(${radius / 16}) translate(-12 -12)`}
                          pointerEvents="none"
                        >
                          <SkillGlyph pick={pick} />
                        </g>
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
          >
            <div className="cs-skill-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24"><SkillGlyph pick={active} /></svg>
              {/* LOCK: covers the badge until the circle can be bought; gone once it's available. */}
              {rank === 0 && skillPurchases(character, active).steps.length === 0 && (
                <span className="cs-skill-lock"><Glyph name="padlock" /></span>
              )}
            </div>
            <div className="cs-node-copy">
              <strong>
                {skillEffectOf(active)?.name ?? branchNames[active.branch]} ·{' '}
                {rank}/{skillCap(active.tier)}
              </strong>
              {skillEffectOf(active) && (
                <small><RichText text={skillEffectOf(active)!.description} /></small>
              )}
              {rank === 0 && (
                <small className="cs-skill-requirement">{skillPurchases(character, active).message}</small>
              )}
              {/* ACTIONS: small text buttons in one row; full wording lives in the tooltip/label. */}
              {rank > 0 && (
                <div className="cs-node-actions">
                  {rank < skillCap(active.tier) && skillPurchases(character, active).steps.length > 0 && (
                    <button
                      className="cs-rank-up"
                      type="button"
                      title={`Rank up to ${rank + 1}/${skillCap(active.tier)}`}
                      onClick={() => onSkill(active, true)}
                    >
                      Rank up
                    </button>
                  )}
                  <button
                    className="cs-refund"
                    type="button"
                    title={planSkillPath(character, active).message}
                    aria-label={planSkillPath(character, active).message}
                    onClick={() => {
                      onSkill(active);
                      setDetail(null);
                    }}
                  >
                    Refund
                  </button>
                </div>
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
      {/* POINTS LEFT: under the tree, large, so it reads as the budget for it. */}
      <strong className="cs-skill-points" aria-live="polite">
        {skillPointsLeft(character)} skill points available
      </strong>
    </section>
  );
}
