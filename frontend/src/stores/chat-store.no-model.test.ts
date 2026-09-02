import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useChatStore, getProviderSetupError, isProviderReady } from './chat-store';

vi.mock('@/agent/text-generation', async () => {
  const actual =
    await vi.importActual<typeof import('@/agent/text-generation')>('@/agent/text-generation');
  return { ...actual, streamReply: vi.fn(), generateChatTitle: vi.fn() };
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
vi.mock('@/services/notifications', () => ({
  notifications: {
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

import { generateChatTitle, streamReply } from '@/agent/text-generation';
import { ChatService } from '@/services/chat';
import * as ProviderBindings from '../../bindings/changeme/internal/providers/service';
import { notifications } from '@/services/notifications';

describe('no-model handling - submission blocked, no persistence', () => {
  const chatMessages = new Map<string, any[]>();

  beforeEach(() => {
    chatMessages.clear();
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
        id: `chat-${Date.now()}-${Math.random()}`,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      chatMessages.set(chat.id, []);
      return chat;
    });
    (ChatService.ListChats as any).mockResolvedValue([]);
    (ProviderBindings.APIKey as any).mockResolvedValue('test-key');
    (streamReply as any).mockImplementation(async function* () {
      yield { type: 'text', text: 'hello assistant' };
    });
    (generateChatTitle as any).mockResolvedValue('Generated title');
    useChatStore.setState({
      chats: [],
      messages: [],
      input: 'hello',
      isLoading: false,
      selectedChatId: undefined,
      provider: undefined,
      submitError: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      chats: [],
      messages: [],
      input: '',
      isLoading: false,
      selectedChatId: undefined,
      provider: undefined,
      submitError: null,
    });
  });

  it('no provider -> no user/assistant persistence, shows hint', async () => {
    useChatStore.setState({
      input: 'hello',
      provider: undefined,
    });
    const beforeCreateCalls = (ChatService.CreateChat as any).mock.calls.length;
    const beforeAddCalls = (ChatService.AddMessage as any).mock.calls.length;
    await useChatStore.getState().submitMessage();
    expect(ChatService.CreateChat).toHaveBeenCalledTimes(beforeCreateCalls);
    expect(ChatService.AddMessage).toHaveBeenCalledTimes(beforeAddCalls);
    expect(useChatStore.getState().messages.length).toBe(0);
    expect(useChatStore.getState().submitError).toBe('Select a model to start chatting');
    expect(useChatStore.getState().isLoading).toBe(false);
    // input should remain (not cleared) because we blocked before persistence
    expect(useChatStore.getState().input).toBe('hello');
    // no error message injected as assistant message
    expect(useChatStore.getState().messages.some((m) => m.role === 'error')).toBe(false);
    expect(useChatStore.getState().messages.some((m) => m.role === 'assistant')).toBe(false);
  });

  it('empty model -> no persistence', async () => {
    useChatStore.setState({
      input: 'hello',
      provider: {
        id: 'p1',
        type: 'OpenAI',
        name: 'test',
        baseUrl: 'https://api.openai.com/v1',
        model: '',
        hasApiKey: true,
      } as any,
    });
    await useChatStore.getState().submitMessage();
    expect(ChatService.CreateChat).not.toHaveBeenCalled();
    expect(ChatService.AddMessage).not.toHaveBeenCalled();
    expect(useChatStore.getState().messages.length).toBe(0);
    expect(useChatStore.getState().submitError).toBe('Select a model to start chatting');
    expect(useChatStore.getState().isLoading).toBe(false);
  });

  it('invalid baseUrl -> no persistence', async () => {
    useChatStore.setState({
      input: 'hello',
      provider: {
        id: 'p1',
        type: 'OpenAI',
        name: 'test',
        baseUrl: 'not-a-url',
        model: 'gpt-4',
        hasApiKey: true,
      } as any,
    });
    await useChatStore.getState().submitMessage();
    expect(ChatService.CreateChat).not.toHaveBeenCalled();
    expect(ChatService.AddMessage).not.toHaveBeenCalled();
    expect(useChatStore.getState().submitError).toBe(
      'Add a complete http or https Base URL in Settings first.',
    );
  });

  it('no API key/config -> no assistant error message persisted', async () => {
    // case 1: hasApiKey === false (sync block)
    useChatStore.setState({
      input: 'hello',
      provider: {
        id: 'p1',
        type: 'OpenAI',
        name: 'test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
        hasApiKey: false,
      } as any,
    });
    await useChatStore.getState().submitMessage();
    expect(ChatService.CreateChat).not.toHaveBeenCalled();
    expect(ChatService.AddMessage).not.toHaveBeenCalled();
    expect(useChatStore.getState().messages.some((m) => m.role === 'error')).toBe(false);
    expect(useChatStore.getState().submitError).toBe('Add an API key in Settings first.');
    expect(useChatStore.getState().isLoading).toBe(false);

    // case 2: async API key fetch failure (hasApiKey undefined but key missing)
    (ProviderBindings.APIKey as any).mockRejectedValueOnce(new Error('not found'));
    useChatStore.setState({
      input: 'hello2',
      submitError: null,
      provider: {
        id: 'p1',
        type: 'OpenAI',
        name: 'test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
        // hasApiKey undefined => sync passes, async should block
      } as any,
    });
    await useChatStore.getState().submitMessage();
    expect(ChatService.CreateChat).not.toHaveBeenCalled();
    // AddMessage should not have been called in this second attempt
    // Total calls still 0 from before (we cleared? but we check no new calls with error)
    expect(useChatStore.getState().messages.length).toBe(0);
    expect(useChatStore.getState().submitError).toBe('Add an API key in Settings first.');
  });

  it('transport/config error after persistence is surfaced as UI state, not injected', async () => {
    // valid provider, but streamReply throws
    useChatStore.setState({
      input: 'hello',
      selectedChatId: 'chat-1',
      provider: {
        id: 'p1',
        type: 'OpenAI',
        name: 'test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
        hasApiKey: true,
      } as any,
    });
    chatMessages.set('chat-1', []);
    (ProviderBindings.APIKey as any).mockResolvedValue('test-key');
    (streamReply as any).mockImplementation(() => {
      throw new Error('Transport failure: network error');
    });
    await useChatStore.getState().submitMessage();
    // user message should have been persisted (1 call), but no assistant error persisted
    const addCalls = (ChatService.AddMessage as any).mock.calls;
    const userCalls = addCalls.filter((c: any) => c[1] === 'user');
    const errorCalls = addCalls.filter((c: any) => c[1] === 'error');
    const assistantCalls = addCalls.filter((c: any) => c[1] === 'assistant');
    expect(userCalls.length).toBe(1);
    expect(errorCalls.length).toBe(0);
    expect(assistantCalls.length).toBe(0);
    // messages should contain user, but no error assistant message
    expect(useChatStore.getState().messages.some((m) => m.role === 'user')).toBe(true);
    expect(useChatStore.getState().messages.some((m) => m.role === 'error')).toBe(false);
    expect(useChatStore.getState().submitError).toBe(
      'Could not reach provider. Check your connection and provider URL.',
    );
    expect(notifications.error).toHaveBeenCalledWith(
      'Message failed',
      'Could not reach provider. Check your connection and provider URL.',
    );
    expect(useChatStore.getState().isLoading).toBe(false);
    // ensure streaming bubble was cleared (no lingering streaming)
    expect(useChatStore.getState().messages.some((m) => m.streaming)).toBe(false);
  });

  it('configuring a valid model restores submission', async () => {
    // start blocked
    useChatStore.setState({
      input: 'hello',
      provider: {
        id: 'p1',
        type: 'OpenAI',
        name: 'test',
        baseUrl: 'https://api.openai.com/v1',
        model: '',
        hasApiKey: true,
      } as any,
    });
    await useChatStore.getState().submitMessage();
    expect(useChatStore.getState().submitError).toBe('Select a model to start chatting');
    expect(ChatService.CreateChat).not.toHaveBeenCalled();

    // configure valid model
    (ProviderBindings.APIKey as any).mockResolvedValue('test-key');
    (streamReply as any).mockImplementation(async function* () {
      yield { type: 'text', text: 'ok' };
    });
    useChatStore.setState({
      input: 'hello again',
      provider: {
        id: 'p1',
        type: 'OpenAI',
        name: 'test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
        hasApiKey: true,
      } as any,
    });
    // also need to simulate setProvider clearing error via helper? manually clear via next submit will clear
    await useChatStore.getState().submitMessage();
    expect(useChatStore.getState().submitError).toBe(null);
    expect(useChatStore.getState().isLoading).toBe(false);
    // user and assistant should be persisted and messages contain assistant
    const addCalls = (ChatService.AddMessage as any).mock.calls;
    expect(addCalls.some((c: any) => c[1] === 'user' && c[2] === 'hello again')).toBe(true);
    expect(addCalls.some((c: any) => c[1] === 'assistant' && c[2] === 'ok')).toBe(true);
    expect(
      useChatStore.getState().messages.some((m) => m.role === 'assistant' && m.content === 'ok'),
    ).toBe(true);
  });

  it('existing valid chat flow remains unchanged (user + assistant persisted)', async () => {
    useChatStore.setState({
      input: 'valid prompt',
      selectedChatId: 'chat-1',
      provider: {
        id: 'p1',
        type: 'OpenAI',
        name: 'test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
        hasApiKey: true,
      } as any,
    });
    chatMessages.set('chat-1', []);
    (ProviderBindings.APIKey as any).mockResolvedValue('test-key');
    (streamReply as any).mockImplementation(async function* () {
      yield { type: 'text', text: 'assistant reply' };
    });
    await useChatStore.getState().submitMessage();
    expect(useChatStore.getState().submitError).toBe(null);
    const addCalls = (ChatService.AddMessage as any).mock.calls;
    expect(addCalls.filter((c: any) => c[1] === 'user').length).toBe(1);
    expect(addCalls.filter((c: any) => c[1] === 'assistant').length).toBe(1);
    const msgs = useChatStore.getState().messages;
    expect(msgs.some((m) => m.role === 'user' && m.content === 'valid prompt')).toBe(true);
    expect(msgs.some((m) => m.role === 'assistant' && m.content === 'assistant reply')).toBe(true);
    expect(msgs.some((m) => m.role === 'error')).toBe(false);
  });

  it('helper getProviderSetupError and isProviderReady work for Ollama', () => {
    expect(getProviderSetupError(undefined)).toBe('Select a model to start chatting');
    expect(
      getProviderSetupError({
        id: 'p1',
        type: 'Ollama',
        name: 'local',
        baseUrl: 'http://localhost:11434',
        model: '',
      } as any),
    ).toBe('Select a model to start chatting');
    expect(
      getProviderSetupError({
        id: 'p1',
        type: 'Ollama',
        name: 'local',
        baseUrl: 'http://localhost:11434',
        model: 'llama3',
        hasApiKey: false,
      } as any),
    ).toBe(null);
    expect(
      isProviderReady({
        id: 'p1',
        type: 'Ollama',
        name: 'local',
        baseUrl: 'http://localhost:11434',
        model: 'llama3',
      } as any),
    ).toBe(true);
    expect(
      isProviderReady({
        id: 'p1',
        type: 'OpenAI',
        name: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
        hasApiKey: false,
      } as any),
    ).toBe(false);
    expect(
      isProviderReady({
        id: 'p1',
        type: 'OpenAI',
        name: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
        hasApiKey: true,
      } as any),
    ).toBe(true);
  });

  it('submitError clears on input change and provider fix', async () => {
    useChatStore.setState({
      input: 'hello',
      provider: {
        id: 'p1',
        type: 'OpenAI',
        name: 'test',
        baseUrl: 'https://api.openai.com/v1',
        model: '',
        hasApiKey: true,
      } as any,
    });
    await useChatStore.getState().submitMessage();
    expect(useChatStore.getState().submitError).not.toBe(null);
    // input change clears error
    useChatStore.getState().setInput('new input');
    expect(useChatStore.getState().submitError).toBe(null);
    // set error again
    useChatStore.setState({
      input: 'hello',
      provider: {
        id: 'p1',
        type: 'OpenAI',
        name: 'test',
        baseUrl: 'https://api.openai.com/v1',
        model: '',
        hasApiKey: true,
      } as any,
    });
    await useChatStore.getState().submitMessage();
    expect(useChatStore.getState().submitError).not.toBe(null);
    // fixing provider via setProvider clears error
    useChatStore.getState().setProvider({
      id: 'p1',
      type: 'OpenAI',
      name: 'test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4',
      hasApiKey: true,
    } as any);
    expect(useChatStore.getState().submitError).toBe(null);
  });
});
