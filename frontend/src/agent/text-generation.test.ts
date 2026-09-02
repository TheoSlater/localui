import { describe, expect, it, vi } from 'vitest';
import { generateText, streamText } from 'ai';
import { cleanChatTitle, generateChatTitle, streamReply, toModelMessages } from './text-generation';

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateText: vi.fn(), streamText: vi.fn() };
});

describe('toModelMessages', () => {
  it('preserves conversation order and drops non-chat rows', () => {
    expect(
      toModelMessages([
        { role: 'user', content: 'Tell me a story.' },
        { role: 'assistant', content: 'Once upon a time...' },
        { role: 'error', content: 'Request failed' },
        { role: 'user', content: 'Format it nicely.' },
      ]),
    ).toEqual([
      { role: 'user', content: 'Tell me a story.' },
      { role: 'assistant', content: 'Once upon a time...' },
      { role: 'user', content: 'Format it nicely.' },
    ]);
  });
});

describe('cleanChatTitle', () => {
  it('normalizes generated title and caps it at five words', () => {
    expect(cleanChatTitle('  `Plan   weekly meals for summer now!`  ')).toBe(
      'Plan weekly meals for summer',
    );
  });

  it('rejects empty and punctuation-only output', () => {
    expect(cleanChatTitle('   ')).toBe('');
    expect(cleanChatTitle('!!!')).toBe('');
  });
});

describe('generateChatTitle', () => {
  it('uses only first message with compact low-temperature generation', async () => {
    (generateText as any).mockResolvedValue({ text: 'Plan weekly meals' });

    const title = await generateChatTitle(
      {
        id: 'provider-1',
        type: 'OpenAI-compatible',
        name: 'Test provider',
        baseUrl: 'https://example.com/v1',
      },
      'selected-model',
      'byok-key',
      'Help me plan weekly meals.',
    );

    expect(title).toBe('Plan weekly meals');
    const options = (generateText as any).mock.calls.at(-1)[0];
    expect(options.instructions).toBe(
      "Create a specific 3-5 word chat title from the user's message. Return only the title, with no quotes or ending punctuation.",
    );
    expect(options.prompt).toBe('Help me plan weekly meals.');
    expect(options.maxOutputTokens).toBe(15);
    expect(options.temperature).toBe(0.2);
    expect(options.reasoning).toBe('none');
    expect(options.maxRetries).toBe(0);
  });
});

describe('streamReply', () => {
  it('propagates provider stream errors to the chat request', async () => {
    (streamText as any).mockReturnValue({
      stream: (async function* () {
        yield { type: 'error', error: new Error('provider failed') };
      })(),
    });

    await expect(
      (async () => {
        for await (const _chunk of streamReply(
          {
            id: 'provider-1',
            type: 'OpenAI-compatible',
            name: 'Test provider',
            baseUrl: 'https://example.com/v1',
          },
          'selected-model',
          'byok-key',
          [{ role: 'user', content: 'Hello' }],
          new AbortController().signal,
        )) {
          // Consume stream.
        }
      })(),
    ).rejects.toThrow('provider failed');
  });
});
