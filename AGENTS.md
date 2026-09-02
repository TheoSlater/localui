# AGENTS.md

## Project identity and current architecture

LocalUI is a Wails v3 desktop AI application. It is Windows-first, with
cross-platform support where the Wails target and native APIs allow it.

- `main.go` is the Go composition root. It opens the SQLite database, creates
  the chat and provider Wails services, embeds `frontend/dist`, and creates the
  application window.
- `frontend/` is a React 18 + TypeScript + Vite application using Tailwind v4,
  shadcn/ui, Base UI, Lucide, Motion, Zustand, and TanStack Virtual.
- `internal/database/` owns SQLite persistence and migrations.
- `internal/chat/` and `internal/providers/` are narrow Wails service facades.
  The provider service also owns OS keychain access for API keys.
- AI generation currently runs in `frontend/src/agent/` through the Vercel AI
  SDK (`ai` and `@ai-sdk/openai-compatible`). There is no active Go generation
  path. OpenAI Agents SDK, MCP, and Zod are future-compatible boundaries, not
  current runtime dependencies; add them in the TypeScript agent layer if and
  when they are introduced.

The durable-data split is intentional:

- Chats and messages are stored in SQLite through Wails.
- Provider records are stored in SQLite; provider API keys are stored in the OS
  keychain and must never be put in SQLite, Zustand persistence, or logs.
- User preferences and model selection are persisted by the Zustand
  `persist` middleware in browser storage.
- Streaming state, request controllers, dialogs, input, and other transient
  interaction state stay in memory.

## Repository map and ownership

| Location | Owns |
| --- | --- |
| `frontend/src/app/` | Application composition and shell layout. |
| `frontend/src/features/chat/` | Chat workspace, composer, messages, Markdown, reasoning, and chat-specific interactions. |
| `frontend/src/features/providers/` | Provider lifecycle, provider setup, API-key workflow, and provider presets. |
| `frontend/src/features/settings/` | Settings UI and model selection UI. |
| `frontend/src/components/ui/` | Reusable shadcn/Base UI primitives and their project styling. |
| `frontend/src/components/shared/` | Reusable application pieces that are not shadcn primitives, such as the virtual message list, confirmation dialog, and theme toggle. |
| `frontend/src/stores/` | Small Zustand domain stores for shared client state. |
| `frontend/src/services/` | Thin Wails adapters, provider/keychain adapters, model discovery, and notifications. |
| `frontend/src/agent/` | Provider client construction, model-message conversion, system instructions, streaming, and title generation. |
| `frontend/src/lib/` | Pure utilities and performance helpers; no React UI or application state. |
| `frontend/src/hooks/` | Reusable browser/platform lifecycle hooks. |
| `frontend/bindings/` | Generated Wails TypeScript bindings. Never edit by hand. |
| `internal/database/` | SQLite connection, schema migrations, models, and persistence operations. |
| `internal/chat/` | Chat/message Wails API surface delegating to `internal/database`. |
| `internal/providers/` | Provider Wails API surface and keychain coordination. |

Prefer feature/domain ownership over a flat folder structure. Keep modules
focused and use roughly 250 lines as a review signal, not a mechanical limit;
split when there is a real responsibility boundary. Do not create a generic
abstraction used once just to reduce line count.

### React and app composition

- `frontend/src/main.tsx` mounts `App` and the global `Toaster`, and imports
  `frontend/src/styles/style.css`.
- `app/App.tsx` composes bootstrap, domain hooks, layout, and feature UI. It
  owns only app-level composition and transient dialog state. Keep provider
  lifecycle orchestration in
  `features/providers/hooks/use-provider-sync.ts`, not in `App.tsx`.
- `ChatViewport` intentionally owns the message/input/loading subscriptions.
  `App` reads shell state such as chats, selected chat, and generation badges;
  do not make the whole app subscribe to `messages` during a stream.
- Feature components own rendering, input, local interaction state, and
  feature-specific composition. They do not own SQLite, keychain access,
  provider orchestration, tool execution, indexing, or long-running work.
- Keep business logic in stores, services, the agent layer, or Go where it
  belongs. Do not use `useEffect` as a substitute for derived state.

### Zustand and persistence

- Use Zustand only for shared state that genuinely crosses component
  boundaries. Keep selectors narrow and stable, for example
  `useChatStore((s) => s.messages)`, never a broad `s => s` subscription.
- `chat-store.ts` owns chat selection, persisted chat actions, input state,
  active request cancellation, stream buffering, and the bridge between the
  chat UI and `agent/text-generation.ts`.
- `settings-store.ts` owns user preferences, provider configuration presented
  to the UI, and selected/default model settings. Its `persist` middleware is
  the source for local preferences; do not duplicate those preferences in
  another store or component state.
