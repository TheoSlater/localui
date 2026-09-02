export type Theme = 'light' | 'dark' | 'system';

export interface Settings {
  theme: Theme;
  name: string;
  userBubbleColor: string;
  providers: TextProvider[];
  selectedModel?: SelectedModel;
  defaultModel?: SelectedModel;
}

export type ProviderType = 'OpenAI' | 'OpenAI-compatible' | 'Anthropic' | 'Google' | 'Ollama';
export type SelectedModel = { providerId: string; modelId: string };

export interface TextProvider {
  id: string;
  type: ProviderType;
  name: string;
  baseUrl?: string;
  /** Legacy backend field. Chat selection lives in Settings.selectedModel. */
  model?: string;
  hasApiKey?: boolean;
  configured?: boolean;
}

export function isCompleteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export const defaultSettings: Settings = {
  theme: 'system',
  name: '',
  userBubbleColor: '#6d3bb8',
  providers: [
    {
      id: 'openai',
      type: 'OpenAI',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      model: '',
    },
  ],
  selectedModel: undefined,
};
