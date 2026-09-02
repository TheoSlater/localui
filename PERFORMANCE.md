# Performance Invariants

This document locks in the streaming hot-path architecture. Do not “simplify” these without measured evidence and an update to the regression tests.

## Baseline (intended, measured on 12 k mixed Markdown, 200-msg session)

| Invariant | Baseline | Why it exists |
|---|---|---|
| Streaming UI flush | ≤31 Hz (dirty-driven `setTimeout 32 ms` + `rAF`) | Per-token `set(map)` caused 55 Hz reconciliations + full Markdown re-parse (8 ms) → jank. Buffer at ~30 Hz halves scripting/layout. |
| Per-token store updates | **Prohibited** | Each chunk appends to `reply` string (growing) and would trigger `messages.map` + `parseMarkdown(full)` → O(n²). |
| Full `App` renders during stream | **0** | `App` previously broad `useChatStore()` re-rendered sidebar/model-selector/composer per token. Now `ChatViewport` isolates `messages/input/isLoading` via selectors; `App` reads only `chats/selectedChatId`. |
| Completed `MessageBubble` renders | **0** | `messages.slice()` keeps completed refs stable, `MessageBubble` is `memo`, `VirtualMessageList` uses stable `getItemKey` via `itemsRef`. |
| Active Markdown parse | **Bounded to tail ~900 chars** | Full 10 k re-parse 7.8 ms → tail 0.7 ms. `StreamingMarkdown` (`findStableCut` + `TAIL_CHARS`) keeps stable prefix `memo` non-streaming, tail streaming. |
| Canonical final render | **Full source, `streaming:false`** | Streaming may temporarily mis-format at split, but final `set({messages: savedViewMessages})` after `AddMessage` renders `TechnicalContent` non-streaming. |
| Idle stream timers | **0** | `createStreamScheduler` holds at most 1 `setTimeout` + 1 `rAF` only while dirty; `dispose()` on completion/abort/chat-switch. Permanent `setInterval(32)` while idle is prohibited. |
| Conversation DOM | **Virtualized** | `VirtualMessageList` `useVirtualizer` mounts ~16 rows (visible + overscan 6) not 1000; `key={selectedChatId}` on `ChatWorkspace` isolates measurements per chat. |
| Per-word blur/filter | **Prohibited** | `span.t-stream-w` previously `filter:blur(1px)` + `will-change` on 2000 nodes → GPU overdraw. Now `opacity` only, `MAX_ANIMATED_WORDS 90`, `LARGE_TEXT_THRESHOLD 1800`, `will-change` removed. |
| Mass `will-change` | **Prohibited** | Large collections force layer promotion. Only single `.trStream` keeps `will-change:transform` (one element). |
| Heavy non-UI work | **Off main thread / Go** | Markdown tail is bounded; DB `ListMessages/AddMessage` via Wails, `fetchAllModels` debounced 300 ms + `open` gate. |

## Unusual choices — why

* **~30 Hz dirty scheduler (`frontend/src/lib/stream-scheduler.ts`, `frontend/src/stores/chat-store.ts`)** — LLM yields 20–60 chunks/s. Flushing per chunk → 55 React renders/s. Scheduler coalesces `pendingReply`/`pendingReasoning` and flushes via `setTimeout(32)` → `rAF`, final `flushSync` exact. Prevents stale `setInterval` while idle and guarantees `stable+tail===original` on final flush.
* **Bounded tail (`frontend/src/features/chat/components/technical-content.tsx:findStableCut`)** — Splits at last `\n\n`/`\n` before `length-900`, fence-aware (` ``` `/`~~~` odd → 0). `stable` memo `streaming:false`, `tail` `streaming:true` 900 chars. Avoids full re-parse and huge animated trees; degrades to `0` (no split) if no safe boundary or inside fence.
* **Stable completed references (`frontend/src/stores/chat-store.ts:flushStreaming`)** — `next = state.messages.slice(); next[idx]={...}` keeps 199/200 refs stable → `memo` holds.
* **Virtualized conversation (`frontend/src/components/shared/virtual-message-list.tsx`)** — `useVirtualizer` single instance, `itemsRef` stable `getKey`, `key={selectedChatId}` on `ChatWorkspace` in `ChatViewport` guarantees `ResizeObserver` and `measureElement` cache per chat, scroll not leaking.
* **Final canonical full render (`StreamingMarkdown` vs `TechnicalContent`)** — Streaming uses split, completed uses `parseMarkdown(full, streaming:false)`; `streamingMarkdownExtension` only for tail.

## What future agents must not do

* Restore per-token `set(state=>state.messages.map(...))`.
* Parse full `content` on every chunk.
* Add `filter:blur`, `backdrop-blur`, or `will-change` to hundreds of spans.
* Remove `key={selectedChatId}` or re-introduce `scrollMode` dead API.
* Replace `findStableCut` with a full Markdown parser.
* Re-introduce permanent `setInterval` while idle.

## Regression coverage

* `frontend/src/lib/stream-scheduler.test.ts` — at most one timeout/rAF, coalesce, 30 Hz ceiling, final sync, abort, no idle.
* `frontend/src/features/chat/components/technical-content.test.ts` — `stable+tail===original` for `\n`, `\n\n`, Unicode, lists, blockquotes, fences, tables, links, etc.; fence-aware, offset correctness.
* `frontend/src/lib/long-session.test.ts` — 1000 msgs, 100 KB code blocks, 50 switches, abort/retry, delete, heap/DOM/timer bounds.
* `frontend/src/stores/isolation.test.ts` + `frontend/src/stores/chat-store.test.ts` — `chats` selector stable during `messages` stream, `App` 0 renders, abort/chat-switch cannot mutate wrong chat.
* `frontend/src/components/shared/virtual-message-list.test.tsx` — mounted rows <30, `key` remount isolates, no `scrollMode`.

Run `npm --prefix frontend run test` and `npm --prefix frontend run build` after any streaming/virtualizer/markdown change.
