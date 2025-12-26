# Repository Guidelines

## Project Structure & Module Organization
Liquid Glass blends a Vite React renderer with an Electron shell. Core UI code lives in `src/` (`main.tsx` bootstraps React, `components/` holds reusable widgets, and `assets/` stores static media). Electron entry points (`electron/main.ts` and `electron/preload.ts`) manage the window lifecycle, IPC, screen capture, and Groq requests. Public HTML, fonts, and icons stay under `public/`. Build artifacts land in `dist/` and `dist-electron/`, while `build/` and `release/` directories are generated outputs—never edit them directly.

## Build, Test, and Development Commands
- `npm install` — sync dependencies before any change.
- `npm run dev` — start the Vite dev server plus Electron via `vite-plugin-electron`; the renderer hot-reloads while IPC methods stay live.
- `npm run build` — run `tsc -b`, bundle the renderer, and package the Electron app with `electron-builder` (outputs to `release/<version>`).
- `npm run preview` — serve the built renderer for quick smoke checks without Electron.
- `npm run lint` — enforce ESLint rules defined in `eslint.config.js`.

## Coding Style & Naming Conventions
Use TypeScript, favor functional React components, and keep indentation at two spaces. Prefer single quotes for strings, destructure props early, and avoid default exports except for root entry points. Name files in `PascalCase.tsx` for components, `camelCase.ts` for hooks/utils, and append `.css` for scoped styles. Run `npm run lint` before committing; fix warnings by aligning with the shared ESLint + `@typescript-eslint` configuration.

## Testing Guidelines
Automated tests are not yet wired in; new contributors should add Vitest + React Testing Library suites under `src/__tests__/*` with filenames like `ComponentName.test.tsx`. Until tests exist, perform manual regression passes: launch `npm run dev`, exercise chat input, transcript capture, screenshot toggling, and Groq responses, then document results in the PR. Aim for high-coverage unit tests when the harness lands; gate merges on green runs of `npm test` once available.

## Commit & Pull Request Guidelines
Write imperative, concise commit subjects (e.g., `Improve Groq error surfacing`) followed by an optional body explaining rationale and user impact. For pull requests, include: scope summary, screenshots or screen recordings for UI changes, manual test notes (commands run + outcomes), and links to any tracked issues. Keep PRs focused; coordinate breaking changes via an issue first.

## Configuration & Secrets
Store API keys (Groq, screen-capture entitlements) in a local `.env`; NEVER commit secrets. Electron preload limits exposed APIs, so add new IPC channels via `contextBridge` and document expected inputs/outputs in the PR.