- `use-provider-sync.ts` synchronizes backend providers into settings and chat
  model selection. Provider saves must go through its ordered
  `enqueueProviderSave` path. Do not bypass that queue with direct backend
  writes.
- Component-local state is preferred for open/closed state, search text,
  animation state, copied state, and other ephemeral concerns.

### Services and generated bindings

- Production components, stores, and features call native functionality only
  through `frontend/src/services/`. `services/chat.ts` and
  `services/providers.ts` are the boundary around generated Wails bindings.
- Do not import `frontend/bindings/` directly from production components,
  stores, features, or the agent. Tests may mock generated bindings when that
  is the narrowest way to test a service/store boundary.
- `services/models.ts` owns provider model discovery. It performs client-side
  HTTP discovery for Ollama and OpenAI-compatible providers and uses known
  model lists for the currently supported Anthropic and Google entries. Keep
  network work cancellable where the browser API permits, validate provider
  URLs before requesting them, and do not leak API keys into UI state or logs.
- `services/notifications.ts` is the shared user-facing notification boundary.
  Convert failures into useful user-facing messages at feature boundaries;
  do not silently swallow errors.
- Generated binding models are the source of truth for persisted Wails
  payloads. A frontend-only type such as `TextProvider` or `ChatMessage` may
  intentionally add presentation/selection fields, but convert it at the
  service or feature boundary rather than inventing competing persisted
  models. Streaming flags and other UI state must not leak into Go models.
- After changing a Go service API, run `wails3 generate bindings` and review
  the generated diff. Never hand-edit generated binding files.

### AI and conversation flow

- `frontend/src/agent/text-generation.ts` owns OpenAI-compatible client
  creation, model-message conversion, system instructions, streaming text and
  reasoning events, and generated chat titles.
- `chat-store.ts` owns the request lifecycle: provider readiness checks,
  loading state, one abort controller per active chat, scheduler-driven UI
  updates, persistence of completed messages, and cleanup on abort, deletion,
  or chat switch.
- Keep model generation out of Go unless a deliberately documented
  architectural decision adds a new backend capability. Do not create a
  second streaming path accidentally.
- The conversation model must remain extensible. The persisted message shape
  currently contains role/content/reasoning, while the view model adds
  streaming/error state. Future reasoning, tool call/result, command,
  file-edit, diff, approval, error, attachment, and artifact events should be
  represented as typed structured items rather than forcing every event into a
  Markdown string. Do not implement all of those event types speculatively.

### Go backend and data access

- Keep `main.go` as composition only. Put domain behavior in the relevant
  `internal/` package and keep Wails methods narrow.
- Keep SQL and schema knowledge in `internal/database/`; do not scatter raw
  SQL through unrelated services. The current database layer exposes focused
  operations for chats, messages, and providers; introduce a separate
  repository/orchestration layer only when complexity justifies it.
- `internal/database.Open` creates the per-user database directory with
  restricted permissions, enables foreign keys, WAL, and a busy timeout, and
  limits the connection pool to one connection. Preserve those properties
  unless measured requirements change them.
- The current schema version is 3. Migrations must be sequential, atomic where
  practical, and covered by database tests. Bump `schemaVersion` for schema
  changes and update migration tests.
- Trim and validate boundary inputs. Wrap errors with operation context using
  `%w`; preserve useful causes without exposing raw internal details in the UI.
- Long-running or externally blocking backend work must accept/derive
  cancellation, respect it, and clean up resources. Do not add
  `context.Context` to trivial synchronous SQLite CRUD merely for appearance.

## Required shadcn UI workflow

This project uses shadcn/ui. The canonical configuration is
`frontend/components.json`: `base-nova` style, Base UI primitives, Tailwind v4,
CSS variables, Lucide icons, and the `@/components/ui` alias.

- Reuse components from `frontend/src/components/ui/` (imported as
  `@/components/ui/...`) before writing a new control. This applies to buttons,
  inputs, dialogs, menus, tooltips, toggles, cards, separators, and similar UI.
- When a needed primitive is missing, use the shadcn CLI from `frontend/`:

  ```powershell
  npm exec shadcn -- add <component>
  ```

  `npx shadcn@latest add <component>` is also acceptable when intentionally
  updating the CLI version. Review the generated code, adapt it to the
  existing Base UI/Tailwind conventions, run formatting, and keep the result
  in `src/components/ui/`.
- Do not add a second UI kit, manually paste an unrelated component
  implementation, or put feature-specific composition in `components/ui`.
  Put domain composition under `features/<domain>/components` and build it
  from the shared shadcn primitives.
