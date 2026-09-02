import { create } from 'zustand';
import { ChatService, type Chat, type Message } from '@/services/chat';
import { isCompleteHttpUrl, type SelectedModel, type TextProvider } from '@/config/settings';
import { streamReply } from '@/agent/text-generation';
import { getProviderApiKey } from '@/services/providers';
import { createStreamScheduler } from '@/lib/stream-scheduler';

export type ChatMessage = Omit<Message, 'role'> & {
  role: 'user' | 'assistant' | 'error';
  streaming?: boolean;
  reasoning?: string;
};

type ChatState = {
  chats: Chat[];
  selectedChatId?: string;
  messages: ChatMessage[];
  streamingMessages: Record<string, ChatMessage>;
  generatingChatIds: string[];
  input: string;
  isLoading: boolean;
  submitError: string | null;
  providers: TextProvider[];
  selectedModel?: SelectedModel;
  /** Legacy test/install bridge; chat prefers selectedModel. */
  provider?: TextProvider;
  setProvider: (provider: TextProvider | undefined) => void;
  setModelSelection: (providers: TextProvider[], selectedModel?: SelectedModel) => void;
  loadChats: () => Promise<void>;
  selectChat: (id: string) => Promise<void>;
  startNewChat: () => void;
  renameChat: (id: string, title: string) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
  deleteAllChats: () => Promise<void>;
  setInput: (input: string) => void;
  clearSubmitError: () => void;
  submitMessage: () => Promise<void>;
  stopMessage: () => void;
};

export function getProviderSetupError(
  provider: TextProvider | undefined,
  modelId?: string,
): string | null {
  if (!provider) return 'Select a model to start chatting';
  if (!isCompleteHttpUrl(provider.baseUrl ?? '')) {
    return 'Add a complete http or https Base URL in Settings first.';
  }
  if (!(modelId ?? provider.model)?.trim()) return 'Select a model to start chatting';
  if (provider.type !== 'Ollama' && provider.hasApiKey === false) {
    return 'Add an API key in Settings first.';
  }
  return null;
}

export function isProviderReady(provider: TextProvider | undefined): boolean {
  return getProviderSetupError(provider) === null;
}

type ActiveRequest = {
  controller: AbortController;
  chatId: string;
  replyId: string;
};

function toViewMessages(items: Message[] | null | undefined): ChatMessage[] {
  return (items ?? []).map((message) => ({
    ...message,
    role: message.role as ChatMessage['role'],
  }));
}

