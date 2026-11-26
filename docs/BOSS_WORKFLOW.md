# Unit Creation & Animation

Use this workflow for new units and animation updates in Villain Run. Deliver an approved reference, a playable preview, and either a tested live rig or a tested WebP pose strip. Art approval alone does not authorize new moves or encounters.

## 1. Define the unit and its actions

- Record the display name, stable unit ID, role, size, starting row, opening move, and signature move. Keep the existing ID when updating art or renaming a unit.
- For each animated action, mark the anticipation, release or impact, recovery, and return to idle. For bosses, decide what the player should read and counter. Keep phases, summons, and balance decisions separate from art approval.
- Put hidden canon in [Story Notes](STORY.md), not in player-facing copy.

## 2. Lock the approved reference

- Find the original approved full-body art. Keep it unchanged and use a working copy. For new units, approve a full-silhouette concept in the [Villain Run art style](../ART_STYLE.md) before animating.
- Lock the camera angle, scale, colors, silhouette, neutral stance, and weapon grip. Test the silhouette on a battle-dark background. Leave room for wing tips, weapons, tails, and other extremities, especially on wide bosses.

## 3. Choose how to animate

Use a **layered rig** when the original art should stay intact and the action can be built from attached parts: wing flaps, a planted shoulder plate, a sword swing, cloth sway, or a halo. Uriel is the reference. Use **full-body poses** when the silhouette or view changes too much for a flat rig, such as a pounce, a turn to show the back, or a new perspective. The Wolf Pack is the reference.

## 4. Layered rig workflow (Uriel)

1. **Split the approved original.** Work on a copy. Extract each painted part that must move on its own into a transparent layer. Keep one canvas and coordinate system for every layer, including transparent padding. Uriel keeps four painted WebPs: left wing, right wing, torso armor, and shield.
2. **Repair overlaps and trace the moving parts.** Rebuild just enough art under the seams that the unit never opens a hole when a limb lifts. Mask out painted parts that the rig replaces. For Uriel, the old shoulder plates are masked off the torso; arms, hand, sword, shoulder plates, ribbons, and halo are live SVG shapes traced to match the original colors and facets.
3. **Set pivots and draw order.** Pin each wing at its root, each shoulder plate to its armor attachment, and the forearm to its elbow. Attach the hand and weapon at the wrist so the grip never slides. Pin ribbons at their roots and move their free ends separately. Anchor Uriel's circular halo above her head; rotate the highlight, not the circle. Check the layering in neutral and at both ends of each motion.
4. **Choreograph one action at a time.** Build a neutral pose, anticipation, release or contact, and recovery. For Uriel's diagonal slash, lead with the elbow and follow with the blade. Keep blur on the blade during its fastest motion, not on the whole figure. Time the move to the existing game cue. Keep idle flap, float, and cloth motion separate from attack timing.
5. **Preview and inspect the live rig.** Check every action on a full-size preview and at battlefield and portrait sizes. Look for detached shoulders, holes, slipping grips, wing clipping, drifting anchors, and unwanted wobble. Verify the pose returns to neutral or holds cleanly when a charge transitions into a strike. Provide a static neutral option for reduced motion.
6. **Ship the rig, not a baked atlas.** Keep the original, editable layers, neutral pose, and demo. Compress the painted parts as transparent WebP and let the game draw the SVG parts and animate their transforms. A GIF or MP4 is for review only. Uriel's [approved demo and extraction steps](../tools/uriel/README.md), [parts and layering](../src/client/components/game/combat/UrielRigParts.tsx), [pose geometry](../src/client/lib/urielRig.ts), and [clip timing](../src/client/lib/urielMotion.ts) are the working examples.

## 5. Full-body pose workflow (Wolf Pack)

### Draw the key poses

- Generate or draw the complete unit for each key pose. Start with neutral, then create anticipation, action, impact or release, and recovery. Use the same approved reference throughout rather than stretching or rotating a cut-out hand or arm to create a new pose.
- Check hands and weapon grips, elbow and shoulder joins, feet, and the face from each angle. A rear view must show the back of the head, not a front-facing mask. Redraw bad key poses before smoothing.

### Align the transparent frames

- Give every frame the same canvas, scale, and anchor. Align planted feet to the same ground line unless the unit is intentionally airborne. Preserve transparent padding for the full travel of the action.
- Remove matte spill and inspect the transparent edges against light and dark backgrounds. Check the full silhouette at game size for clipped weapons or wings, disconnected limbs, and unintended jumps.

### Interpolate motion before export

- Keep an untouched copy of the aligned keyframes. Interpolate between clean poses on a 24 fps timeline without changing the original move duration, release, or impact timing.
- Default to **animating on threes**: hold each drawing for three frames at 24 fps (one pose slot every 125 ms). Keep the clearest pose in each slot, prioritizing the contact, release, and readable smears. Use twos or ones only where a faster cadence reads better and is approved.
- Replay the result at game speed, then step through the distinct poses. Remove doubled weapons, warped grips, shifting feet, or accidental ghosting. Replace the bad pose with a clean adjacent drawing or intentional hold rather than shortening the clip.
- On fast swings and spins, add directional smears to the in-between frames. Keep the held poses, weapon release, and impact sharp so the move still reads clearly.
- Replace bad in-betweens with clean drawn poses or keep a sharp transition where a hit or abrupt turn needs it. Do not blend across a cut, a deliberate impact hold, or mismatched silhouettes just to increase frame rate.

### Preview and export WebP

- Send a 24 fps preview with the full character in frame. Generate character poses on transparent backgrounds. Deliver character GIFs with real transparency from the first review; don't bake in a matte, checkerboard, or scenery. An optional MP4 can show exact cadence against a test backdrop. Check that attacks return to neutral and idle loops have no visible seam.
- Export the checked sequence as a transparent WebP sprite strip or animated WebP, matching the playback component. Put the game asset under `src/client/assets/heroes/`, keep the static neutral sprite, and retain the editable source and GIF outside the runtime bundle.
- Decode the final WebP to verify transparency, frame count and order, dimensions, file size, and timing. Attacks should play once and return to idle; ambient or idle clips may loop. Use a stable static sprite for reduced motion.

## 6. Integrate and test in the game

- Define new units and moves in `src/shared/game/heroes.ts`. For new bosses, register a solo Training scenario in `src/shared/game/sandbox.ts` before placing the unit in Conquest.
- Register the drawing in `CreatureFigure.tsx` and the creature look in `heroLooks.ts`. Check `figureBounds.ts` if padding or overflow changes the Training portrait. Keep the unit centered under its nameplate in both front and back rows.
- Bind the animation to the intended move and sync its release or impact with existing combat beats, projectiles, sounds, and effects. Keep damage and boss phase decisions in the shared rules. Add an entrance, arena, music, or new cues only when the encounter calls for them.
- Test in Illusion Training at narrow and wide sizes. Check the picker, entrance, action timing, idle return, repeat attacks, defeat, retry, reduced motion, and sprite cropping. Add tests for new boss formations, opening moves, phase transitions, and summon limits as applicable.

## 7. Verify and release

- Run `npm run test:unit`, `npm run test:types`, and `npm run build`. Review the staged art, code, and documentation changes; keep unrelated work out.
- Integrate the latest main without force-pushing and record the exact commit. Publishing is a separate step: when releasing to Reddit, verify the installed build in the actual playtest and report the version and link.
