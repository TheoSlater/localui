import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatStore } from '@/stores/chat-store';
import { useSettingsStore } from '@/stores/settings-store';
import type { TextProvider } from '@/config/settings';
import {
  deleteProvider as deleteProviderBackend,
  deleteProviderApiKey,
  hasProviderApiKey,
  listProviders,
  saveProvider as saveProviderBackend,
  setProviderApiKey,
} from '@/services/providers';

export interface UseProviderSyncOptions {
  settingsOpen: boolean;
}

export function useProviderSync({ settingsOpen }: UseProviderSyncOptions) {
  const providers = useSettingsStore((s) => s.providers);
  const selectedModel = useSettingsStore((s) => s.selectedModel);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const setModelSelection = useChatStore((s) => s.setModelSelection);
  const setProvider = useChatStore((s) => s.setProvider);
  const [editingProviderId, setEditingProviderId] = useState<string>();

  const [apiKey, setApiKey] = useState('');
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const providerSaveQueue = useRef(Promise.resolve());

  const provider = useMemo(
    () => providers.find((item) => item.id === editingProviderId) ?? providers[0],
    [providers, editingProviderId],
  );

  // Initial provider sync from Go/backend
  useEffect(() => {
    let cancelled = false;
    void listProviders().then((items) => {
      if (cancelled) return;
      if (!items?.length) return;
      const stored = useSettingsStore.getState();
      const storedDefault = stored.defaultModel;
      const nextSelectedModel =
        stored.selectedModel ??
        (storedDefault && items.some((item) => item.id === storedDefault.providerId)
          ? storedDefault
          : undefined);
      setSettings({ providers: items as TextProvider[], selectedModel: nextSelectedModel });
      setEditingProviderId((current) =>
        current && items.some((item) => item.id === current) ? current : items[0].id,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [setSettings]);

  // API-key status sync when settings opens or provider changes
  useEffect(() => {
    if (!settingsOpen || !provider) return;
    let cancelled = false;
    void hasProviderApiKey(provider.id).then((has) => {
      if (!cancelled) setApiKeyConfigured(has);
    });
    return () => {
      cancelled = true;
    };
  }, [settingsOpen, provider?.id]);

  // Clear apiKey input when active provider changes
  useEffect(() => {
    setApiKey('');
  }, [provider?.id]);

  // Chat resolves provider from selected model.
  useEffect(() => {
    if (setModelSelection) setModelSelection(providers, selectedModel);
    else setProvider(providers.find((p) => p.id === selectedModel?.providerId));
  }, [providers, selectedModel, setModelSelection, setProvider]);

  const enqueueProviderSave = useCallback((value: TextProvider) => {
    // Snapshot value at enqueue time to avoid stale reference if caller mutates
    const payload = { ...value, hasApiKey: value.hasApiKey ?? false };
    providerSaveQueue.current = providerSaveQueue.current
      .catch(() => undefined)
      .then(() => saveProviderBackend(payload as any))
      .catch(() => undefined);
  }, []);

  // Backward-compatible alias — single ordered save path
  const saveProvider = enqueueProviderSave;

  const handleModelSelect = useCallback(
    (providerId: string, modelId: string) => {
      const target = providers.find((p) => p.id === providerId);
      if (!target) return;
      const nextProvider = {
        ...target,
        model: modelId,
        hasApiKey: target.hasApiKey ?? false,
      } as TextProvider;
      setSettings({
        selectedModel: { providerId, modelId },
        providers: providers.map((p) => (p.id === providerId ? nextProvider : p)),
      });
      enqueueProviderSave(nextProvider);
    },
    [providers, setSettings, enqueueProviderSave],
  );

  const handleDeleteProvider = useCallback(
    (id: string) => {
      const target = providers.find((item) => item.id === id);
      if (
        !target ||
        providers.length <= 1 ||
        !window.confirm(`Remove ${target.name || 'this provider'}?`)
      )
        return;
      void deleteProviderBackend(id)
        .then(() => {
          const remaining = providers.filter((item) => item.id !== id);
          setSettings({
            providers: remaining,
            selectedModel: selectedModel?.providerId === id ? undefined : selectedModel,
          });
        })
        .catch((error) => console.error('Unable to delete provider', error));
    },
    [providers, setSettings],
  );

  const onProviderChange = useCallback(
    (next: TextProvider) => {
      setSettings({
        providers: providers.map((item) => (item.id === next.id ? next : item)),
      });
      saveProvider(next);
    },
    [providers, saveProvider, setSettings],
  );

  const onActiveProviderChange = useCallback(
    (nextId: string) => {
      setEditingProviderId(nextId);
      setApiKey('');
    },
    [setSettings],
  );

  const onApiKeySave = useCallback(() => {
    if (!provider || !apiKey.trim()) return;
    void setProviderApiKey(provider.id, apiKey)
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
  }, [apiKey, provider, providers, setSettings]);

  const onApiKeyRemove = useCallback(() => {
    if (!provider) return;
    void deleteProviderApiKey(provider.id)
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
  }, [provider, providers, setSettings]);

  const createProvider = useCallback(
    async (newProvider: TextProvider, key: string) => {
      const payload = { ...newProvider, hasApiKey: Boolean(key) };
      await saveProviderBackend(payload as any);
      try {
        if (key) await setProviderApiKey(newProvider.id, key);
      } catch (error) {
        await deleteProviderBackend(newProvider.id).catch(() => undefined);
        throw error;
      }
      setSettings({ providers: [...providers, payload] });
      setEditingProviderId(newProvider.id);
    },
    [providers, setSettings],
  );

  return {
    providers,
    activeProviderId: editingProviderId,
    provider,
    apiKey,
    apiKeyConfigured,
    setApiKey,
    setApiKeyConfigured,
    handleModelSelect,
    handleDeleteProvider,
    onProviderChange,
    onActiveProviderChange,
    onApiKeySave,
    onApiKeyRemove,
    createProvider,
    saveProvider,
  };
}
