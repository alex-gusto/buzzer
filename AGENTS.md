# Repository Guidelines

## Project Structure & Module Organization
This npm workspace contains two packages: `apps/client` for the Vite + React UI and `apps/server` for the Fastify WebSocket API. Client code lives in `src/` with feature folders under `components/host`, shared `hooks/`, and plain TypeScript utilities. Server logic is split across `src/store.ts`, `roomRegistry.ts`, and `messages.ts`, with fallback trivia data in `apps/server/fallback`. Build outputs collect in `dist/`, while helper scripts (LAN dev, trivia refresh) sit in `scripts/`.

## Build, Test, and Development Commands
Run `npm run dev` from the repo root to launch both services with hot reload. Use `npm run dev:server` or `npm run dev:client` when only touching one side, and `npm run dev:client:lan` to expose the UI over your network. `npm run build` wipes `dist/` and rebuilds both packages; follow with `npm run start` to serve the compiled server. Refresh fallback trivia via `npm run fetch:trivia`. For static QA, run `npm --prefix apps/client run preview`.

## Coding Style & Naming Conventions
TypeScript is strict everywhere, so keep types explicit and avoid `any`. Components and files should stay PascalCase (`HostActiveQuestionCard.tsx`), hooks use the `useX` prefix, and utility modules remain camelCase. The server keeps flat files per concern—extend existing modules before introducing new folders. Use two-space indentation, prefer double quotes, and keep ESM `.js` import extensions so tsx/esbuild interop stays intact.

## Testing Guidelines
No automated tests exist yet; add coverage with Vitest on the client or Fastify’s inject API for the server. Store client specs beside the component under `apps/client/src` and server specs under `apps/server/src/__tests__`. Document any manual runs in your PR, especially multi-player flows, websocket reconnects, and fallback trivia.

## Commit & Pull Request Guidelines
Commit messages are imperative and short (e.g. `add questions fallback`, `tighten host errors`). Keep PRs focused, include a change summary, test notes, and link issues as needed. Attach screenshots or clips for UI tweaks and call out new env vars or scripts. Request review from both client and server owners when the change crosses packages.

## Configuration Notes
The server reads `.env` at the repo root; define `TRIVIA_API_BASE` when pointing at a different trivia provider. Regenerate fallback JSON with the fetch script after schema or content updates and commit the refreshed files. Deployments should copy `dist/` alongside `apps/server/fallback` so offline trivia remains available.
