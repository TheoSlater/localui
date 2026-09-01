export type Theme = 'light' | 'dark' | 'system';

export interface Settings {
  theme: Theme;
  name: string;
  userBubbleColor: string;
  providers: TextProvider[];
  activeProviderId: string;
}

export interface TextProvider {
  id: string;
  type: 'OpenAI' | 'OpenAI-compatible' | 'Anthropic' | 'Google' | 'Ollama';
  name: string;
  baseUrl: string;
  model: string;
  hasApiKey?: boolean;
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
  activeProviderId: 'openai',
};
