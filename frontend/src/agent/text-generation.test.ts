import { describe, expect, it } from 'vitest';
import { toModelMessages } from './text-generation';

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
