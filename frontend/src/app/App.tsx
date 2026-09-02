import { AppLayout } from '@/app/layout/app-layout';
import { ChatWorkspace } from '@/features/chat/components/chat-workspace';
import { EmptyState } from '@/features/chat/components/empty-state';
import { ChatComposer } from '@/features/chat/components/chat-composer';
import { isProviderReady, useChatStore } from '@/stores/chat-store';
import { useCallback, useEffect } from 'react';
import { RenameChatDialog } from '@/features/chat/components/rename-chat-dialog';
import type { Chat } from '@/services/chat';
import { useSettingsStore } from '@/stores/settings-store';
import { SettingsDialog } from '@/features/settings/components/settings-dialog';
import { useState } from 'react';
import { useProviderSync } from '@/features/providers/hooks/use-provider-sync';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { getUserFacingError } from '@/lib/error-message';
import { notifications } from '@/services/notifications';

type PendingConfirmation =
  | { kind: 'chat'; id: string }
  | { kind: 'all-chats' }
  | { kind: 'provider'; id: string; name: string };

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renamingChat, setRenamingChat] = useState<Chat | undefined>();
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>();
  const chats = useChatStore((s) => s.chats);
  const generatingChatIds = useChatStore((s) => s.generatingChatIds);
  const selectedChatId = useChatStore((s) => s.selectedChatId);
  const loadChats = useChatStore((s) => s.loadChats);
  const selectChat = useChatStore((s) => s.selectChat);
  const startNewChat = useChatStore((s) => s.startNewChat);
  const renameChat = useChatStore((s) => s.renameChat);
  const deleteChat = useChatStore((s) => s.deleteChat);
  const deleteAllChats = useChatStore((s) => s.deleteAllChats);
  useEffect(() => {
    void loadChats().catch((error) =>
      notifications.error(
        'Unable to load chats',
        getUserFacingError(error, 'Could not load chats.'),
      ),
    );
  }, [loadChats]);
  const name = useSettingsStore((s) => s.name);
  const bubbleColor = useSettingsStore((s) => s.userBubbleColor);
  const reduceTransparency = useSettingsStore((s) => s.reduceTransparency);
  const selectedModel = useSettingsStore((s) => s.selectedModel);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const {
    providers,
    activeProviderId,
    apiKey,
    apiKeyConfigured,
    setApiKey,
    handleModelSelect,
    handleDeleteProvider,
    onProviderChange,
    onActiveProviderChange,
    onApiKeySave,
    onApiKeyRemove,
    createProvider,
  } = useProviderSync({ settingsOpen });

  const handleDeleteAllChats = useCallback(() => {
    if (chats.length) setPendingConfirmation({ kind: 'all-chats' });
  }, [chats.length]);

  const onSelectChat = useCallback(
    (id: string) => {
      void selectChat(id).catch((error) =>
        notifications.error(
          'Unable to open chat',
          getUserFacingError(error, 'Could not open chat.'),
        ),
      );
    },
    [selectChat],
  );
  const onDeleteChat = useCallback((id: string) => {
    setPendingConfirmation({ kind: 'chat', id });
  }, []);
  const onDeleteProvider = useCallback(
    (id: string) => {
      const provider = providers.find((item) => item.id === id);
      if (provider && providers.length > 1) {
        setPendingConfirmation({ kind: 'provider', id, name: provider.name || 'this provider' });
      }
    },
    [providers],
  );
  const onSettings = useCallback(() => setSettingsOpen(true), []);

  return (
    <AppLayout
      providers={providers}
      activeModel={selectedModel?.modelId ?? ''}
      onModelSelect={handleModelSelect}
      onNewChat={startNewChat}
      chats={chats}
      generatingChatIds={generatingChatIds}
      selectedChatId={selectedChatId}
      onSelectChat={onSelectChat}
      onRenameChat={setRenamingChat}
      onDeleteChat={onDeleteChat}
      onSettings={onSettings}
    >
      <ChatViewport onOpenSettings={onSettings} />
      <SettingsDialog
        open={settingsOpen}
        name={name}
        bubbleColor={bubbleColor}
        reduceTransparency={reduceTransparency}
        onNameChange={(name) => setSettings({ name })}
        onBubbleColorChange={(userBubbleColor) => setSettings({ userBubbleColor })}
        onReduceTransparencyChange={(reduceTransparency) => setSettings({ reduceTransparency })}
        providers={providers}
        activeProviderId={activeProviderId ?? ''}
        apiKey={apiKey}
        apiKeyConfigured={apiKeyConfigured}
        onProviderChange={onProviderChange}
        onActiveProviderChange={onActiveProviderChange}
        onApiKeyChange={setApiKey}
        onApiKeySave={onApiKeySave}
        onApiKeyRemove={onApiKeyRemove}
        onDeleteProvider={onDeleteProvider}
        onCreateProvider={createProvider}
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
          if (renamingChat) {
            void renameChat(renamingChat.id, title).catch((error) =>
              notifications.error(
                'Unable to rename chat',
                getUserFacingError(error, 'Could not rename chat.'),
              ),
            );
          }
        }}
      />
      <ConfirmationDialog
        open={Boolean(pendingConfirmation)}
        title={
          pendingConfirmation?.kind === 'provider'
            ? 'Remove provider?'
            : pendingConfirmation?.kind === 'all-chats'
              ? 'Delete all chats?'
              : 'Delete this chat?'
        }
        description={
          pendingConfirmation?.kind === 'provider'
            ? `Remove ${pendingConfirmation.name} from this app?`
            : 'This cannot be undone.'
        }
        confirmLabel={pendingConfirmation?.kind === 'provider' ? 'Remove' : 'Delete'}
        onClose={() => setPendingConfirmation(undefined)}
        onConfirm={() => {
          if (!pendingConfirmation) return;
          if (pendingConfirmation.kind === 'chat') {
            void deleteChat(pendingConfirmation.id).catch((error) =>
              notifications.error(
                'Unable to delete chat',
                getUserFacingError(error, 'Could not delete chat.'),
              ),
            );
          }
          if (pendingConfirmation.kind === 'all-chats') {
            void deleteAllChats().catch((error) =>
              notifications.error(
                'Unable to delete chats',
                getUserFacingError(error, 'Could not delete chats.'),
              ),
            );
          }
          if (pendingConfirmation.kind === 'provider') {
            void handleDeleteProvider(pendingConfirmation.id);
          }
        }}
      />
    </AppLayout>
  );
}

