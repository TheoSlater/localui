import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
import type { ModelMessage } from 'ai';
import type { TextProvider } from '@/config/settings';
import type { Message } from '@/services/chat';
import { SYSTEM_INSTRUCTIONS } from './system-instructions';

export type ReplyStreamEvent = { type: 'text'; text: string } | { type: 'reasoning'; text: string };

export type ChatHistoryMessage = Pick<Message, 'role' | 'content'>;

export function toModelMessages(
  messages: readonly ChatHistoryMessage[] | null | undefined,
): ModelMessage[] {
  return (messages ?? []).flatMap((message) => {
    const role = message.role;
    if ((role !== 'user' && role !== 'assistant') || !message.content.trim()) return [];
    return [{ role, content: message.content }];
  });
}

export function streamReply(
  provider: TextProvider,
  modelId: string,
  apiKey: string,
  history: readonly ChatHistoryMessage[],
  signal: AbortSignal,
) {
  if (provider.type !== 'Ollama' && !apiKey.trim())
    throw new Error('Add an API key in Settings first.');
  if (!provider.baseUrl?.trim())
    throw new Error('Add a complete http or https Base URL in Settings first.');

  const client = createOpenAICompatible({
    name: provider.id,
    baseURL: provider.baseUrl,
    apiKey,
  });
  const result = streamText({
    model: client(modelId),
    instructions: SYSTEM_INSTRUCTIONS,
    messages: toModelMessages(history),
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
