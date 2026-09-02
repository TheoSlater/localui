import type { ProviderType, TextProvider } from '@/config/settings';

export type ProviderPreset = {
  id: string;
  name: string;
  providerType: ProviderType;
  defaultBaseUrl?: string;
  requiresApiKey: boolean;
  kind: 'preset' | 'custom';
};

export const providerPresets: ProviderPreset[] = [
  ['openai', 'OpenAI', 'OpenAI', 'https://api.openai.com/v1', true],
  ['anthropic', 'Anthropic', 'Anthropic', undefined, true],
  ['google', 'Google Gemini', 'Google', undefined, true],
  ['openrouter', 'OpenRouter', 'OpenAI-compatible', 'https://openrouter.ai/api/v1', true],
  ['xai', 'xAI', 'OpenAI-compatible', 'https://api.x.ai/v1', true],
  ['groq', 'Groq', 'OpenAI-compatible', 'https://api.groq.com/openai/v1', true],
  ['mistral', 'Mistral', 'OpenAI-compatible', 'https://api.mistral.ai/v1', true],
  ['cerebras', 'Cerebras', 'OpenAI-compatible', 'https://api.cerebras.ai/v1', true],
  ['together', 'Together AI', 'OpenAI-compatible', 'https://api.together.xyz/v1', true],
  ['deepseek', 'DeepSeek', 'OpenAI-compatible', 'https://api.deepseek.com/v1', true],
  ['ollama', 'Ollama', 'Ollama', 'http://localhost:11434', false],
  ['custom', 'Custom OpenAI-compatible', 'OpenAI-compatible', undefined, false],
].map(([id, name, providerType, defaultBaseUrl, requiresApiKey]) => ({
  id,
  name,
  providerType,
  defaultBaseUrl,
  requiresApiKey,
  kind: id === 'custom' ? 'custom' : 'preset',
})) as ProviderPreset[];

export function providerFromPreset(
  preset: ProviderPreset,
  name = preset.name,
  baseUrl = preset.defaultBaseUrl,
): TextProvider {
  return { id: `provider-${Date.now()}`, type: preset.providerType, name, baseUrl, model: '' };
}
