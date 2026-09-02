import { describe, expect, it } from 'vitest';
import { getUserFacingError } from './error-message';

describe('getUserFacingError', () => {
  it('turns free-model quota errors into an actionable message', () => {
    expect(
      getUserFacingError(
        new Error('AI_RetryError: Rate limit exceeded: free-models-per-day'),
        'fallback',
      ),
    ).toBe('Free-model daily limit reached. Add credits or choose another model/provider.');
  });

  it('handles timeouts and unknown errors', () => {
    expect(getUserFacingError(new Error('Request timed out'), 'fallback')).toBe(
      'Request timed out. Try again.',
    );
    expect(getUserFacingError(new Error('short provider error'), 'fallback')).toBe(
      'short provider error',
    );
  });
});
