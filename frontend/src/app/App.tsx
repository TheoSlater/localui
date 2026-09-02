import { AppLayout } from '@/app/layout/app-layout';
import { ChatWorkspace } from '@/features/chat/components/chat-workspace';
import { EmptyState } from '@/features/chat/components/empty-state';
import { ChatComposer } from '@/features/chat/components/chat-composer';
import { useChatStore } from '@/stores/chat-store';
import { useCallback, useEffect } from 'react';
import { RenameChatDialog } from '@/features/chat/components/rename-chat-dialog';
import type { Chat } from '@/services/chat';
import { useSettingsStore } from '@/stores/settings-store';
import { SettingsDialog } from '@/features/settings/components/settings-dialog';
import { useState } from 'react';
import { useProviderSync } from '@/features/providers/hooks/use-provider-sync';

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renamingChat, setRenamingChat] = useState<Chat | undefined>();
  const chats = useChatStore((s) => s.chats);
  const selectedChatId = useChatStore((s) => s.selectedChatId);
  const loadChats = useChatStore((s) => s.loadChats);
  const selectChat = useChatStore((s) => s.selectChat);
  const startNewChat = useChatStore((s) => s.startNewChat);
  const renameChat = useChatStore((s) => s.renameChat);
  const deleteChat = useChatStore((s) => s.deleteChat);
  const deleteAllChats = useChatStore((s) => s.deleteAllChats);
  useEffect(() => {
    void loadChats();
  }, [loadChats]);
  const name = useSettingsStore((s) => s.name);
  const bubbleColor = useSettingsStore((s) => s.userBubbleColor);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const {
    providers,
    activeProviderId,
    provider,
    apiKey,
    apiKeyConfigured,
    setApiKey,
    handleModelSelect,
    handleDeleteProvider,
    onProviderChange,
    onActiveProviderChange,
    onApiKeySave,
    onApiKeyRemove,
    onAddProvider,
  } = useProviderSync({ settingsOpen });

  const handleDeleteAllChats = useCallback(() => {
    if (!chats.length || !window.confirm('Delete all chats? This cannot be undone.')) return;
    void deleteAllChats().catch((error) => console.error('Unable to delete all chats', error));
  }, [chats.length, deleteAllChats]);

  const onSelectChat = useCallback((id: string) => void selectChat(id), [selectChat]);
  const onDeleteChat = useCallback(
    (id: string) => {
      if (window.confirm('Delete this chat?')) void deleteChat(id);
    },
    [deleteChat],
  );
  const onSettings = useCallback(() => setSettingsOpen(true), []);

  return (
    <AppLayout
      providers={providers}
      activeModel={provider?.model ?? ''}
      onModelSelect={handleModelSelect}
      onNewChat={startNewChat}
      chats={chats}
      selectedChatId={selectedChatId}
      onSelectChat={onSelectChat}
      onRenameChat={setRenamingChat}
      onDeleteChat={onDeleteChat}
      onSettings={onSettings}
    >
      <ChatViewport />
      <SettingsDialog
        open={settingsOpen}
        name={name}
        bubbleColor={bubbleColor}
        onNameChange={(name) => setSettings({ name })}
        onBubbleColorChange={(userBubbleColor) => setSettings({ userBubbleColor })}
        providers={providers}
        activeProviderId={activeProviderId}
        apiKey={apiKey}
        apiKeyConfigured={apiKeyConfigured}
        onProviderChange={onProviderChange}
        onActiveProviderChange={onActiveProviderChange}
        onApiKeyChange={setApiKey}
        onApiKeySave={onApiKeySave}
        onApiKeyRemove={onApiKeyRemove}
        onAddProvider={onAddProvider}
        onDeleteProvider={handleDeleteProvider}
        hasChats={chats.length > 0}
        onDeleteAllChats={handleDeleteAllChats}
        onClose={() => {
          setSettingsOpen(false);
          setApiKey('');
        }}
      />
      <RenameChatDialog
        chat={renamingChat}
        onClose={() => setRenamingChat(undefined)}
        onSave={(title) => {
          if (renamingChat) void renameChat(renamingChat.id, title);
        }}
      />
    </AppLayout>
  );
}

function ChatViewport() {
  const messages = useChatStore((s) => s.messages);
  const input = useChatStore((s) => s.input);
  const isLoading = useChatStore((s) => s.isLoading);
  const selectedChatId = useChatStore((s) => s.selectedChatId);
  const setInput = useChatStore((s) => s.setInput);
  const submitMessage = useChatStore((s) => s.submitMessage);
  const stopMessage = useChatStore((s) => s.stopMessage);
  const bubbleColor = useSettingsStore((s) => s.userBubbleColor);
  const name = useSettingsStore((s) => s.name);
  const handleSubmit = useCallback(() => void submitMessage(), [submitMessage]);

  if (messages.length === 0) {
    return (
      <EmptyState userName={name}>
        <ChatComposer
          value={input}
          onValueChange={setInput}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          onStop={stopMessage}
        />
      </EmptyState>
    );
  }
  return (
    <ChatWorkspace
      key={selectedChatId ?? 'new-chat'}
      messages={messages}
      userBubbleColor={bubbleColor}
      isLoading={isLoading}
      onSubmit={handleSubmit}
      onStop={stopMessage}
      input={input}
      onValueChange={setInput}
    />
  );
}

export default App;
