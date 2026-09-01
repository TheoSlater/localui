import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
import type { TextProvider } from '@/config/settings';

export type ReplyStreamEvent = { type: 'text'; text: string } | { type: 'reasoning'; text: string };

export function streamReply(
  provider: TextProvider,
  apiKey: string,
  prompt: string,
  signal: AbortSignal,
) {
  if (!apiKey.trim()) throw new Error('Add an API key in Settings first.');
  if (!provider.model.trim()) throw new Error('Add a model name in Settings first.');

  const client = createOpenAICompatible({
    name: provider.id,
    baseURL: provider.baseUrl,
    apiKey,
  });
  const result = streamText({
    model: client(provider.model),
    prompt,
    reasoning: 'medium',
    abortSignal: signal,
  });

  return (async function* (): AsyncGenerator<ReplyStreamEvent> {
    for await (const part of result.stream) {
      if (part.type === 'text-delta' && part.text) yield { type: 'text', text: part.text };
      if (part.type === 'reasoning-delta' && part.text)
        yield { type: 'reasoning', text: part.text };
    }
  })();
}
