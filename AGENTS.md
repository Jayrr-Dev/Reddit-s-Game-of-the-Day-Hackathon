You are writing a Devvit web application that will be executed on Reddit.com.

## Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, Vite
- **Backend**: Node.js serverless environment (Devvit), Hono, Redis via `@devvit/web/server`
- **Communication**: plain `fetch` to `/api/*`; request/response types live in `src/shared/types/api.ts`
- **Analytics**: Devvit Journeys via `@devvit/analytics` (client wrapper in `src/client/lib/journeys.ts`)

## Layout & Architecture

- `/src/server`: **Backend Code**. This runs in a secure, serverless environment.
  - `index.ts`: Main server entry point (Hono app + Journeys bridge).
  - `routes/`: Thin HTTP handlers (api, menu, triggers, scheduler).
  - `core/`: Domain logic (daily post, leaderboard, streaks). `core/redisKeys.ts` is the only place Redis keys are built.
  - `http/`: Cross-cutting HTTP helpers (errors, telemetry bridge).
  - Access `redis`, `reddit`, and `context` here via `@devvit/web/server`.
- `/src/client`: **Frontend Code**. This is executed inside of an iFrame on reddit.com
  - To add an entrypoint, create a HTML file and add to the mapping inside of `devvit.json`
  - Entrypoints:
    - `game.html`: The only entry point. The whole game plays inline in the post (the `tall` height, 512 px), because few players open the expanded view. Every screen must fit 512 px tall and 288 to 880 px wide, with taps only (no drag or swipe, so the feed still scrolls).
  - `components/ui/`: Atoms (Button, Screen, StatTile). Style only through the design tokens in `index.css`.
  - `hooks/`: Data hooks. `lib/apiClient.ts` is the only place that calls `fetch`.
- `/src/shared`: **Shared Code**. Constants, API types, and pure functions (with `*.test.ts` next to them). Relative imports inside `src/shared` use the `.ts` extension so `node --test` can run them.

## Frontend

### Rules

- Instead of `window.location` or `window.assign`, use `navigateTo` from `@devvit/web/client`

### Images

- Every raster image gets a small placeholder on the first render; the full image swaps in once it has loaded. Never render a full-size image directly.
- Use `ProgressiveImg` (for `<img>`) and `ProgressiveSvgImage` (for SVG `<image>`) from `components/ui/ProgressiveImage.tsx`. These blur-to-sharp (`<img>`) or cross-fade (SVG) into the full image; timing and blur live in the `--image-reveal-ms` and `--image-placeholder-blur` tokens. For an inline `backgroundImage` style, pass the URL through `useProgressiveImage` and use its `src` (and `isPlaceholder` if the element can blur without blurring its content).
- After adding or changing any `.webp`/`.png`/`.jpg` under `src/client/assets`, run `npm run images:placeholders` and commit the regenerated `src/client/lib/imagePlaceholders.generated.ts`. Images without an entry still work, but show nothing until they load.
- Keep file stems unique across asset folders (placeholders are keyed by file name). Prefer `.webp` sized near how big the art is drawn.

### Limitations

- `window.alert`: Use `showToast` or `showForm` from `@devvit/web/client`
- File downloads: Use clipboard API with `showToast` to confirm
- Geolocation, camera, microphone, and notifications web APIs: No alternatives
- Inline script tags inside of `html` files: Use a script tag and separate js/ts file

## Commands

- `npm run type-check`: Check typescript types
- `npm run build`: Build client and server into `dist/`
- `npm run test:unit`: Run unit tests (`src/**/*.test.ts`)
- `npm run lint`: Check the linter
- `npm run test -- my-file-name`: Run tests isolated to a file

## Code Style

- Prefer type aliases over interfaces when writing typescript
- Prefer named exports over default exports
- Never cast typescript types (the one exception is the typed network boundary in `lib/apiClient.ts`)
- Label files, sections and groups of variables with CAPITAL CASE comments (`// --- SECTION ---`) and give every function a short comment
- Keep functions short and components small; extract logic into hooks (client) or `core/` (server)
- No hardcoded values: shared constants go in `src/shared/constants`, colors in the `@theme` tokens

## Global Rules

- You may find code that references blocks or `@devvit/public-api` while building a feature. Do NOT use this code as this project is configured to use Devvit web only.
- Whenever you add an endpoint for a new menu item action, ensure that you've added the corresponding mapping to `devvit.json` so that it is properly registered

Docs: https://developers.reddit.com/docs/llms.txt.
