# AGENTS.md

## Project identity

- Wails v3 desktop AI application (Windows-first, cross-platform where practical)
- React + TypeScript + Vite frontend (shadcn/ui, Base UI, Tailwind v4, transitions.dev)
- Go backend (SQLite, keychain, filesystem/PTY/sandbox, native services)
- Agent orchestration is TypeScript (OpenAI Agents SDK, Zod v4, MCP)
- Goal: high-performance ChatGPT / T3-Chat-style desktop app. Performance and native quality are first-class, not afterthoughts.

## Ownership rules — where code belongs

### React / components owns
- Rendering, input, ephemeral UI state, interaction/animation state, local composition
- **Does NOT own**: durable persistence, filesystem, keychain, provider orchestration, tool execution, indexing/search, long-running or CPU-heavy work

### Zustand owns
- Only shared application state that genuinely needs to be global
- Prefer domain stores: `chat`, `settings`, `providers`, `workspace`, `agent/tool`
- Keep stores small; selectors must be narrow and stable (`s => s.messages` not `s => s`)
- Never put temporary component state in Zustand
- Never duplicate server/backend state across multiple stores

### Frontend services (`src/services/`) owns
- Thin Wails bridge adapters — `ChatService`, `ProviderService` wrappers
- All native calls MUST go through `services/`; never import `../../bindings/...` directly from components/stores/features
- Provider lifecycle (initial sync, save-queue sequencing, delete coordination, API-key status, selection) belongs to `features/providers` (`hooks/use-provider-sync.ts`), not `app/App.tsx`
- Provider persistence is serialized through the provider lifecycle owner (`enqueueProviderSave` queue). Do not bypass the ordered save path with direct `saveProviderBackend` writes.
- Do not place substantial business logic in random service files if it belongs in Go

### Go services (`internal/`) owns
- SQLite, filesystem, PTY, OS integration, credential storage, sandbox lifecycle, native services
- Domain-oriented packages: `internal/chat`, `internal/database`, `internal/providers`, (future) `agents/`, `tools/`, `workspace/`, `git/`, `filesystem/`, `platform/`
- Keep services domain-oriented, narrow Wails APIs, repositories separate from orchestration
- Do not put prompts, model logic, agent orchestration, or conversation behavior in Go
- Model generation: active path is frontend `agent/text-generation.ts` via AI SDK streaming + provider credentials via `services/providers.ts` adapter. Go `GenerateReply` was removed as dead. Do not introduce a second Go streaming path without explicit justification.

### Components / hooks / shared
- `components/ui` = shadcn primitives only
- Feature components belong inside `features/<domain>/components`
- Shared application components in `components/shared` only if used by >=2 features
- Hooks: extract when they encapsulate reusable behavior or lifecycle complexity (streaming lifecycle, keyboard shortcuts, scroll restoration, virtualizer, platform integration). Do not turn every `useEffect` into a hook.
- `lib/` = pure utilities (no UI, no state). No dumping ground `utils.ts` >50 lines.

### Platform-specific code
- Isolate in `lib/platform` or `services/platform` with `windows/`, `macos/`, `linux/` submodules
- Do not branch on `platform` throughout every component. Do not fork the whole frontend per platform.

## Architecture rules