export const useChatStore = create<ChatState>((set, get) => {
  const activeRequests = new Map<string, ActiveRequest>();
  let selectionGeneration = 0;

  return {
    chats: [],
    selectedChatId: undefined,
    messages: [],
    streamingMessages: {},
    generatingChatIds: [],
    input: '',
    isLoading: false,
    submitError: null,
    providers: [],
    selectedModel: undefined,
    provider: undefined,
    setProvider: (provider) =>
      set((state) => ({
        provider,
        submitError: isProviderReady(provider) && state.submitError ? null : state.submitError,
      })),
    setModelSelection: (providers, selectedModel) =>
      set({ providers, selectedModel, submitError: null }),
    loadChats: async () => {
      const generation = selectionGeneration;
      const chats = (await ChatService.ListChats()) ?? [];
      if (generation !== selectionGeneration) return;
      set({ chats });
      if (chats[0]) await get().selectChat(chats[0].id);
      else set({ selectedChatId: undefined, messages: [], isLoading: false });
    },
    selectChat: async (id) => {
      const generation = ++selectionGeneration;
      const messages = toViewMessages(await ChatService.ListMessages(id));
      if (generation !== selectionGeneration) return;
      const streaming = get().streamingMessages[id];
      set({
        selectedChatId: id,
        messages: streaming ? [...messages, streaming] : messages,
        input: '',
        isLoading: activeRequests.has(id),
        submitError: null,
      });
    },
    startNewChat: () => {
      selectionGeneration += 1;
      set({
        selectedChatId: undefined,
        messages: [],
        input: '',
        isLoading: false,
        submitError: null,
      });
    },
    renameChat: async (id, title) => {
      const next = title.trim();
      if (!next) return;
      await ChatService.UpdateChatTitle(id, next);
      set((state) => ({
        chats: state.chats.map((chat) => (chat.id === id ? { ...chat, title: next } : chat)),
      }));
    },
    deleteChat: async (id) => {
      activeRequests.get(id)?.controller.abort();
      await ChatService.DeleteChat(id);
      const chats = (await ChatService.ListChats()) ?? [];
      set((state) => {
        const streamingMessages = { ...state.streamingMessages };
        delete streamingMessages[id];
        const selected = state.selectedChatId === id;
        return {
          chats,
          streamingMessages,
          generatingChatIds: state.generatingChatIds.filter((chatId) => chatId !== id),
          ...(selected ? { selectedChatId: undefined, messages: [], isLoading: false } : {}),
        };
      });
    },
    deleteAllChats: async () => {
      selectionGeneration += 1;
      activeRequests.forEach(({ controller }) => controller.abort());
      activeRequests.clear();
      await ChatService.DeleteAllChats();
      set({
        chats: [],
        selectedChatId: undefined,
        messages: [],
        streamingMessages: {},
        generatingChatIds: [],
        input: '',
        isLoading: false,
        submitError: null,
      });
    },
    setInput: (input) =>
      set((state) => ({ input, submitError: state.submitError ? null : state.submitError })),
    clearSubmitError: () => set({ submitError: null }),
    stopMessage: () => {
      const chatId = get().selectedChatId;
      if (chatId) activeRequests.get(chatId)?.controller.abort();
    },
    submitMessage: async () => {
      const { input } = get();
      const content = input.trim();
      if (!content || get().isLoading) return;
      const initialChatId = get().selectedChatId;
      const initialSelection = selectionGeneration;
      const isSelectedTarget = () => get().selectedChatId === initialChatId;

      const selected = get().selectedModel;
      const provider =
        get().providers.find((item) => item.id === selected?.providerId) ?? get().provider;
      const modelId = selected?.modelId ?? provider?.model;
      const setupError = getProviderSetupError(provider, modelId);
      if (setupError) {
        if (isSelectedTarget()) set({ submitError: setupError });
        return;
      }

      set({ isLoading: true, submitError: null });
      let apiKey = '';
      if (provider!.type !== 'Ollama') {
        try {
          apiKey = await getProviderApiKey(provider!.id);
        } catch {
          if (isSelectedTarget())
            set({ isLoading: false, submitError: 'Add an API key in Settings first.' });
          return;
        }
        if (!apiKey.trim()) {
          if (isSelectedTarget())
            set({ isLoading: false, submitError: 'Add an API key in Settings first.' });
          return;
        }
      } else {
        try {
          apiKey = await getProviderApiKey(provider!.id);
        } catch {
          apiKey = '';
        }
      }

      let chatId: string | undefined = initialChatId;
      let replyId: string | undefined;

      let controller: AbortController | undefined;
      try {
        if (!chatId) {
          const chat = await ChatService.CreateChat(content.slice(0, 60));
          chatId = chat.id;
          set((state) => ({
            chats: [chat, ...state.chats],
            ...(state.selectedChatId === undefined && selectionGeneration === initialSelection
              ? { selectedChatId: chatId }
              : {}),
          }));
        }
        await ChatService.AddMessage(chatId, 'user', content, '');
        const savedUserMessages = await ChatService.ListMessages(chatId);
        controller = new AbortController();
        replyId = `assistant-${chatId}-${Date.now()}`;
        if (!chatId) throw new Error('Missing chat');
        const targetChatId = chatId;
        const streamingMessage: ChatMessage = {
          id: replyId,
          chatId: targetChatId,
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
          streaming: true,
        };
        activeRequests.set(targetChatId, { controller, chatId: targetChatId, replyId });
        set((state) => ({
          streamingMessages: { ...state.streamingMessages, [targetChatId]: streamingMessage },
          generatingChatIds: state.generatingChatIds.includes(targetChatId)
            ? state.generatingChatIds
            : [...state.generatingChatIds, targetChatId],
          ...(state.selectedChatId === targetChatId
            ? {
                messages: [...toViewMessages(savedUserMessages), streamingMessage],
                input: '',
              }
            : {}),
        }));

        let reply = '';
        let reasoning = '';
        let pendingReply = '';
        let pendingReasoning = '';
        let lastFlushedReply = '';
        let lastFlushedReasoning = '';
        const flushStreaming = (snapshotReply: string, snapshotReasoning: string) => {
          if (!activeRequests.get(chatId!) || activeRequests.get(chatId!)?.replyId !== replyId)
            return;
          set((state) => {
            const current = state.streamingMessages[chatId!];
            if (!current || current.id !== replyId) return {};
            const nextMessage = {
              ...current,
              content: snapshotReply,
              reasoning: snapshotReasoning || undefined,
            };
            const nextMessages =
              state.selectedChatId === chatId
                ? state.messages.some((message) => message.id === replyId)
                  ? state.messages.map((message) =>
                      message.id === replyId ? nextMessage : message,
                    )
                  : [...state.messages, nextMessage]
                : state.messages;
            return {
              streamingMessages: { ...state.streamingMessages, [chatId!]: nextMessage },
              ...(state.selectedChatId === chatId ? { messages: nextMessages } : {}),
            };
          });
        };
        const scheduler = createStreamScheduler(() => {
          if (!activeRequests.has(chatId!)) return;
          if (pendingReply === lastFlushedReply && pendingReasoning === lastFlushedReasoning)
            return;
          lastFlushedReply = pendingReply;
          lastFlushedReasoning = pendingReasoning;
          flushStreaming(pendingReply, pendingReasoning);
        }, 32);
        try {
          for await (const chunk of streamReply(
            provider!,
            modelId!,
            apiKey,
            savedUserMessages ?? [],
            controller.signal,
          )) {
            if (!activeRequests.has(chatId)) return;
            if (chunk.type === 'reasoning') {
              reasoning += chunk.text;
              pendingReasoning = reasoning;
            }
            if (chunk.type === 'text') {
              reply += chunk.text;
              pendingReply = reply;
            }
            scheduler.schedule();
          }
        } finally {
          scheduler.dispose();
        }
        if (!activeRequests.has(chatId)) return;
        if (reply !== lastFlushedReply || reasoning !== lastFlushedReasoning) {
          flushStreaming(reply, reasoning);
        }
        if (reply || reasoning) await ChatService.AddMessage(chatId, 'assistant', reply, reasoning);
        const savedMessages = await ChatService.ListMessages(chatId);
        const chats = await ChatService.ListChats();
        const savedViewMessages = toViewMessages(savedMessages);
        set((state) => {
          const streamingMessages = { ...state.streamingMessages };
          delete streamingMessages[chatId!];
          return {
            streamingMessages,
            chats: chats ?? state.chats,
            ...(state.selectedChatId === chatId ? { messages: savedViewMessages } : {}),
          };
        });
      } catch (error) {
        const aborted = controller?.signal.aborted ?? false;
        if (aborted || (replyId && (!chatId || !activeRequests.has(chatId)))) {
          if (chatId && activeRequests.has(chatId)) {
            set((state) => {
              const streamingMessages = { ...state.streamingMessages };
              delete streamingMessages[chatId!];
              return {
                streamingMessages,
                ...(state.selectedChatId === chatId && replyId
                  ? {
                      messages: state.messages.map((item) =>
                        item.id === replyId ? { ...item, streaming: false } : item,
                      ),
                    }
                  : {}),
              };
            });
          }
          return;
        }
        const message = error instanceof Error ? error.message : 'Text generation failed.';
        console.error('Unable to generate chat reply', error);
        set((state) => {
          const streamingMessages = { ...state.streamingMessages };
          delete streamingMessages[chatId!];
          return {
            streamingMessages,
            ...(state.selectedChatId === chatId
              ? {
                  messages: replyId
                    ? state.messages.map((item) =>
                        item.id === replyId ? { ...item, streaming: false } : item,
                      )
                    : state.messages,
                  submitError: message,
                }
              : {}),
          };
        });
      } finally {
        if (chatId && activeRequests.get(chatId)?.replyId === replyId) {
          activeRequests.delete(chatId);
          set((state) => ({
            generatingChatIds: state.generatingChatIds.filter((id) => id !== chatId),
            ...(state.selectedChatId === chatId ? { isLoading: false } : {}),
          }));
        } else if (isSelectedTarget()) {
          set({ isLoading: false });
        }
      }
    },
  };
});
