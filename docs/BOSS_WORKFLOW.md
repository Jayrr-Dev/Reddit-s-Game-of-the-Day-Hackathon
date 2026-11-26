# Boss Workflow

## 1. Define the fight

- Record the boss's name, role, size, starting row, opening move, and signature move.
- Decide what the player is meant to read and counter. Keep phases, summons, and balance changes separate from art approval.
- Put hidden story canon in [Story Notes](STORY.md), not in copy players will see.

## 2. Approve the art

- Start with a full-silhouette concept in the [Villain Run art style](../ART_STYLE.md). Show it against a battle-dark background before integrating it.
- Preserve the source. Export a transparent WebP into `src/client/assets/heroes/` for the game. Check the wing tips, weapons, base, and other extremities on all four edges. Keep visual margins, especially on wide bosses.
- If a boss needs animation, keep movable parts separate in the source rig. Check the idle loop, first anticipation pose, impact, and return to idle. For Uriel, keep the elbow lead, diagonal blade path and blade-only blur, with the halo, armor and hand anchored.
- Asset-only approval does not make a boss playable. Add moves or encounters only when intended.

## 3. Wire up the encounter

- Define the unit and first move in `src/shared/game/heroes.ts`. Register a solo Training scenario in `src/shared/game/sandbox.ts` before placing it in Conquest.
- Register the drawing in `CreatureFigure.tsx`, add its creature look in `heroLooks.ts`, and check the Training portrait bounds in `figureBounds.ts` if the art carries padding or overflows.
- Add an entrance, arena, music, or move cues only where the design calls for them. Sync the attack visuals and sounds to the existing combat beats; keep damage and boss phase decisions in the shared game rules.
- Anchor the figure under the nameplate. Inspect front and back rows, the Training picker, and a solo fight at both narrow and wide playtest sizes.

## 4. Verify and merge

- Add tests for the opening formation and move, plus any phase transition or summon limit.
- Run `npm run test:unit`, `npm run test:types`, and `npm run build`. In the playtest, start a fresh Training fight and check the entrance, action timing, defeat, sprite cropping, and retry.
- Review the staged diff, including WebP art and docs. Keep unrelated work out, integrate the latest main without force-pushing, and report the exact commit. Publishing a new Reddit build is a separate step.