- `App.tsx` is application composition (`app/App.tsx: ~190 LOC` after provider extraction): bootstrap → domain hooks (`features/providers/hooks/use-provider-sync.ts`) → layout → feature composition. Do not add provider orchestration or other domain lifecycle there.
- No god components / services / stores. If file approaches ~250 LOC, split on a meaningful boundary (not just to hit a number).
- Prefer feature/domain ownership over flat folders. One clear responsibility per module.
- Reuse real concepts, not arbitrary code fragments. Do not create generic components with enormous prop APIs to save a few lines. Prefer clear domain-specific reuse.
- Avoid speculative abstractions; do not create an abstraction used once unless it establishes a useful boundary (e.g., Wails adapter, dialog shell).
- Keep APIs narrow. Remove dead APIs/parameters rather than leaving them ignored (e.g., remove unused `GenerateReply` or document as deprecated).
- One source of truth for models: `Chat`, `Message`, `Provider`, `ToolCall`, `ToolResult`, `Settings`, `Workspace`. Use generated Wails bindings as source for backend shapes; do not manually duplicate backend structures with slight variations. Frontend-only presentation state must not leak into Go models.
- Naming and style: keep existing conventions. Search for existing abstraction before creating a new one; do not duplicate a concept.
- Remove dead code, unused imports, stale compat shims, demo code on sight.
- Validate untrusted/external data with Zod at system boundaries. Prefer explicit types.

## Performance invariants — DO NOT REGRESS

These are load-bearing. Do not "simplify" without measured evidence:

- **~30 Hz stream buffering**: AI streaming UI flushes via `lib/stream-scheduler.ts` (~32ms). No per-token Zustand updates. Scheduler must have zero idle timers after streaming stops (`dispose()` clears timeout+rAF; `getState()` asserts no pending work).
- **Stable completed messages**: Only the active streaming `MessageBubble` rerenders. Completed messages keep stable reference (`messages.slice()` with unchanged head) and are `memo`'d. Never map-recreate all messages on each token.
- **Isolated Zustand subscriptions**: `App` shell / sidebar / settings read `chats`/`selectedChatId` only; `ChatWorkspace` reads `messages`. No broad `s => s` subscriptions. Full App must NOT rerender during streaming.
- **Virtualized conversation**: `VirtualMessageList` uses `@tanstack/react-virtual` with `estimateSize` and absolute positioning. Do not render all messages at once. Scroll-resize is rAF-throttled.
- **Bounded Markdown tail**: `StreamingMarkdown` splits on stable fence-aware cut (`findStableCut`, `TAIL_CHARS=900`, only split at `\n`/`\n\n` with even fence count). Stable prefix renders non-streaming; only tail re-parses. Final render (`streaming=false`) is canonical — never animate the final full content.
- **Streaming text animation**: Only short tails animate per-word (`MAX_ANIMATED_WORDS=90`, `LARGE_TEXT_THRESHOLD=1800`, `stream-gap=60ms`). Large blocks bypass animation. Must respect `prefers-reduced-motion`.
- **No mass blur/will-change**: Never add `filter: blur()` or `will-change` to message list. Use compositor-friendly `transform`/`opacity` only.
- **Heavy work off main thread**: Markdown parsing of large content, model fetching, and any CPU-heavy work must not block the UI thread. Prefer Go or workers where practical.

If you touch streaming, virtualization, or markdown code, preserve these invariants and verify with existing tests: `stream-scheduler.test.ts`, `long-session.test.ts`, `isolation.test.ts`, `technical-content.test.ts`.

## UI rules

- Maintain fluid **60 FPS minimum** during streaming and scroll.
- Compositor-friendly animations first: `transform`/`opacity` only; avoid layout-thrashing properties.
- Respect `prefers-reduced-motion` (global kill-switch in `styles/style.css`).
- Reuse global motion primitives from `styles/style.css` — do not scatter random durations:
  - `--motion-duration-micro: 80ms` `quick:150ms` `fast:250ms` `panel:350ms`
  - `--motion-ease-spring: cubic-bezier(0.22,1,0.36,1)`
  - `--motion-scale-modal:0.96` `dropdown:0.97` `tooltip:0.98`
  - `--stream-gap:60ms` `stream-fade:350ms`
- Keep animations subtle and functional; motion should communicate state/spatial continuity.
- Use shadcn primitives before custom equivalents. Keep visual style minimal/compact/monochrome/thin borders/restrained rounding.

## Backend rules

