import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useChatStore } from './chat-store';

vi.mock('@/agent/text-generation', async () => {
  const actual =
    await vi.importActual<typeof import('@/agent/text-generation')>('@/agent/text-generation');
  return { ...actual, streamReply: vi.fn() };
});
vi.mock('@/services/chat', () => ({
  ChatService: {
    CreateChat: vi.fn(async (title: string) => ({
      id: 'chat-1',
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })),
    ListChats: vi.fn(async () => []),
    ListMessages: vi.fn(async () => []),
    AddMessage: vi.fn(async () => ({
      id: 'm1',
      chatId: 'chat-1',
      role: 'assistant',
      content: 'x',
      createdAt: Date.now(),
    })),
    DeleteChat: vi.fn(async () => {}),
    DeleteAllChats: vi.fn(async () => {}),
    UpdateChatTitle: vi.fn(async () => {}),
  },
}));
vi.mock('../../bindings/changeme/internal/providers/service', () => ({
  APIKey: vi.fn(async () => 'test-key'),
}));

import { streamReply } from '@/agent/text-generation';
import { ChatService } from '@/services/chat';

describe('chat-store streaming scheduler invariants', () => {
  const chatMessages = new Map<string, any[]>();
  beforeEach(() => {
    chatMessages.clear();
    // Mock ListMessages to return stored messages per chat
    (ChatService.ListMessages as any).mockImplementation(async (chatId: string) => {
      return chatMessages.get(chatId) ?? [];
    });
    (ChatService.AddMessage as any).mockImplementation(
      async (chatId: string, role: string, content: string, reasoning: string) => {
        const msg = {
          id: `msg-${Date.now()}-${Math.random()}`,
          chatId,
          role,
          content,
          reasoning,
          createdAt: Date.now(),
        };
        const arr = chatMessages.get(chatId) ?? [];
        arr.push(msg);
        chatMessages.set(chatId, arr);
        return msg;
      },
    );
    (ChatService.CreateChat as any).mockImplementation(async (title: string) => {
      const chat = {
        id: `chat-${Date.now()}`,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      chatMessages.set(chat.id, []);
      return chat;
    });
    useChatStore.setState({
      chats: [],
      messages: [],
      input: 'hello',
      isLoading: false,
      selectedChatId: 'chat-1',
      provider: {
        id: 'p1',
        type: 'OpenAI',
        name: 'test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
      } as any,
    });
    chatMessages.set('chat-1', []);
    chatMessages.set('chat-2', []);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    useChatStore.setState({
      chats: [],
      messages: [],
      input: '',
      isLoading: false,
      selectedChatId: undefined,
      provider: undefined,
    });
  });

  it('final synchronous flush exactly matches accumulated', async () => {
    const chunks = ['a', 'b', 'c', 'd', 'e'];
    (streamReply as any).mockImplementation(async function* () {
      for (const c of chunks) {
        yield { type: 'text', text: c };
        await new Promise((r) => setTimeout(r, 2));
      }
    });
    const p = useChatStore.getState().submitMessage();
    await p;
    const msgs = useChatStore.getState().messages;
    const assistant = msgs.find((m) => m.role === 'assistant');
    expect(assistant?.content).toBe('abcde');
  });

  it('abort clears scheduled work and prevents persistence of incomplete', async () => {
    (streamReply as any).mockImplementation(async function* (
      _p: any,
      _k: any,
      _c: any,
      _history: any,
      signal: AbortSignal,
    ) {
      yield { type: 'text', text: 'part1' };
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, 50);
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      yield { type: 'text', text: 'part2' };
    });
    (ChatService.AddMessage as any).mockClear();
    // need to re-mock to track calls after clear but keep behavior
    const origAdd = (ChatService.AddMessage as any).getMockImplementation();
    (ChatService.AddMessage as any).mockImplementation(async (...args: any[]) => {
      const res = await origAdd(...args);
      return res;
    });
    const p = useChatStore.getState().submitMessage();
    await new Promise((r) => setTimeout(r, 10));
    // abort
    useChatStore.getState().stopMessage();
    await new Promise((r) => setTimeout(r, 80));
    await p.catch(() => {});
    const calls = (ChatService.AddMessage as any).mock.calls;
    expect(calls.some((c: any) => c[1] === 'user')).toBe(true);
    const assistantCalls = calls.filter((c: any) => c[1] === 'assistant');
    expect(assistantCalls.length).toBe(0);
  });

  it('starting new request cannot mutate old request state', async () => {
    (streamReply as any).mockImplementation(async function* (
      _p: any,
      _k: any,
      _c: any,
      _history: any,
      signal: AbortSignal,
    ) {
      for (let i = 0; i < 5; i++) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        yield { type: 'text', text: `a${i}` };
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, 5);
          signal.addEventListener('abort', () => {
            clearTimeout(t);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }
    });
    const p1 = useChatStore.getState().submitMessage();
    await new Promise((r) => setTimeout(r, 8));
    useChatStore.getState().startNewChat();
    useChatStore.setState({ input: 'new', selectedChatId: 'chat-2' as any });
    (streamReply as any).mockImplementation(async function* () {
      yield { type: 'text', text: 'newcontent' };
    });
    const p2 = useChatStore.getState().submitMessage();
    await Promise.all([p1.catch(() => {}), p2]);
    const msgs = useChatStore.getState().messages;
    expect(msgs.some((m) => m.content.includes('a0'))).toBe(false);
    expect(msgs.some((m) => m.content === 'newcontent')).toBe(true);
  });

  it('switching chats keeps both generations isolated and visible', async () => {
    (streamReply as any).mockImplementation(async function* (
      _p: any,
      _k: any,
      _c: any,
      history: any[],
      signal: AbortSignal,
    ) {
      const text = history[0]?.chatId === 'chat-1' ? 'first' : 'second';
      yield { type: 'text', text: `${text}-1` };
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, 20);
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      yield { type: 'text', text: `${text}-2` };
    });
    useChatStore.setState({ selectedChatId: 'chat-1' as any, input: 'hi' });
    chatMessages.set('chat-1', []);
    chatMessages.set('chat-2', []);
    const p = useChatStore.getState().submitMessage();
    await new Promise((r) => setTimeout(r, 5));
    await useChatStore.getState().selectChat('chat-2');
    useChatStore.setState({ input: 'second prompt' });
    const p2 = useChatStore.getState().submitMessage();
    await new Promise((r) => setTimeout(r, 8));
    expect(useChatStore.getState().generatingChatIds).toEqual(
      expect.arrayContaining(['chat-1', 'chat-2']),
    );
    await Promise.all([p, p2]);
    expect(useChatStore.getState().generatingChatIds).toEqual([]);
    expect(useChatStore.getState().messages.some((m) => m.content === 'second-1second-2')).toBe(
      true,
    );

    await useChatStore.getState().selectChat('chat-1');
    expect(useChatStore.getState().messages.some((m) => m.content === 'first-1first-2')).toBe(true);
  });
});
