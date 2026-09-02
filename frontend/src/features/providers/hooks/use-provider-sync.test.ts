import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettingsStore } from '@/stores/settings-store';

vi.mock('@/services/providers', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/providers')>('@/services/providers');
  return {
    ...actual,
    listProviders: vi.fn(async () => []),
    hasProviderApiKey: vi.fn(async () => false),
    saveProvider: vi.fn(async () => {}),
    deleteProvider: vi.fn(async () => {}),
    setProviderApiKey: vi.fn(async () => {}),
    deleteProviderApiKey: vi.fn(async () => {}),
  };
});

vi.mock('@/stores/chat-store', async () => {
  const actual = await vi.importActual<typeof import('@/stores/chat-store')>('@/stores/chat-store');
  return {
    ...actual,
    useChatStore: vi.fn((selector: any) => {
      if (selector.toString().includes('setProvider')) return vi.fn();
      return selector({ setProvider: vi.fn() });
    }),
  };
});

import * as Providers from '@/services/providers';
import { useProviderSync } from './use-provider-sync';

describe('useProviderSync save queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      providers: [
        {
          id: 'p1',
          type: 'OpenAI',
          name: 'Provider 1',
          baseUrl: 'https://api.openai.com/v1',
          model: 'model-a',
        },
        {
          id: 'p2',
          type: 'OpenAI',
          name: 'Provider 2',
          baseUrl: 'https://api.openai.com/v1',
          model: 'model-x',
        },
      ] as any,
      activeProviderId: 'p1',
      theme: 'system',
      name: '',
      userBubbleColor: '#6d3bb8',
    });
  });

  it('serializes saves: B enqueued while A pending runs after A', async () => {
    const saveMock = Providers.saveProvider as unknown as ReturnType<typeof vi.fn>;
    let resolveA: () => void;
    const order: string[] = [];
    saveMock.mockImplementationOnce(
      (p: any) =>
        new Promise<void>((r) => {
          order.push(`start-${p.name}`);
          resolveA = () => {
            order.push(`end-${p.name}`);
            r();
          };
        }),
    );
    saveMock.mockImplementationOnce(async (p: any) => {
      order.push(`start-${p.name}`);
      order.push(`end-${p.name}`);
    });

    const { result } = renderHook(() => useProviderSync({ settingsOpen: false }));

    act(() => {
      result.current.onProviderChange({
        id: 'p1',
        type: 'OpenAI',
        name: 'Edited',
        baseUrl: 'https://api.openai.com/v1',
        model: 'model-a',
      } as any);
    });
    // allow first enqueue to start (microtask)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect((saveMock.mock.calls[0][0] as any).name).toBe('Edited');

    act(() => {
      result.current.handleModelSelect('p1', 'model-b');
    });
    // second should be queued, not yet called while first pending
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(saveMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveA!();
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(saveMock).toHaveBeenCalledTimes(2);
    expect((saveMock.mock.calls[1][0] as any).model).toBe('model-b');
    expect(order).toEqual(['start-Edited', 'end-Edited', 'start-Edited', 'end-Edited']);
    const finalProvider = useSettingsStore.getState().providers.find((p) => p.id === 'p1');
    expect(finalProvider?.model).toBe('model-b');
  });

  it('failure of A does not poison queue for B', async () => {
    const saveMock = Providers.saveProvider as unknown as ReturnType<typeof vi.fn>;
    saveMock.mockImplementationOnce(async () => {
      throw new Error('fail A');
    });
    saveMock.mockImplementationOnce(async () => {});

    const { result } = renderHook(() => useProviderSync({ settingsOpen: false }));

    act(() => {
      result.current.onProviderChange({
        id: 'p1',
        type: 'OpenAI',
        name: 'Fail',
        baseUrl: 'https://api.openai.com/v1',
        model: 'model-a',
      } as any);
    });
    act(() => {
      result.current.onProviderChange({
        id: 'p1',
        type: 'OpenAI',
        name: 'Recover',
        baseUrl: 'https://api.openai.com/v1',
        model: 'model-a',
      } as any);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(saveMock).toHaveBeenCalledTimes(2);
    expect((saveMock.mock.calls[1][0] as any).name).toBe('Recover');
  });

  it('rapid changes preserve enqueue order', async () => {
    const saveMock = Providers.saveProvider as unknown as ReturnType<typeof vi.fn>;
    const order: string[] = [];
    saveMock.mockImplementation(async (p: any) => {
      order.push(p.name);
      await new Promise((r) => setTimeout(r, 5));
    });

    const { result } = renderHook(() => useProviderSync({ settingsOpen: false }));

    act(() => {
      result.current.onProviderChange({
        id: 'p1',
        type: 'OpenAI',
        name: 'A',
        baseUrl: 'https://api.openai.com/v1',
        model: 'm',
      } as any);
      result.current.onProviderChange({
        id: 'p1',
        type: 'OpenAI',
        name: 'B',
        baseUrl: 'https://api.openai.com/v1',
        model: 'm',
      } as any);
      result.current.onProviderChange({
        id: 'p1',
        type: 'OpenAI',
        name: 'C',
        baseUrl: 'https://api.openai.com/v1',
        model: 'm',
      } as any);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });

    expect(order).toEqual(['A', 'B', 'C']);
  });

  it('payload snapshot not mutated before queued save executes', async () => {
    const saveMock = Providers.saveProvider as unknown as ReturnType<typeof vi.fn>;
    let resolveA: () => void;
    const captured: any[] = [];
    saveMock.mockImplementationOnce(
      (p: any) =>
        new Promise<void>((r) => {
          captured.push({ ...p });
          resolveA = r;
        }),
    );
    saveMock.mockImplementationOnce(async (p: any) => {
      captured.push({ ...p });
    });

    const { result } = renderHook(() => useProviderSync({ settingsOpen: false }));

    const mutable: any = {
      id: 'p1',
      type: 'OpenAI',
      name: 'Original',
      baseUrl: 'https://api.openai.com/v1',
      model: 'm',
    };
    act(() => {
      result.current.onProviderChange(mutable);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    mutable.name = 'Mutated';

    await act(async () => {
      resolveA!();
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(captured[0].name).toBe('Original');
  });
});
