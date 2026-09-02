function getErrorText(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === 'string') return error.trim();
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message;
    return typeof message === 'string' ? message.trim() : '';
  }
  return '';
}

export function getUserFacingError(error: unknown, fallback: string): string {
  const message = getErrorText(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('free-models-per-day') ||
    normalized.includes('daily limit') ||
    normalized.includes('quota')
  ) {
    return 'Free-model daily limit reached. Add credits or choose another model/provider.';
  }
  if (
    normalized.includes('429') ||
    normalized.includes('rate limit') ||
    normalized.includes('too many requests')
  ) {
    return 'Rate limit reached. Try again later or choose another model/provider.';
  }
  if (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('deadline exceeded')
  ) {
    return 'Request timed out. Try again.';
  }
  if (normalized.includes('401') || normalized.includes('403') || normalized.includes('api key')) {
    return 'Provider authentication failed. Check your API key.';
  }
  if (normalized.includes('no output generated')) {
    return 'Model returned no usable output. Try again or choose another model.';
  }
  if (normalized.includes('failed to fetch') || normalized.includes('network')) {
    return 'Could not reach provider. Check your connection and provider URL.';
  }

  return message && message.length <= 240 ? message : fallback;
}
