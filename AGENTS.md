# Repository Guidelines

## [CRITICAL!!] All Communications should be Korean only.

## Project Structure & Module Organization
The repo is split between a Vite-powered React client in `client/` and an Express + TypeScript API in `server/`. Shared DTOs, schemas, and utility types live in `shared/`, while Vercel serverless entry points are under `api/`. Static marketing and reference assets are stored in `attached_assets/`. Configuration for tooling (`tailwind.config.ts`, `drizzle.config.ts`, `vite.config.ts`, `tsconfig.json`) sits at the root—read these before changing build or schema behavior.

## Build, Test, and Development Commands
Use `npm run dev` to launch the Express server with the Vite dev client proxy on port 5001. `npm run build` outputs a bundled client and server-ready artifact in `dist/`, and `npm start` runs that bundle in production mode. Run `npm run vercel-build` when validating the Vercel deployment pipeline, and `npm run check` for a TypeScript-only gate. Database schema updates should be applied with `npm run db:push`, which forwards to Drizzle Kit.

## Coding Style & Naming Conventions
Stick to TypeScript across server and client files; use `.tsx` for components and `.ts` elsewhere. Follow the prevailing two-space indentation, trailing commas for multi-line literals, and double quotes in imports. Keep React components functional and colocate supporting hooks or utilities within `client/src/lib` or `client/src/hooks`. Tailwind utility classes should remain ordered from layout → spacing → color to stay readable. When touching shared models, update both the `shared/` exports and any Drizzle schema to match.

## Testing Guidelines
An automated test harness is not yet wired in, so ship changes with manual verification notes in the PR (API endpoint tested, UI path exercised). When adding new coverage, prefer colocated component tests in `client/src/__tests__/` using Vitest and server integration checks in `server/tests/` (add the scaffolding alongside your changes). Always rerun `npm run check` before submitting to catch type regressions.

## Commit & Pull Request Guidelines
Recent history favors short, imperative commit subjects (`Fix missing cors dependency`, `deploy`). Keep bodies focused on rationale when needed. For pull requests, include: scope summary, screenshots or cURL snippets for user-facing or API updates, schema migration callouts when Drizzle tables change, and linked issue references. Ensure CI scripts referenced above pass locally before requesting review.

## Environment & Integration Notes
Copy `.env.example` to `.env` and supply Spotify, OpenAI, and session secrets; run `npm run db:push` after updating schema files. Check `VERCEL_DEPLOY.md` for deployment nuances, and avoid committing real credentials—use Vercel environment variables for secrets.
