import { AppLayout } from '@/components/shared/app-layout';
import { ChatWorkspace } from '@/components/shared/chat-workspace';
import { EmptyState } from '@/components/shared/empty-state';
import { ChatComposer } from '@/components/shared/chat-composer';
import { useChatStore } from '@/stores/chat-store';
import { useEffect } from 'react';
import { RenameChatDialog } from '@/components/shared/rename-chat-dialog';
import type { Chat } from '@/services/chat';
import { useSettingsStore } from '@/stores/settings-store';
import { SettingsDialog } from '@/components/shared/settings-dialog';
import { useRef, useState } from 'react';
import type { TextProvider } from '@/config/settings';
import * as ProviderService from '../bindings/changeme/internal/providers/service';

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const providers = useSettingsStore((s) => s.providers);
  const activeProviderId = useSettingsStore((s) => s.activeProviderId);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const providerSaveQueue = useRef(Promise.resolve());
  const [renamingChat, setRenamingChat] = useState<Chat | undefined>();
  const {
    chats,
    selectedChatId,
    messages,
    input,
    isLoading,
    loadChats,
    selectChat,
    startNewChat,
    setInput,
    submitMessage,
    stopMessage,
    renameChat,
    deleteChat,
    deleteAllChats,
    setProvider,
  } = useChatStore();
  useEffect(() => {
    void loadChats();
  }, [loadChats]);
  const provider = providers.find((item) => item.id === activeProviderId);
  useEffect(() => {
    void ProviderService.ListProviders().then((items) => {
      if (!items?.length) return;
      const selectedId = items.some((item) => item.id === activeProviderId)
        ? activeProviderId
        : items[0].id;
      setSettings({ providers: items as TextProvider[], activeProviderId: selectedId });
      setApiKeyConfigured(Boolean(items.find((item) => item.id === selectedId)?.hasApiKey));
    });
  }, []);
  useEffect(() => {
    if (!settingsOpen || !provider) return;
    void ProviderService.HasProviderAPIKey(provider.id).then(setApiKeyConfigured);
  }, [settingsOpen, provider?.id]);
  useEffect(() => {
    setApiKey('');
  }, [provider?.id]);
  const name = useSettingsStore((s) => s.name);
  const bubbleColor = useSettingsStore((s) => s.userBubbleColor);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const saveProvider = (value: TextProvider) => {
    const payload = { ...value, hasApiKey: value.hasApiKey ?? false };
    providerSaveQueue.current = providerSaveQueue.current
      .catch(() => undefined)
      .then(() => ProviderService.SaveProvider(payload));
  };
  useEffect(() => {
    setProvider(provider);
  }, [provider, setProvider]);

  const handleModelSelect = (providerId: string, modelId: string) => {
    const target = providers.find((p) => p.id === providerId);
    if (!target) return;
    setSettings({
      activeProviderId: providerId,
      providers: providers.map((p) => (p.id === providerId ? { ...p, model: modelId } : p)),
    });
    void ProviderService.SaveProvider({
      ...target,
      model: modelId,
      hasApiKey: target.hasApiKey ?? false,
    });
  };

  const handleDeleteProvider = (id: string) => {
    const target = providers.find((item) => item.id === id);
    if (
      !target ||
      providers.length <= 1 ||
      !window.confirm(`Remove ${target.name || 'this provider'}?`)
    )
      return;
    void ProviderService.DeleteProvider(id)
      .then(() => {
        const remaining = providers.filter((item) => item.id !== id);
        setSettings({ providers: remaining, activeProviderId: remaining[0]?.id ?? '' });
      })
      .catch((error) => console.error('Unable to delete provider', error));
  };

  const handleDeleteAllChats = () => {
    if (!chats.length || !window.confirm('Delete all chats? This cannot be undone.')) return;
    void deleteAllChats().catch((error) => console.error('Unable to delete all chats', error));
  };

  return (
    <AppLayout
      providers={providers}
      activeModel={provider?.model ?? ''}
      onModelSelect={handleModelSelect}
      onNewChat={startNewChat}
      chats={chats}
      selectedChatId={selectedChatId}
      onSelectChat={(id) => void selectChat(id)}
      onRenameChat={setRenamingChat}
      onDeleteChat={(id) => {
        if (window.confirm('Delete this chat?')) void deleteChat(id);
      }}
      onSettings={() => setSettingsOpen(true)}
    >
      {messages.length === 0 ? (
        <EmptyState userName={name}>
          <ChatComposer
            value={input}
            onValueChange={setInput}
            isLoading={isLoading}
            onSubmit={() => void submitMessage()}
            onStop={stopMessage}
          />
        </EmptyState>
      ) : (
        <ChatWorkspace
          messages={messages}
          userBubbleColor={bubbleColor}
          isLoading={isLoading}
          onSubmit={() => void submitMessage()}
          onStop={stopMessage}
          input={input}
          onValueChange={setInput}
        />
      )}
      <SettingsDialog
        open={settingsOpen}
        name={name}
        bubbleColor={bubbleColor}
        onNameChange={(name) => setSettings({ name })}
        onBubbleColorChange={(userBubbleColor) => setSettings({ userBubbleColor })}
        providers={providers}
        activeProviderId={activeProviderId}
        apiKey={apiKey}
        onProviderChange={(provider) => {
          setSettings({
            providers: providers.map((item) => (item.id === provider.id ? provider : item)),
          });
          saveProvider(provider);
        }}
        onActiveProviderChange={(activeProviderId) => {
          setSettings({ activeProviderId });
          setApiKey('');
        }}
        apiKeyConfigured={apiKeyConfigured}
        onApiKeyChange={setApiKey}
        onApiKeySave={() => {
          if (!provider || !apiKey.trim()) return;
          void ProviderService.SetProviderAPIKey(provider.id, apiKey)
            .then(() => {
              setSettings({
                providers: providers.map((item) =>
                  item.id === provider.id ? { ...item, hasApiKey: true } : item,
                ),
              });
              setApiKey('');
              setApiKeyConfigured(true);
            })
            .catch((error) => console.error('Unable to save provider API key', error));
        }}
        onApiKeyRemove={() => {
          if (!provider) return;
          void ProviderService.DeleteProviderAPIKey(provider.id)
            .then(() => {
              setSettings({
                providers: providers.map((item) =>
                  item.id === provider.id ? { ...item, hasApiKey: false } : item,
                ),
              });
              setApiKeyConfigured(false);
              setApiKey('');
            })
            .catch((error) => console.error('Unable to remove provider API key', error));
        }}
        onAddProvider={() => {
          const newProvider: TextProvider = {
            id: `provider-${Date.now()}`,
            name: 'New provider',
            type: 'OpenAI-compatible',
            baseUrl: '',
            model: '',
          };
          setSettings({ providers: [...providers, newProvider], activeProviderId: newProvider.id });
          saveProvider(newProvider);
        }}
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

export default App;
