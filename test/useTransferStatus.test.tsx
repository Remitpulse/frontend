import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransferStatus } from '../hooks/useTransferStatus';
import * as api from '../lib/api';

vi.mock('../lib/api', () => ({
  getTransfer: vi.fn(),
  transferEventsUrl: vi.fn(),
}));

type Listener = (event: MessageEvent) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  url: string;
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: Listener | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;
  private listeners: Record<string, Listener[]> = {};

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    (this.listeners[type] ??= []).push(listener);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l !== listener);
  }

  emitMessage(data: unknown) {
    const event = { data: JSON.stringify(data) } as MessageEvent;
    this.onmessage?.(event);
    for (const listener of this.listeners.message ?? []) listener(event);
  }

  emitError() {
    const event = new Event('error');
    this.onerror?.(event);
    for (const listener of this.listeners.error ?? []) listener(event as unknown as MessageEvent);
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }
}

const POLL_MS = 2000;

const pendingTransfer = {
  id: 'tx-1',
  status: 'pending',
  amount: '10',
  asset: 'XLM',
  destination: 'GDEST',
};

const successTransfer = {
  ...pendingTransfer,
  status: 'success',
};

const failedTransfer = {
  ...pendingTransfer,
  status: 'failed',
};

describe('useTransferStatus', () => {
  const originalEventSource = (globalThis as { EventSource?: unknown }).EventSource;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    vi.mocked(api.getTransfer).mockReset();
    vi.mocked(api.transferEventsUrl).mockReset();
    (globalThis as { EventSource?: unknown }).EventSource = FakeEventSource;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    if (originalEventSource === undefined) {
      delete (globalThis as { EventSource?: unknown }).EventSource;
    } else {
      (globalThis as { EventSource?: unknown }).EventSource = originalEventSource;
    }
  });

  it('subscribes to SSE and applies incoming messages', async () => {
    vi.mocked(api.transferEventsUrl).mockReturnValue('https://example.test/events/tx-1');

    const { result } = renderHook(() => useTransferStatus('tx-1'));

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0];
    expect(source.url).toBe('https://example.test/events/tx-1');

    act(() => {
      source.emitMessage(pendingTransfer);
    });

    expect(result.current.transfer).toEqual(pendingTransfer);
    expect(result.current.error).toBeNull();
    expect(api.getTransfer).not.toHaveBeenCalled();
  });

  it('closes the SSE connection when a terminal state arrives', async () => {
    vi.mocked(api.transferEventsUrl).mockReturnValue('https://example.test/events/tx-1');

    const { result } = renderHook(() => useTransferStatus('tx-1'));

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0];

    act(() => {
      source.emitMessage(successTransfer);
    });

    expect(result.current.transfer).toEqual(successTransfer);
    expect(source.closed).toBe(true);
    expect(api.getTransfer).not.toHaveBeenCalled();
  });

  it('falls back to polling when SSE errors, polling until terminal', async () => {
    vi.mocked(api.transferEventsUrl).mockReturnValue('https://example.test/events/tx-1');
    vi.mocked(api.getTransfer)
      .mockResolvedValueOnce(pendingTransfer as never)
      .mockResolvedValueOnce(pendingTransfer as never)
      .mockResolvedValueOnce(successTransfer as never);

    const { result } = renderHook(() => useTransferStatus('tx-1'));

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0];

    act(() => {
      source.emitError();
    });

    expect(source.closed).toBe(true);

    // First poll fires immediately on fallback.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.getTransfer).toHaveBeenCalledTimes(1);
    expect(result.current.transfer).toEqual(pendingTransfer);

    // Second poll after POLL_MS.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });
    expect(api.getTransfer).toHaveBeenCalledTimes(2);

    // Third poll reaches terminal state and stops polling.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });
    expect(api.getTransfer).toHaveBeenCalledTimes(3);
    expect(result.current.transfer).toEqual(successTransfer);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    });
    expect(api.getTransfer).toHaveBeenCalledTimes(3);
  });

  it('polls when no EventSource is available', async () => {
    delete (globalThis as { EventSource?: unknown }).EventSource;
    vi.mocked(api.transferEventsUrl).mockReturnValue('https://example.test/events/tx-1');
    vi.mocked(api.getTransfer)
      .mockResolvedValueOnce(pendingTransfer as never)
      .mockResolvedValueOnce(failedTransfer as never);

    const { result } = renderHook(() => useTransferStatus('tx-1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.getTransfer).toHaveBeenCalledTimes(1);
    expect(result.current.transfer).toEqual(pendingTransfer);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });
    expect(api.getTransfer).toHaveBeenCalledTimes(2);
    expect(result.current.transfer).toEqual(failedTransfer);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    });
    expect(api.getTransfer).toHaveBeenCalledTimes(2);
  });

  it('polls when no events URL is available', async () => {
    vi.mocked(api.transferEventsUrl).mockReturnValue(undefined as never);
    vi.mocked(api.getTransfer).mockResolvedValue(successTransfer as never);

    const { result } = renderHook(() => useTransferStatus('tx-1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(FakeEventSource.instances).toHaveLength(0);
    expect(api.getTransfer).toHaveBeenCalledTimes(1);
    expect(result.current.transfer).toEqual(successTransfer);
  });

  it('sets an error message when polling fails', async () => {
    delete (globalThis as { EventSource?: unknown }).EventSource;
    vi.mocked(api.transferEventsUrl).mockReturnValue(undefined as never);
    vi.mocked(api.getTransfer).mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useTransferStatus('tx-1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error).toContain('network down');
  });

  it('cleans up the SSE subscription on unmount', async () => {
    vi.mocked(api.transferEventsUrl).mockReturnValue('https://example.test/events/tx-1');

    const { unmount } = renderHook(() => useTransferStatus('tx-1'));

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0];

    unmount();

    expect(source.closed).toBe(true);
  });

  it('cleans up polling timers on unmount', async () => {
    delete (globalThis as { EventSource?: unknown }).EventSource;
    vi.mocked(api.transferEventsUrl).mockReturnValue(undefined as never);
    vi.mocked(api.getTransfer).mockResolvedValue(pendingTransfer as never);

    const { unmount } = renderHook(() => useTransferStatus('tx-1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.getTransfer).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    });
    expect(api.getTransfer).toHaveBeenCalledTimes(1);
  });
});