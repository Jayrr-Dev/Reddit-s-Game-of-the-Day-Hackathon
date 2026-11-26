# Game text formatting rules

These rules apply to all rules text the player reads: tooltips, chip popovers,
and the unit info window. One renderer applies them all:
[`RichText`](../src/client/components/ui/RichText.tsx). Don't style words one
tooltip at a time. Change the shared source listed below.

Normal sentence text stays muted. Only the words below stand out. Never make a
whole tooltip white.

| What | Looks like | Source |
| --- | --- | --- |
| Keywords and statuses (Shock, Frost, Melee, Guard…) | Their own colour, with their icon in front, bolded or not | `GLOSSARY_LOOK` in [`glossaryLooks.ts`](../src/client/content/glossaryLooks.ts) (built from the chip look tables in `visuals.ts`) |
| Charge, Back Step | White, with the Movement card's foot icon | `MOVEMENT_TERM_LOOK` in `glossaryLooks.ts` |
| Move, Use, Hold, Remove | Plain unless the text bolds them (they're also everyday verbs) | `VERB_TERMS` in `glossaryLooks.ts` |
| dodge, all, hit, turn (any case, with plurals) | Bold white | `EMPHASIS_WORDS` in `RichText.tsx` |
| +N% | Bold heal green (`--color-heal`) | `emphasisToneClass` in `RichText.tsx` |
| -N% | Bold HP red (`--color-hp`) | `emphasisToneClass` in `RichText.tsx` |
| N% (no sign) | Bold white | `emphasisToneClass` in `RichText.tsx` |
| I, II, III (capitals only) | Grey (`--color-tier-numeral`) | `TIER_NUMERALS` in `RichText.tsx` |
| IV | Gold (`--color-tier-top`) | `TIER_NUMERALS` in `RichText.tsx` |
| affliction(s) | Curse purple (`--color-hex`) | [`tintedWords.ts`](../src/client/content/tintedWords.ts) |
| `**bold**` markup | Bold white, or the term's colour and icon when it's a keyword | `BoldTerm` in `RichText.tsx` |

Colours are theme tokens in [`index.css`](../src/client/index.css) (`@theme`).
Never use a raw hex value.

## Adding a rule

- **A new keyword:** give it a look in `visuals.ts`. It's coloured everywhere
  automatically once it's in `GLOSSARY_LOOK`.
- **A new white word:** add it to `EMPHASIS_WORDS`.
- **A new colour:** add a token to `index.css` first.
- **The unit info window and intent popovers:** their effect headlines keep the
  effect colour ([`MoveEffect.tsx`](../src/client/components/game/MoveEffect.tsx)).
  The rules text underneath goes through `RichText`.