- Domain-oriented packages, no circular dependencies.
- Repository/data-access code separate from application orchestration. No raw SQL scattered across unrelated services.
- Service methods expose narrow Wails APIs; validate and trim inputs (`strings.TrimSpace`) at boundary.
- Error handling: wrap with context (`fmt.Errorf("op: %w", err)`), preserve useful context, do not expose raw internal details unnecessarily. Keep a consistent helper (`wrap` in `database/`).
- Long-running or externally blocking backend operations must accept/derive cancellation and clean up when cancelled. Do not add `context.Context` mechanically to trivial synchronous SQLite CRUD. For long operations: accept `context.Context`, respect cancellation, no goroutine leaks. Timeouts for HTTP (`http.Client` with context, not `http.DefaultClient` indefinitely).
- Do not duplicate payloads unnecessarily between frontend and backend. Use generated bindings as single source.
- Migrations: bump `schemaVersion` sequentially, test via `TestMigrationsCreateSchema`.

## Conversation model — future-proofing

Keep the message/event model extensible to structured workflow items without forcing everything into Markdown strings. Supported/planned first-class items: `user`, `assistant`, `reasoning`, `tool_call`, `tool_result`, `command execution`, `file edit`, `diff`, `approval request`, `error`, `attachment`, `artifact`. Do not implement all now, but do not make architectural choices that make structured events impossible (e.g., assuming `Message` is only `{role, content}` string).

## Code quality

- Max ~250 lines per source file; split on meaningful boundary before exceeding.
- One responsibility per module; small composable functions/components.
- Avoid deep nesting, duplicated logic, premature abstractions.
- No `any` without documented justification. Prefer explicit types at boundaries.
- Handle errors explicitly; no `console.error` + silent swallow. Convert backend failures to typed/user-facing errors where useful; keep display consistent.
- Prefer early returns. Keep public APIs minimal. Remove dead/commented code.

## React rules

- Functional components only; keep components focused and small.
- Move complex behavior into hooks/feature modules; do not put business logic in presentational components.
- Avoid unnecessary global state; use local state when not shared.
- Avoid unnecessary `useEffect`; never use effects as substitute for derived state.

## Security

- Clearly distinguish local vs sandboxed operations in UI.
- Potentially destructive operations require approval via policy (Agents SDK human-in-the-loop for agent actions).
- Never store secrets in plaintext (use keychain via `internal/providers`). Never execute destructive commands implicitly. Never hide privileged actions. Never bypass permission system.

## Change discipline

Before changing architecture:
1. Understand existing ownership (read `AGENTS.md` + grep for existing abstraction).
2. Search for prior art — do not duplicate a concept.
3. Do not replace working performance-sensitive code with simpler-but-slower code.
4. Avoid unrelated refactors in a focused task.
5. Keep changes small and high-confidence; do not perform a full rewrite.
6. After changes run: `npm --prefix frontend run format` `npm --prefix frontend run lint` `npm run typecheck` + `npm run typecheck:test` (or `tsc -p tsconfig.app.json --noEmit` and `tsc -p tsconfig.test.json --noEmit`) `npm --prefix frontend run build` `go vet ./...` `go test ./...` and fix introduced errors. Regenerate Wails bindings with `wails3 generate bindings` if Go service API changed.

## Validation checklist

- [ ] Format code (`npm --prefix frontend run format`)
- [ ] Oxlint (`npm --prefix frontend run lint`)
- [ ] TypeScript app (`tsc -p tsconfig.app.json --noEmit` via `npm run typecheck`)
- [ ] TypeScript tests (`tsc -p tsconfig.test.json --noEmit` via `npm run typecheck:test`)
- [ ] Frontend production build (`npm --prefix frontend run build`)
- [ ] Frontend tests (`npm --prefix frontend run test`)
- [ ] Go vet (`go vet ./...`) and tests (`go test ./...`)
- [ ] Wails bindings up to date (`wails3 generate bindings` if service API changed)
- [ ] No known build/type errors remain
