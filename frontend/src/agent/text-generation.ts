import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, streamText } from 'ai';
import type { ModelMessage } from 'ai';
import type { TextProvider } from '@/config/settings';
import type { Message } from '@/services/chat';
import { SYSTEM_INSTRUCTIONS } from './system-instructions';

export type ReplyStreamEvent = { type: 'text'; text: string } | { type: 'reasoning'; text: string };

export type ChatHistoryMessage = Pick<Message, 'role' | 'content'>;

const CHAT_TITLE_PROMPT =
  "Create a specific 3-5 word chat title from the user's message. Return only the title, with no quotes or ending punctuation.";

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

  const client = createClient(provider, apiKey);
  const result = streamText({
    model: client(modelId),
    instructions: SYSTEM_INSTRUCTIONS,
    messages: toModelMessages(history),
    reasoning: 'medium',
    abortSignal: signal,
    onError: () => {},
  });

  return (async function* (): AsyncGenerator<ReplyStreamEvent> {
    for await (const part of result.stream) {
      if (part.type === 'error') {
        throw part.error instanceof Error ? part.error : new Error(String(part.error));
      }
      if (part.type === 'text-delta' && part.text) yield { type: 'text', text: part.text };
      if (part.type === 'reasoning-delta' && part.text)
        yield { type: 'reasoning', text: part.text };
    }
  })();
}

function createClient(provider: TextProvider, apiKey: string) {
  return createOpenAICompatible({
    name: provider.id,
    baseURL: provider.baseUrl!,
    apiKey,
  });
}

export async function generateChatTitle(
  provider: TextProvider,
  modelId: string,
  apiKey: string,
  firstUserMessage: string,
): Promise<string> {
  if (provider.type !== 'Ollama' && !apiKey.trim())
    throw new Error('Add an API key in Settings first.');
  if (!provider.baseUrl?.trim())
    throw new Error('Add a complete http or https Base URL in Settings first.');

  const result = await generateText({
    model: createClient(provider, apiKey)(modelId),
    instructions: CHAT_TITLE_PROMPT,
    prompt: firstUserMessage,
    maxOutputTokens: 15,
    temperature: 0.2,
    reasoning: 'none',
    maxRetries: 0,
  });
  return cleanChatTitle(result.text);
}

export function cleanChatTitle(value: string): string {
  const withoutQuotes = value
    .trim()
    .replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/g, '')
    .trim();
  const withoutEndingPunctuation = withoutQuotes.replace(/\p{P}+$/gu, '').trim();
  return withoutEndingPunctuation
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 5)
    .join(' ');
}