- Keep `components.json`'s CSS path aligned with the active global stylesheet
  `src/styles/style.css`; run the CLI with `frontend/` as its working directory.
- Preserve accessible names, keyboard behavior, focus states, and the
  semantics supplied by Base UI when customizing generated components.

## Performance invariants — do not regress

These are load-bearing behaviors. Change them only with measured evidence and
corresponding regression coverage.

- **Dirty-driven stream buffering:** `lib/stream-scheduler.ts` coalesces
  chunks and flushes at about 30 Hz (`32 ms`) through at most one timeout and
  one `requestAnimationFrame`. Never issue a Zustand update per token. Call
  `dispose()` on completion, abort, and teardown; there must be no idle stream
  timer afterward.
- **Stable completed messages:** the stream replaces only the active message
  object. Keep completed message references stable, keep `MessageBubble`
  memoized, and do not recreate the entire message array/object graph on each
  chunk.
- **Subscription isolation:** the shell/sidebar/settings subscribe only to the
  slices they render. `ChatViewport` owns message-stream subscriptions. The
  full `App` must not rerender for every streamed chunk.
- **Virtualized conversations:** `VirtualMessageList` uses
  `@tanstack/react-virtual`, estimated row sizes, stable item keys, absolute
  positioning, and rAF-throttled scroll/resize behavior. Preserve the
  chat-identity remount key so measurement state cannot leak across chats.
- **Bounded Markdown streaming:** `StreamingMarkdown` uses the fence-aware
  `findStableCut` and a tail of at most `TAIL_CHARS` (currently 900) when a
  safe newline boundary exists. Large/unsafe streams use the plain-text or
  deferred path defined by `technical-content.tsx`. Never parse the full
  growing message on every chunk; final completed output must use the
  canonical non-streaming render.
- **Bounded text animation:** per-word streaming animation is limited by the
  current `MAX_ANIMATED_WORDS` and `LARGE_TEXT_THRESHOLD` budgets. Keep
  opacity/transform effects and any small blur bounded to the streaming tail;
  never apply them to an unbounded message list or thousands of nodes. Do not
  add mass `will-change` or mass `backdrop-filter`.
- **Scroll and model-list work:** auto-scroll and virtualized model-list
  updates are frame-bounded. Model discovery occurs only when the selector is
  open and is debounced. Preserve reduced-motion behavior.
- **Heavy work:** keep parsing and other CPU-heavy work bounded/deferred. Move
  genuinely expensive new work to Go or a worker when it cannot meet the 60 FPS
  interaction budget.

If streaming, virtualization, or Markdown code changes, run and update the
relevant tests: `stream-scheduler.test.ts`, `long-session.test.ts`,
`isolation.test.ts`, `technical-content.test.ts`, and
`virtual-message-list.test.tsx`.

## UI, motion, and platform rules

- Use the global tokens in `frontend/src/styles/style.css` instead of
  scattering durations: micro `80ms`, quick `150ms`, fast `250ms`, panel
  `350ms`; spring easing `cubic-bezier(0.22, 1, 0.36, 1)`; stream gap `60ms`.
- Prefer compositor-friendly `transform` and `opacity`. Width/height
  transitions belong only at an intentional layout boundary such as the
  existing resize transition. Do not animate layout on every message or add
  mass blur/layer promotion.
- Respect the global `prefers-reduced-motion` rules and the app's
  reduce-transparency setting. Keep motion subtle and functional.
- Keep platform-specific behavior in `lib/platform` or `services/platform`
  with platform submodules. Do not branch on platform throughout feature
  components or duplicate the entire frontend.
- Keep local/sandboxed operations visibly distinct. Destructive or privileged
  agent actions require an explicit approval/policy path; never execute them
  implicitly or hide the authority boundary.

## Change discipline and proof

Before changing architecture or adding a dependency:

1. Read this file and trace the existing owner and data flow.
2. Search for an existing service, store, hook, UI primitive, or helper before
   creating another one.
3. Keep the change within the responsible layer and avoid unrelated rewrites.
4. Validate untrusted provider/network/backend data at its boundary with
   explicit runtime checks (use Zod when it is part of the relevant boundary).
5. Preserve cancellation, error handling, accessibility, security, and data
   deletion/rollback behavior.

For frontend or backend code changes, run the smallest relevant proof first.
For a normal full change, run from the repository root:

```powershell
npm --prefix frontend run format
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run typecheck:test
npm --prefix frontend run build
npm --prefix frontend run test
go vet ./...
go test ./...
```

For a documentation-only change, inspect the final diff and verify referenced
paths/commands instead of running the full application suite. Report tests not
run and any unresolved risk. Do not claim a check passed unless it was run.
