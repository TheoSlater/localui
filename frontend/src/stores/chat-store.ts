import { create } from 'zustand';
import { ChatService, type Chat, type Message } from '@/services/chat';
import { isCompleteHttpUrl, type SelectedModel, type TextProvider } from '@/config/settings';
import { generateChatTitle, streamReply } from '@/agent/text-generation';
import { getProviderApiKey } from '@/services/providers';
import { createStreamScheduler } from '@/lib/stream-scheduler';
import { getUserFacingError } from '@/lib/error-message';
import { notifications } from '@/services/notifications';

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
  regenerateMessage: (messageId: string) => Promise<void>;
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

function isDefaultChatTitle(title: string, firstUserMessage: string): boolean {
  const trimmedTitle = title.trim();
  const defaultPreview = firstUserMessage.trim().slice(0, 60);
  return !trimmedTitle || trimmedTitle === 'New Chat' || trimmedTitle === defaultPreview;
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
    regenerateMessage: async (messageId) => {
      const chatId = get().selectedChatId;
      if (!chatId || get().isLoading) return;
      const messages = toViewMessages(await ChatService.ListMessages(chatId));
      const assistantIndex = messages.findIndex((message) => message.id === messageId);
      const userMessage = messages[assistantIndex - 1];
      if (
        assistantIndex < 1 ||
        messages[assistantIndex]?.role !== 'assistant' ||
        userMessage?.role !== 'user'
      )
        return;

      await ChatService.DeleteMessage(messageId);
      await ChatService.DeleteMessage(userMessage.id);
      set({ input: userMessage.content });
      await get().submitMessage();
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
      const showSubmitError = (message: string) => {
        if (isSelectedTarget()) set({ submitError: message });
        notifications.error('Unable to send message', message);
      };

      const selected = get().selectedModel;
      const provider =
        get().providers.find((item) => item.id === selected?.providerId) ?? get().provider;
      const modelId = selected?.modelId ?? provider?.model;
      const setupError = getProviderSetupError(provider, modelId);
      if (setupError) {
        showSubmitError(setupError);
        return;
      }

      set({ isLoading: true, submitError: null });
      let apiKey = '';
      if (provider!.type !== 'Ollama') {
        try {
          apiKey = await getProviderApiKey(provider!.id);
        } catch {
          const message = 'Add an API key in Settings first.';
          if (isSelectedTarget()) set({ isLoading: false, submitError: message });
          notifications.error('Unable to send message', message);
          return;
        }
        if (!apiKey.trim()) {
          const message = 'Add an API key in Settings first.';
          if (isSelectedTarget()) set({ isLoading: false, submitError: message });
          notifications.error('Unable to send message', message);
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
      let titleBeforeGeneration = chatId
        ? (get().chats.find((chat) => chat.id === chatId)?.title ?? '')
        : undefined;

      let controller: AbortController | undefined;
      try {
        if (!chatId) {
          const chat = await ChatService.CreateChat(content.slice(0, 60));
          chatId = chat.id;
          titleBeforeGeneration = chat.title;
          set((state) => ({
            chats: [chat, ...state.chats],
            ...(state.selectedChatId === undefined && selectionGeneration === initialSelection
              ? { selectedChatId: chatId }
              : {}),
          }));
        }
        await ChatService.AddMessage(chatId, 'user', content, '');
        const savedUserMessages = await ChatService.ListMessages(chatId);
        const firstUserMessage = savedUserMessages?.find((message) => message.role === 'user');
        const isFirstUserMessage =
          (savedUserMessages ?? []).filter((message) => message.role === 'user').length === 1;
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

        const currentChatTitle =
          get().chats.find((chat) => chat.id === targetChatId)?.title ??
          titleBeforeGeneration ??
          '';
        if (
          isFirstUserMessage &&
          firstUserMessage?.content &&
          isDefaultChatTitle(currentChatTitle, firstUserMessage.content)
        ) {
          async function generateAndSaveTitle() {
            const title = await generateChatTitle(
              provider!,
              modelId!,
              apiKey,
              firstUserMessage!.content,
            );
            if (!title) {
              notifications.warning(
                'Chat title unavailable',
                'Model returned an invalid title. The default title was kept.',
              );
              return;
            }
            const latestChats = (await ChatService.ListChats()) ?? [];
            const latestChat = latestChats.find((chat) => chat.id === targetChatId);
            if (
              !latestChat ||
              (titleBeforeGeneration && latestChat.title !== titleBeforeGeneration) ||
              !isDefaultChatTitle(latestChat.title, firstUserMessage!.content)
            )
              return;
            const currentChat = get().chats.find((chat) => chat.id === targetChatId);
            if (!currentChat || !isDefaultChatTitle(currentChat.title, firstUserMessage!.content))
              return;
            await ChatService.UpdateChatTitle(targetChatId, title);
            set((state) => ({
              chats: state.chats.map((chat) =>
                chat.id === targetChatId ? { ...chat, title } : chat,
              ),
            }));
          }

          void generateAndSaveTitle().catch((error) => {
            notifications.warning(
              'Chat title unavailable',
              getUserFacingError(error, 'Could not generate a chat title.'),
            );
          });
        }

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
          const refreshedChats = (chats ?? state.chats).map((chat) => {
            const currentChat = state.chats.find((item) => item.id === chat.id);
            if (
              chat.id === chatId &&
              currentChat &&
              firstUserMessage?.content &&
              !isDefaultChatTitle(currentChat.title, firstUserMessage.content)
            ) {
              return { ...chat, title: currentChat.title };
            }
            return chat;
          });
          return {
            streamingMessages,
            chats: refreshedChats,
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
        const message = getUserFacingError(error, 'Text generation failed.');
        console.error('Unable to generate chat reply', error);
        notifications.error('Message failed', message);
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
