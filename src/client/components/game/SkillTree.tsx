import { playSound } from '../../lib/gameAudio';
// --- SKILL TREE ---
import { useRef, useState } from 'react';
import type { CharacterState } from '../../../shared/game/character';
import {
  branchNames,
  tiers,
  skillCap,
  skillPointsLeft,
  skillRank,
  skillPurchases,
  planSkillPath,
  type SkillPick,
} from '../../../shared/game/skills';

const colors = ['movement', 'melee', 'magic', 'utility', 'curse'];
const overviewHeights = [-104, -144, -171, -201];
const focusedHeights = [-18, -94, -170, -246];
type Detail = {
  pick: SkillPick;
  x: number;
  y: number;
  above: boolean;
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
  const heights = branch === null ? overviewHeights : focusedHeights;
  const picks = character.skillPicks ?? [];
  const active = detail?.pick;
  const local = picks.filter((p) => p.branch === active?.branch);
  const rank = active ? skillRank(local, active.tier, active.slot) : 0;

  /** Keep the popover inside the chart and off the clicked circle. */
  function activate(pick: SkillPick, target: SVGGElement) {
    playSound('runeClick', 1, .72);
    const bounds = chart.current!.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const y = rect.top + rect.height / 2 - bounds.top;
    const owned = picks.some(p => p.branch === pick.branch && p.tier === pick.tier && p.slot === pick.slot);
    setDetail({
      pick,
      x: rect.left + rect.width / 2 - bounds.left,
      y,
      above: y > bounds.height / 2,
    });
    if (!owned) {
      for (const step of skillPurchases(character, pick).steps) onSkill(step, true);
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
        className="cs-skill-chart"
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
          viewBox={branch !== null ? '0 -49 265 98' : '-219 -218 438 229'}
          role="group"
          aria-label="Skill paths"
          onClick={() => setDetail(null)}
        >
          {branchNames.map((name, b) => {
            if (branch !== null && branch !== b) return null;
            const owned = picks.filter((p) => p.branch === b);
            const color = 'var(--color-card-' + colors[b] + ')';
            return (
              <g
                key={name}
                stroke={color}
                transform={
                  'rotate(' + (branch === null ? (b - 2) * 38 : 90) + ')'
                }
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
                    const plan = skillPurchases(character, pick);
                    const label =
                      name +
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
                          r={
                            branch !== null
                              ? skillCap(t) === 1
                                ? 13
                                : 10.5
                              : skillCap(t) === 1
                                ? 10
                                : 5.5
                          }
                          style={r ? { fill: color } : undefined}
                        />
                        {branch !== null && (
                          <text
                            transform={
                              'translate(' +
                              node.x +
                              ' ' +
                              heights[t] +
                              ') rotate(-90)'
                            }
                            textAnchor="middle"
                            dominantBaseline="central"
                            stroke="none"
                            fill={r ? 'white' : 'var(--color-on-parchment)'}
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
            className="cs-node-detail"
            role="group"
            aria-label="Circle details"
            style={{
              left:
                'clamp(0px, calc(' +
                detail.x +
                'px + 22px), calc(100% - var(--tip-width)))',
              top: detail.above ? detail.y - 16 : detail.y + 16,
              transform: detail.above ? 'translateY(-100%)' : undefined,
            }}
          >
            <strong>
              {branchNames[active.branch]} · {rank}/{skillCap(active.tier)}
            </strong>
            {rank === 0 && <small>{skillPurchases(character, active).message}</small>}
            {rank > 0 && rank < skillCap(active.tier) && (
              <button className="cs-rank-up" type="button" disabled={!skillPurchases(character,active).steps.length} onClick={() => onSkill(active, true)}>
                Rank up to {rank + 1}/{skillCap(active.tier)}
              </button>
            )}
            {rank > 0 && <button className="cs-refund" type="button" onClick={() => { onSkill(active); setDetail(null); }}>
              {planSkillPath(character, active).message}
            </button>}
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
