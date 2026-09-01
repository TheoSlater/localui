import type { TextProvider } from '@/config/settings';
import { APIKey } from '../../bindings/changeme/internal/providers/service';

export interface ModelItem {
  id: string;
  providerId: string;
  providerName: string;
  providerType: TextProvider['type'];
  origin: 'local' | 'external';
}

function isLocalProvider(type: TextProvider['type'], baseUrl: string): boolean {
  if (type === 'Ollama') return true;
  try {
    const host = new URL(baseUrl).hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true;
  } catch {
    /* ignore */
  }
  return false;
}

async function fetchOllamaModels(baseUrl: string): Promise<string[]> {
  const url = baseUrl.replace(/\/+$/, '') + '/api/tags';
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.models ?? []).map((m: { name: string }) => m.name);
}

async function fetchOpenAICompatibleModels(baseUrl: string, key: string): Promise<string[]> {
  const base = baseUrl.replace(/\/+$/, '');
  const modelsUrl = base.endsWith('/v1') ? base + '/models' : base + '/v1/models';
  const headers: Record<string, string> = {};
  if (key) headers['Authorization'] = 'Bearer ' + key;
  const res = await fetch(modelsUrl, { headers });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data ?? []).map((m: { id: string }) => m.id);
}

async function fetchAnthropicModels(): Promise<string[]> {
  return [
    'claude-sonnet-4-20250514',
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307',
  ];
}

async function fetchGoogleModels(): Promise<string[]> {
  return [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ];
}

async function fetchModelsForProvider(provider: TextProvider): Promise<string[]> {
  try {
    let key = '';
    if (provider.type !== 'Ollama') {
      key = await APIKey(provider.id);
    }
    switch (provider.type) {
      case 'Ollama':
        return await fetchOllamaModels(provider.baseUrl);
      case 'Anthropic':
        return await fetchAnthropicModels();
      case 'Google':
        return await fetchGoogleModels();
      default:
        return await fetchOpenAICompatibleModels(provider.baseUrl, key);
    }
  } catch {
    return [];
  }
}

export async function fetchAllModels(providers: TextProvider[]): Promise<ModelItem[]> {
  const results = await Promise.all(
    providers.map(async (provider) => {
      const modelIds = await fetchModelsForProvider(provider);
      const local = isLocalProvider(provider.type, provider.baseUrl);
      return modelIds.map((id) => ({
        id,
        providerId: provider.id,
        providerName: provider.name,
        providerType: provider.type,
        origin: local ? ('local' as const) : ('external' as const),
      }));
    }),
  );
  return results.flat();
}
