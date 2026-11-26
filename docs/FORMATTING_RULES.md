# Game text formatting rules

These rules apply to all rules text the player reads: tooltips, chip popovers,
and the unit info window. One renderer applies them all:
[`RichText`](../src/client/components/ui/RichText.tsx). Don't style words one
tooltip at a time. Change the shared source listed below.

Normal sentence text stays muted. Only the words below stand out. Never make a
whole tooltip white.

**The colour rule:** keywords with a chip wear their own colour and icon. Game
mechanic words (hand, stack, block, dodge…) and numbers are white. Damage is
red, gains are green, and losses are red.

| What | Looks like | Source |
| --- | --- | --- |
| Keywords and statuses (Shock, Frost, Melee, Guard…) | Their own colour, with their icon in front, bolded or not | `GLOSSARY_LOOK` in [`glossaryLooks.ts`](../src/client/content/glossaryLooks.ts) (built from the chip look tables in `visuals.ts`) |
| Charge, Back Step | White, with the Movement card's foot icon | `MOVEMENT_TERM_LOOK` in `glossaryLooks.ts` |
| Move, Use, Hold, Remove | Plain unless the text bolds them (they're also everyday verbs) | `VERB_TERMS` in `glossaryLooks.ts` |
| Game mechanic words: all, block, deck, discard, dodge, draw, hand, hit, miss, stack, turn (any case, with -s/-es/-ed) | Bold white | `MECHANIC_WORDS` in `RichText.tsx` |
| damage (any case) | Bold HP red (`--color-hp`) | `DAMAGE_WORDS` in `RichText.tsx` |
| Any other number (5, 1.5, 4×3=12) | Bold white, unless a rule above colours it | `AUTO_EMPHASIS` in `RichText.tsx` |
| +N% | Bold heal green (`--color-heal`) | `emphasisToneClass` in `RichText.tsx` |
| -N% | Bold HP red (`--color-hp`) | `emphasisToneClass` in `RichText.tsx` |
| N% (no sign) | Bold white | `emphasisToneClass` in `RichText.tsx` |
| I, II, III (capitals only) | Grey (`--color-tier-numeral`) | `TIER_NUMERALS` in `RichText.tsx` |
| IV | Gold (`--color-tier-top`) | `TIER_NUMERALS` in `RichText.tsx` |
| affliction(s) | Curse purple (`--color-hex`) | [`tintedWords.ts`](../src/client/content/tintedWords.ts) |
| One rule per line (`\n` in the text) | A bullet list; a single line stays a plain sentence. Keep each bullet to one short rule (see Shock in `describe.ts`) | `RichText` in `RichText.tsx` |
| `**bold**` markup | Bold white, or the term's colour and icon when it's a keyword | `BoldTerm` in `RichText.tsx` |

Colours are theme tokens in [`index.css`](../src/client/index.css) (`@theme`).
Never use a raw hex value.

## Adding a rule

- **A new keyword:** give it a look in `visuals.ts`. It's coloured everywhere
  automatically once it's in `GLOSSARY_LOOK`.
- **A new white word:** add it to `MECHANIC_WORDS` if it's a game mechanic. A new red damage word goes in `DAMAGE_WORDS`.
- **A new colour:** add a token to `index.css` first.
- **The unit info window and intent popovers:** their effect headlines keep the
  effect colour ([`MoveEffect.tsx`](../src/client/components/game/MoveEffect.tsx)).
  The rules text underneath goes through `RichText`.

## Card keywords

Each keyword's words live in `KEYWORD_INFO` in
[`describe.ts`](../src/shared/game/describe.ts) and its icon in `KEYWORD_LOOK`
in [`visuals.ts`](../src/client/content/visuals.ts).

| Keyword | Icon and colour | Rule |
| --- | --- | --- |
| Hold | Padlock, accent | Stays in your hand at the end of the turn |
| Piercing | Arrowhead, accent | Hits a whole column; ignores Armor, Protection and Guard |
| Remove | Burning card, muted | Out for the rest of the fight once played |
| Use N/3 (Exhaust) | Ghost, muted | Limited plays per run, then the copy Exhausts |
| Charge | Sword, Movement | Moves forward before attacking and gains Momentum |
| Rampage | Battle axe, HP red | Charge on kill; Momentum bonus doubled |
| Distance | Sprint, Range | Free Back Step on hit |
| Longrange | Eye, Range | Ignores Out of Range |
| Unique | Crown, accent | Only one copy can be in your deck. The rule lives in [`unique.ts`](../src/shared/game/unique.ts): the deck builder, saved decks, starter decks and card rewards all check it there. No imbue grants it. |
