# AGENTS.md

## Project

Unnamed local-first desktop AI agent application.

The application provides one primary AI agent that can chat, use tools, inspect and modify files, run commands, work in isolated sandboxes, connect to MCP servers, and persist conversations locally.

Do not recreate the old Poly UI architecture.

## Stack

### Desktop
- Wails v3
- Go native backend
- Windows-first, cross-platform where practical

### Frontend
- React
- TypeScript
- Vite
- shadcn/ui
- Base UI
- Tailwind CSS v4
- transitions.dev patterns for motion

### Agent
- OpenAI Agents SDK for TypeScript
- Zod v4
- MCP where required

### Storage
- SQLite
- Native secure credential storage for secrets

## Architecture

Keep responsibilities strict.

### TypeScript owns
- Product logic
- Agent orchestration
- OpenAI Agents SDK
- Conversations
- Tool definitions
- MCP
- Approvals
- UI state
- Artifacts

### Go owns
- Filesystem access
- Processes
- PTY/terminal
- OS integration
- File watching
- Credential storage
- Sandbox lifecycle
- Native services

Do not put prompts, model logic, agent orchestration, or conversation behaviour in Go.

Keep Wails-specific APIs behind small service/adaptor modules.

## Frontend structure

Prefer feature ownership:

```text
src/
├── app/
├── components/
│   ├── ui/
│   └── shared/
├── features/
├── agent/
├── services/
├── stores/
├── hooks/
├── lib/
├── styles/
└── types/
```

Rules:
- `components/ui` is for shadcn components.
- Product-specific components belong inside their feature.
- Native calls go through `services`.
- Agent SDK code belongs in `agent`.
- Avoid generic dumping grounds such as oversized `utils.ts`, `helpers.ts`, or `components.tsx`.

## Code quality

- Maximum **250 lines per source file**.
- Split files before they exceed the limit.
- One clear responsibility per module.
- Prefer small composable functions and components.
- Avoid deep nesting.
- Avoid duplicated logic.
- Avoid premature abstractions.
- Do not create abstractions used only once unless they establish an important boundary.
- Remove dead code, unused imports, stale comments, demo code, and unused assets.
- Do not leave commented-out implementations.
- Do not use `any` unless unavoidable and documented.
- Prefer explicit types at system boundaries.
- Validate untrusted/external data with Zod.
- Handle errors explicitly.
- Do not silently swallow failures.
- Prefer early returns over nested conditionals.
- Keep public APIs minimal.

## React rules

- Use functional components.
- Keep components focused and small.
- Move complex behaviour into hooks or feature modules.
- Do not put business logic inside presentational components.
- Avoid unnecessary global state.
- Use local state when state does not need to be shared.
- Do not add Zustand or another state library unless genuinely needed.
- Avoid unnecessary `useEffect`.
- Never use effects as a substitute for derived state.

## UI

Visual direction:
- Minimal
- Compact
- Desktop-first
- Mostly monochrome
- Thin borders
- Strong typography
- Restrained rounding
- Subtle elevation
- Minimal gradients
- No generic glowing AI aesthetic
- No unnecessary cards around every section

Use shadcn primitives before creating custom equivalents.

Motion:
- Use transitions.dev as a pattern/reference.
- Keep animations subtle and functional.
- Prefer roughly 100–250 ms transitions.
- Motion should communicate state or spatial continuity.
- Do not animate everything.

## Agent UX

Expose one primary visible agent.

Internal specialist agents may exist, but do not expose unnecessary multi-agent orchestration in the UI.

Conversation items are not limited to messages. Treat these as first-class:
- User messages
- Assistant messages
- Tool calls
- Tool results
- Approval requests
- Errors
- Attachments
- Artifacts

Use Agents SDK human-in-the-loop support for approvals instead of building a separate agent permission protocol.

## Security

Clearly distinguish:
- Local computer operations
- Sandboxed operations

Potentially destructive operations must require approval according to policy.

Do not:
- Store secrets in plaintext
- Execute destructive commands implicitly
- Hide privileged actions from the user
- Bypass the application's permission system

## Scope discipline

Build the smallest correct implementation.

Do not add unrelated:
- Multi-agent graphs
- Workflow builders
- Plugin marketplaces
- Cloud accounts
- Sync systems
- Complex theming
- Social features
- Large abstraction layers

Do not redesign unrelated areas while implementing a focused task.

## Validation

Before considering work complete:
- Format code
- Run TypeScript typecheck
- Run frontend build
- Run Go formatting
- Run Go tests where applicable
- Run Wails build/check where practical
- Fix errors introduced by the change

Do not claim completion while known build or type errors remain.
