import { create } from 'zustand';
import { ChatService, type Chat, type Message } from '@/services/chat';
import { isCompleteHttpUrl, type TextProvider } from '@/config/settings';
import { streamReply } from '@/agent/text-generation';
import * as ProviderService from '../../bindings/changeme/internal/providers/service';

export type ChatMessage = Omit<Message, 'role'> & {
  role: 'user' | 'assistant' | 'error';
  streaming?: boolean;
  reasoning?: string;
};

type ChatState = {
  chats: Chat[];
  selectedChatId?: string;
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  provider?: TextProvider;
  setProvider: (provider: TextProvider | undefined) => void;
  loadChats: () => Promise<void>;
  selectChat: (id: string) => Promise<void>;
  startNewChat: () => void;
  renameChat: (id: string, title: string) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
  deleteAllChats: () => Promise<void>;
  setInput: (input: string) => void;
  submitMessage: () => Promise<void>;
  stopMessage: () => void;
};

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

async function getProviderKey(id: string): Promise<string> {
  try {
    return await ProviderService.APIKey(id);
  } catch {
    throw new Error('Add an API key in Settings first.');
  }
}

export const useChatStore = create<ChatState>((set, get) => {
  const activeRequest: { current?: ActiveRequest } = {};
  let chatGeneration = 0;

  return {
    chats: [],
    selectedChatId: undefined,
    messages: [],
    input: '',
    isLoading: false,
    setProvider: (provider) => set({ provider }),
    loadChats: async () => {
      const generation = chatGeneration;
      const chats = (await ChatService.ListChats()) ?? [];
      if (generation !== chatGeneration) return;
      set({ chats, selectedChatId: chats[0]?.id });
      if (chats[0]) await get().selectChat(chats[0].id);
    },
    selectChat: async (id) => {
      const generation = chatGeneration;
      activeRequest.current?.controller.abort();
      const messages = toViewMessages(await ChatService.ListMessages(id));
      if (generation !== chatGeneration) return;
      set({ selectedChatId: id, messages, input: '', isLoading: false });
    },
    startNewChat: () => {
      activeRequest.current?.controller.abort();
      set({ selectedChatId: undefined, messages: [], input: '', isLoading: false });
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
      if (activeRequest.current?.chatId === id) activeRequest.current.controller.abort();
      await ChatService.DeleteChat(id);
      const chats = (await ChatService.ListChats()) ?? [];
      const selected = get().selectedChatId === id;
      set({ chats, ...(selected ? { selectedChatId: undefined, messages: [] } : {}) });
    },
    deleteAllChats: async () => {
      chatGeneration += 1;
      activeRequest.current?.controller.abort();
      await ChatService.DeleteAllChats();
      set({ chats: [], selectedChatId: undefined, messages: [], input: '', isLoading: false });
    },
    setInput: (input) => set({ input }),
    stopMessage: () => activeRequest.current?.controller.abort(),
    submitMessage: async () => {
      const { input } = get();
      const content = input.trim();
      if (!content || get().isLoading) return;
      const generation = chatGeneration;
      const isStale = () => generation !== chatGeneration;
      set({ isLoading: true });
      let chatId: string | undefined = get().selectedChatId;
      let replyId: string | undefined;

      try {
        if (!chatId) {
          const chat = await ChatService.CreateChat(content.slice(0, 60));
          if (isStale()) return;
          chatId = chat.id;
          set((state) => ({ chats: [chat, ...state.chats], selectedChatId: chatId }));
        }
        await ChatService.AddMessage(chatId, 'user', content, '');
        if (isStale()) return;
        const savedUserMessages = await ChatService.ListMessages(chatId);
        if (isStale()) return;
        set({ messages: toViewMessages(savedUserMessages), input: '' });

        const provider = get().provider;
        if (!provider) throw new Error('Select a provider in Settings first.');
        if (!isCompleteHttpUrl(provider.baseUrl)) {
          throw new Error('Add a complete http or https Base URL in Settings first.');
        }
        if (!provider.model.trim()) throw new Error('Add a Model in Settings first.');
        const apiKey = await getProviderKey(provider.id);
        if (isStale()) return;
        const controller = new AbortController();
        replyId = `assistant-${Date.now()}`;
        activeRequest.current = { controller, chatId, replyId };
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: replyId!,
              chatId: chatId!,
              role: 'assistant',
              content: '',
              createdAt: Date.now(),
              streaming: true,
            },
          ],
        }));

        let reply = '';
        let reasoning = '';
        for await (const chunk of streamReply(provider, apiKey, content, controller.signal)) {
          if (isStale()) return;
          if (chunk.type === 'reasoning') reasoning += chunk.text;
          if (chunk.type === 'text') reply += chunk.text;
          set((state) => ({
            messages: state.messages.map((message) =>
              message.id === replyId
                ? { ...message, content: reply, reasoning: reasoning || undefined }
                : message,
            ),
          }));
        }
        if (isStale()) return;
        if (reply || reasoning) await ChatService.AddMessage(chatId, 'assistant', reply, reasoning);
        if (isStale()) return;
        const savedMessages = await ChatService.ListMessages(chatId);
        const chats = await ChatService.ListChats();
        if (isStale()) return;
        const savedViewMessages = toViewMessages(savedMessages);
        set({
          messages: savedViewMessages,
          chats: chats ?? [],
        });
      } catch (error) {
        if (isStale() || activeRequest.current?.controller.signal.aborted) {
          set((state) => ({
            messages: state.messages.map((message) =>
              message.id === replyId ? { ...message, streaming: false } : message,
            ),
          }));
          return;
        }
        const message = error instanceof Error ? error.message : 'Text generation failed.';
        console.error('Unable to generate chat reply', error);
        const errorItem: ChatMessage = {
          id: `error-${Date.now()}`,
          chatId: chatId ?? '',
          role: 'error',
          content: message,
          createdAt: Date.now(),
        };
        set((state) => ({
          messages: replyId
            ? state.messages.map((item) =>
                item.id === replyId ? { ...item, ...errorItem, streaming: false } : item,
              )
            : [...state.messages, errorItem],
        }));
        if (chatId) {
          try {
            await ChatService.AddMessage(chatId, 'error', message, '');
          } catch (persistError) {
            console.error('Unable to persist chat error', persistError);
          }
        }
      } finally {
        if (activeRequest.current?.replyId === replyId) activeRequest.current = undefined;
        if (generation === chatGeneration) set({ isLoading: false });
      }
    },
  };
});
