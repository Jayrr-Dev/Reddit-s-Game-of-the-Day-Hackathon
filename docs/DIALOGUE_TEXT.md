# Dialogue text effects

The local React components are adapted from the Standards UI registries for [Text Effect](https://standardsui.com/r/text-effect.json) and [Mood Text](https://standardsui.com/r/mood-text.json). No shadcn setup or new runtime dependency is required.

- `src/client/components/ui/standards/text-effect.tsx` exports the typewriter, text reveal, fade, pop, wiggle, dots, and speed components.
- `src/client/components/ui/standards/mood-text.tsx` exports mood presets and per-phrase highlights.

For an unvoiced line, start with a one-shot typewriter and a hidden caret:

```tsx
<TextTypewriter text="The door only opens from this side." typeMs={24} caret={false} />
```

To emphasize a word without styling the whole line, keep the mood neutral and pick one highlight:

```tsx
<MoodText highlights={[{ phrase: 'the toll', effect: 'goldGlow' }]}>
  Then you already know the toll.
</MoodText>
```

Keep timed voice captions as plain text so they stay synced with audio. Test wrapping, skip behavior, and reduced motion when applying effects inside an actual dialogue component.
