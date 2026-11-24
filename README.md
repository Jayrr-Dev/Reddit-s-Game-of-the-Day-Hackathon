# Villain Run

An entry for **[Reddit's Game of the Day Hackathon](https://redditgameofday2026.devpost.com/)**: a daily game that runs inside a Reddit post, built on Reddit's Developer Platform ([Devvit Web](https://developers.reddit.com/docs/capabilities/devvit-web/devvit_web_overview)).

> **Status:** playable. Villain Run is an endless daily deckbuilder. The heroes killed your lover, and now you march on their kingdom. Everyone faces the same seeded horde each day.

---

## How to play

- **Goal:** push as deep into the kingdom as you can. The heroes never stop coming, so every run ends. Your score is how far you got.
- **Fights:** each turn you have 3 energy and draw 5 cards. Tap a hero to target it, then tap cards to play them. Every hero shows its next move, so raise **Shroud** (block) before big hits. **Hex** deals damage each turn, **Dread** weakens attacks and **Wrath** strengthens every hit.
- **The road:** after each stop you choose one of two paths: a hero horde, an elite, her grave (heal or gain max HP) or the dark altar (a rare card). After a won fight you add 1 of 3 cards to your deck.
- **Regions:** every 5th stop a champion guards the region. Beat them to conquer it: Border Village, King's Road, Monastery, Castle Gates, Royal Court, then the Throne Room. After that, uprisings keep coming, and the heroes get stronger.
- **Daily:** the date seeds the whole run, so everyone gets the same paths, hordes and card offers. Your first run each day is ranked, and later runs are practice. The server replays your moves to verify the score (100 per wave, 10 per hero slain, 500 per region).

---

## Hackathon at a glance

|                       |                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Submissions**       | Nov 11, 2026 12:00 PM PT → **Tue Dec 8, 2026 6:00 PM PT** (9:00 PM ET)                                                                                                                |
| **Judging**           | Dec 9 to Dec 16, 2026                                                                                                                                                                 |
| **Winners announced** | about Dec 17, 2026, 3:00 PM PT                                                                                                                                                        |
| **Prizes**            | $35,000 total: Best Daily Game $15,000 · Best Ported Daily Game $6,000 · 10 Honorable Mentions at $1,000 · Devvit Helper $500 (x6) · Feedback Award $200 (x5). One prize per project. |

Sources: [overview](https://redditgameofday2026.devpost.com/), [rules](https://redditgameofday2026.devpost.com/rules), [resources](https://redditgameofday2026.devpost.com/resources).

### What must be built

- A **new daily game** for Reddit, built with **Devvit Web** as an **interactive post**. Projects that existed before Nov 11, 2026 must be substantially updated and say what changed.
- It must install and run reliably, and match what the video and description show.
- It must follow the [Devvit Rules](https://developers.reddit.com/docs/devvit_rules) and the [Developer Terms](https://redditinc.com/policies/developer-terms).
- English, or English translations of the video, description and testing instructions.

### What to submit on Devpost

1. **App listing link**: `https://developers.reddit.com/apps/<app-name>` (it exists after the first `devvit upload`).
2. **Demo post**: a link to a post running the game in a **public test subreddit with fewer than 200 members**. Judges score from this link, so it must explain itself. If the subreddit is private, install [dr-admin-approve](https://developers.reddit.com/apps/dr-admin-approve) so judges are let in automatically.
3. **Text description** of the features.
4. **This README** in the app root, describing the game and how to play.
5. Optional: a **demo video under 1 minute** (public on YouTube, Vimeo, Facebook Video or Youku), the **repo URL**, and the **feedback survey** for the Feedback Award.

Do **not** run `devvit publish` / `npm run launch` for the hackathon. Keep the app uploaded and playtestable, and keep it free and available until judging ends on Dec 16.

### How it's judged

Stage one is pass or fail: the entry has to fit the theme and actually use Devvit. Stage two weighs four criteria equally:

1. **Delightful UX**: fun to discover, with a strong layout and theme.
2. **Polish**: close to publishable and compliant with the Devvit Rules. Judges should understand it from the demo post.
3. **Reddity**: community-minded with its own identity. "About Reddit" (karma, Snoo jokes) is not the same as Reddity.
4. **Daily content**: fresh, recurring challenges that bring people back.

**Stands out:** intuitive onboarding, visual craft, well-calibrated daily content, focused gameplay, clear end states and reasons to come back tomorrow, and **[Devvit Journeys](https://developers.reddit.com/docs/capabilities/analytics/devvit-journeys)** instrumentation. Flair, comments, snoovatars and streaks earn bonus points.

**Avoid:** obvious AI slop, on-the-nose Reddit theming, and over-used ideas (space shooters, clones of popular games, simple platformers, collaborative storytelling, trivia).

---

## Setup (your steps)

These steps need your own accounts, so they are not automated.

1. **Install Node.js 24.18 or later** (Devvit requires it; `.nvmrc` pins `24.18.0`). With nvm: `nvm install && nvm use`.
2. **Install dependencies**: `npm install`.
3. **Create a Reddit developer account** at [developers.reddit.com](https://developers.reddit.com) and **register for the hackathon** on [Devpost](https://redditgameofday2026.devpost.com/).
4. **Log in to the Devvit CLI**: `npm run login` (runs `devvit login` and opens a browser).
5. **Pick a unique app name.** `devvit.json` and `package.json` use the placeholder `daily-gotd`. Change both if the name is taken, before the first upload.
6. **Playtest**: `npm run dev`. On the first run Devvit creates a private dev subreddit (`r/<app-name>_dev`) and a test post, then prints the URL. To use your own subreddit, change the `dev` script to `devvit playtest r/<your_subreddit>`.
7. **Create the public demo subreddit** (under 200 members) for judging, install the app there, and use the mod menu item **"Create today's post"**.
8. **Request Journeys approval.** Journey events are dropped until Reddit approves the app's journey map. Ask in the [Devvit Discord](https://discord.gg/ZJQ3fmQVrm) or [r/devvit](https://www.reddit.com/r/devvit/).

## Scripts

| Command              | What it does                                                                |
| -------------------- | --------------------------------------------------------------------------- |
| `npm run dev`        | Playtest on Reddit with live reload (`devvit playtest`)                     |
| `npm run build`      | Build client and server into `dist/`                                        |
| `npm run type-check` | TypeScript project-references check                                         |
| `npm run lint`       | ESLint                                                                      |
| `npm run test:unit`  | Unit tests for pure logic (`src/**/*.test.ts`, Node test runner)            |
| `npm run deploy`     | Type check, lint, then `devvit upload` (creates or updates the app listing) |
| `npm run prettier`   | Format everything                                                           |

---

## Architecture

```
devvit.json            App config: entrypoints, menu, triggers, daily cron, permissions
src/
  shared/              Used by both sides; no Devvit imports
    constants/game.ts  Game title, leaderboard size, Redis retention (the single source of truth)
    types/api.ts       Request and response types for every /api route
    utils/             Pure logic + tests: daily key (UTC date), streak rules
  server/              Runs on Devvit's serverless Node runtime
    index.ts           Hono app + Journeys bridge, served by Devvit's createServer
    routes/            Thin HTTP handlers: api, menu, triggers, scheduler
    core/              Domain logic: dailyPost, leaderboard, streaks, redisKeys
    http/              Error helpers, Express-to-Hono bridge for Journeys
  client/              Runs in the post's iframe
    game.tsx           The game, played inline in the post (512 px tall)
    components/        Screens, PlaceholderGame, LeaderboardList, ui/ atoms
    hooks/             useDailyGame, useLeaderboard
    lib/               apiClient (only place that calls fetch), journeys, mountApp
    index.css          Design tokens (@theme); components never use raw colors
```

### Daily loop

1. **A new post every day.** A cron task in `devvit.json` (`0 0 * * *`, midnight UTC) calls `/internal/scheduler/daily-post`. That creates the day's post and stores the day in its `postData`. Installing the app and the mod menu item use the same `ensureDailyPost()`, so no day gets two posts.
2. **One shared day for everyone.** The "daily key" is the UTC date (`YYYY-MM-DD`), so every player worldwide gets the same challenge at the same time. A post always serves its own day, even when opened weeks later.
3. **Scores.** `POST /api/score` keeps each player's best score for the day in a Redis sorted set. `GET /api/leaderboard` returns the top 10.
4. **Streaks.** These count consecutive real days played. The rules are pure functions in `shared/utils/streak.ts` with unit tests; Redis only stores the result.
5. **Analytics.** `lib/journeys.ts` sends `App.Ready` when the game loads, `Journey.Start` on Play, `Journey.Progress` at milestones and `Journey.End` with the win and score. Reddit's Express telemetry router runs next to Hono under `/api/telemetry/*` (see `server/http/telemetryBridge.ts`).

### Adding the real game

Replace `src/client/components/PlaceholderGame.tsx` and keep its contract: call `onFinish(score)` once when a run ends, and fire `journeys.start()` / `progress()` / `end()` on committed actions (never on page load). For per-day content such as a seeded puzzle, derive it from the post's daily key on the server and add a field to `InitResponse`.

---

## Credits

Icons from [game-icons.net](https://game-icons.net) by Lorc, Sbed, Carl Olsen, Skoll and Delapouite, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The picks and their sources are listed in `src/client/content/gameIcons.ts`.

## Useful links

- Docs: [Quickstart](https://developers.reddit.com/docs/quickstart/) · [Devvit Web](https://developers.reddit.com/docs/capabilities/devvit-web/devvit_web_overview) · [Building games](https://developers.reddit.com/docs/introduction/intro-games) · [Templates](https://developers.reddit.com/docs/examples/template-library) · [LLM docs index](https://developers.reddit.com/docs/llms.txt)
- Community: [r/devvit](https://www.reddit.com/r/devvit/) · [Devvit Discord](https://discord.gg/ZJQ3fmQVrm) · [r/GamesOnReddit](https://www.reddit.com/r/gamesonreddit/)
- Example daily games: [r/HotAndCold](https://www.reddit.com/r/HotAndCold/) · [r/ColorPuzzleGame](https://www.reddit.com/r/ColorPuzzleGame) · [r/syllo](https://www.reddit.com/r/syllo/) · [r/pocketgrids](https://www.reddit.com/r/pocketgrids/)
- Past galleries: [Community Games 2025](https://communitygames2025.devpost.com/project-gallery) · [Games & Puzzles](https://redditgamesandpuzzles.devpost.com/project-gallery)

Based on Reddit's [devvit-template-react](https://github.com/reddit/devvit-template-react) (BSD-3-Clause).