function ChatViewport({ onOpenSettings }: { onOpenSettings: () => void }) {
  const messages = useChatStore((s) => s.messages);
  const input = useChatStore((s) => s.input);
  const isLoading = useChatStore((s) => s.isLoading);
  const providers = useChatStore((s) => s.providers);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const submitError = useChatStore((s) => s.submitError);
  const selectedChatId = useChatStore((s) => s.selectedChatId);
  const setInput = useChatStore((s) => s.setInput);
  const submitMessage = useChatStore((s) => s.submitMessage);
  const stopMessage = useChatStore((s) => s.stopMessage);
  const bubbleColor = useSettingsStore((s) => s.userBubbleColor);
  const name = useSettingsStore((s) => s.name);
  const handleSubmit = useCallback(() => void submitMessage(), [submitMessage]);
  const provider = providers.find((item) => item.id === selectedModel?.providerId);
  const canSend = isProviderReady(provider) && Boolean(selectedModel?.modelId);

  if (messages.length === 0) {
    return (
      <EmptyState userName={name}>
        <ChatComposer
          value={input}
          onValueChange={setInput}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          onStop={stopMessage}
          canSend={canSend}
          submitError={submitError}
          onOpenSettings={onOpenSettings}
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
      canSend={canSend}
      submitError={submitError}
      onOpenSettings={onOpenSettings}
    />
  );
}

export default App;
