# Unit Creation & Animation

Use this workflow for new units and animation updates in Villain Run. The deliverables are an approved reference, a review GIF, and a tested in-game WebP asset. Art approval alone does not authorize new moves or encounters.

## 1. Define the unit and its actions

- Record the display name, stable unit ID, role, size, starting row, opening move, and signature move. Keep the existing ID when updating art or renaming a unit.
- For each animated action, mark the anticipation, release or impact, recovery, and return to idle. For bosses, decide what the player should read and counter. Keep phases, summons, and balance decisions separate from art approval.
- Put hidden canon in [Story Notes](STORY.md), not in player-facing copy.

## 2. Lock the approved reference

- Find the original approved full-body art. Keep it unchanged and use a working copy. For new units, approve a full-silhouette concept in the [Villain Run art style](../ART_STYLE.md) before animating.
- Lock the camera angle, scale, colors, silhouette, neutral stance, and weapon grip. Test the silhouette on a battle-dark background. Leave room for wing tips, weapons, tails, and other extremities, especially on wide bosses.

## 3. Draw the full-body key poses

- Generate or draw the complete unit for each key pose. Start with neutral, then create anticipation, action, impact or release, and recovery. Use the same approved reference throughout rather than stretching or rotating a cut-out hand or arm to create a new pose.
- Check hands and weapon grips, elbow and shoulder joins, feet, and the face from each angle. A rear view must show the back of the head, not a front-facing mask. Redraw bad key poses before smoothing.
- For a unit that already uses a layered rig, preserve its source layers and pivots. For Uriel, keep the elbow lead, diagonal blade path, and blade-only blur; keep her halo, armor, and hand anchored.

## 4. Align the transparent frames

- Give every frame the same canvas, scale, and anchor. Align planted feet to the same ground line unless the unit is intentionally airborne. Preserve transparent padding for the full travel of the action.
- Remove matte spill and inspect the transparent edges against light and dark backgrounds. Check the full silhouette at game size for clipped weapons or wings, disconnected limbs, and unintended jumps.

## 5. Interpolate motion before export

- Keep an untouched copy of the aligned keyframes. Run motion interpolation between clean poses to generate in-between frames. Try 24–30 fps for review while keeping the original move duration and release or impact timing.
- Replay the result at game speed. If anything looks off, step through the generated frames and compare them to the original keyframes. Look for unwanted ghosting, doubled weapons, warped grips, shifting feet, and flickering transparency.
- On fast swings and spins, add directional smears to the in-between frames. Keep the held poses, weapon release, and impact sharp so the move still reads clearly.
- Replace bad in-betweens with clean drawn poses or keep a sharp transition where a hit or abrupt turn needs it. Do not blend across a cut, a deliberate impact hold, or mismatched silhouettes just to increase frame rate.

## 6. Preview the GIF and export WebP

- Send a GIF preview with the full character in frame. Check that attack clips return to neutral and that idle loops have no visible seam. Review the animation and resolve any art corrections before replacing the live asset.
- Export the checked sequence as a transparent WebP sprite strip or animated WebP, matching the playback component. Put the game asset under `src/client/assets/heroes/`, keep the static neutral sprite, and retain the editable source and GIF outside the runtime bundle.
- Decode the final WebP to verify transparency, frame count and order, dimensions, file size, and timing. Attacks should play once and return to idle; ambient or idle clips may loop. Use a stable static sprite for reduced motion.

## 7. Integrate and test in the game

- Define new units and moves in `src/shared/game/heroes.ts`. For new bosses, register a solo Training scenario in `src/shared/game/sandbox.ts` before placing the unit in Conquest.
- Register the drawing in `CreatureFigure.tsx` and the creature look in `heroLooks.ts`. Check `figureBounds.ts` if padding or overflow changes the Training portrait. Keep the unit centered under its nameplate in both front and back rows.
- Bind the animation to the intended move and sync its release or impact with existing combat beats, projectiles, sounds, and effects. Keep damage and boss phase decisions in the shared rules. Add an entrance, arena, music, or new cues only when the encounter calls for them.
- Test in Illusion Training at narrow and wide sizes. Check the picker, entrance, action timing, idle return, repeat attacks, defeat, retry, reduced motion, and sprite cropping. Add tests for new boss formations, opening moves, phase transitions, and summon limits as applicable.

## 8. Verify and release

- Run `npm run test:unit`, `npm run test:types`, and `npm run build`. Review the staged WebP, code, and documentation changes; keep unrelated work out.
- Integrate the latest main without force-pushing and record the exact commit. Publishing is a separate step: when releasing to Reddit, verify the installed build in the actual playtest and report the version and link.
