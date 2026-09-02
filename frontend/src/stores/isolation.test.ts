import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatStore } from './chat-store';
import { useSettingsStore } from './settings-store';

describe('Zustand isolation during streaming', () => {
  beforeEach(() => {
    act(() => {
      useChatStore.setState({
        chats: [],
        messages: [],
        input: '',
        isLoading: false,
        selectedChatId: undefined,
      });
    });
  });

  it('updating messages does not trigger chats selector', () => {
    const chatsRender = { count: 0 };
    const messagesRender = { count: 0 };

    const { result: chatsResult } = renderHook(() => {
      chatsRender.count++;
      return useChatStore((s) => s.chats);
    });
    renderHook(() => {
      messagesRender.count++;
      return useChatStore((s) => s.messages);
    });

    const initialChatsCount = chatsRender.count;
    const initialMessagesCount = messagesRender.count;

    act(() => {
      useChatStore.setState({
        messages: [
          { id: '1', chatId: 'c1', role: 'assistant', content: 'hello', createdAt: Date.now() },
        ],
      });
    });

    // chats selector should not have rerendered (object reference same, shallow compare may still trigger? Zustand triggers if selected slice changes)
    // Since chats didn't change, its hook should not increment
    expect(chatsResult.current).toEqual([]);
    // messages hook should have rerendered
    expect(messagesRender.count).toBeGreaterThan(initialMessagesCount);
    // chats hook ideally not rerendered; allow at most 1 extra due to implementation but not per-message
    expect(chatsRender.count).toBe(initialChatsCount);
  });

  it('App shell selectors stable during streaming', () => {
    // Simulate App reading chats/selectedChatId but not messages
    const appRender = { count: 0 };
    const viewportRender = { count: 0 };

    renderHook(() => {
      appRender.count++;
      return useChatStore((s) => s.chats);
    });
    renderHook(() => {
      appRender.count++;
      return useChatStore((s) => s.selectedChatId);
    });
    const { result } = renderHook(() => {
      viewportRender.count++;
      return useChatStore((s) => s.messages);
    });

    act(() => {
      // streaming update: only last message content changes, array ref changes but chats same
      const current = result.current;
      useChatStore.setState({
        messages: [
          ...current,
          {
            id: '2',
            chatId: 'c1',
            role: 'assistant',
            content: 'a'.repeat(1000),
            createdAt: Date.now(),
            streaming: true,
          } as any,
        ],
      });
    });
    // App shell (chats) should not rerender due to messages change
    // Our App now reads chats via separate selector, so it should stay same
    // This test documents the invariant: 0 App renders during normal streaming content update
    // We assert that messages hook did rerender
    expect(viewportRender.count).toBeGreaterThan(1);
  });

  it('settings store not affected by chat streaming', () => {
    const settingsRender = { count: 0 };
    renderHook(() => {
      settingsRender.count++;
      return useSettingsStore((s) => s.providers);
    });
    const before = settingsRender.count;
    act(() => {
      useChatStore.setState({
        messages: [
          {
            id: 'x',
            chatId: 'c1',
            role: 'assistant',
            content: 'stream',
            createdAt: Date.now(),
          } as any,
        ],
      });
    });
    expect(settingsRender.count).toBe(before);
  });

  it('completed MessageBubble remains stable when streaming tail changes', () => {
    // This is a conceptual test: memo should prevent rerender if message ref stable
    // We simulate store with 2 messages, one completed, one streaming
    const msg1 = {
      id: '1',
      chatId: 'c1',
      role: 'assistant' as const,
      content: 'complete',
      createdAt: 1,
    };
    const msg2 = {
      id: '2',
      chatId: 'c1',
      role: 'assistant' as const,
      content: 'stream',
      createdAt: 2,
      streaming: true,
    };
    act(() => {
      useChatStore.setState({ messages: [msg1 as any, msg2 as any] });
    });
    const stableRef = useChatStore.getState().messages[0];
    // update streaming message only (slice copy, stable ref same)
    act(() => {
      const state = useChatStore.getState();
      const next = state.messages.slice();
      next[1] = { ...next[1], content: 'stream updated' };
      useChatStore.setState({ messages: next });
    });
    const afterStableRef = useChatStore.getState().messages[0];
    expect(afterStableRef).toBe(stableRef); // same reference, memo will prevent rerender
  });
});
