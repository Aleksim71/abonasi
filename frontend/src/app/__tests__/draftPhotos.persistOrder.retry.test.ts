import { describe, it, expect, vi, afterEach } from 'vitest';
import { createDraftPhotosOrderPersister } from '../../pages/draftPhotos.persistOrder';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function flushMicrotasks(times = 3) {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

describe('draftPhotos.persistOrder - B3.2 auto-retry', () => {
  it('auto-retries after failure with backoff', async () => {
    vi.useFakeTimers();

    const persist = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail #1'))
      .mockResolvedValueOnce(undefined);

    const p = createDraftPhotosOrderPersister(persist, {
      debounceMs: 0,
      retryDelaysMs: [1000]
    });

    p.schedule(['a', 'b']);
    vi.runOnlyPendingTimers();
    await flushMicrotasks();

    expect(persist).toHaveBeenCalledTimes(1);

    // auto-retry after 1s
    vi.advanceTimersByTime(1000);
    await flushMicrotasks();

    expect(persist).toHaveBeenCalledTimes(2);
  });

  it('stops auto-retry after max attempts', async () => {
    vi.useFakeTimers();

    const persist = vi.fn().mockRejectedValue(new Error('always fails'));

    const p = createDraftPhotosOrderPersister(persist, {
      debounceMs: 0,
      maxAutoRetries: 2,
      retryDelaysMs: [500, 1000]
    });

    p.schedule(['a', 'b']);
    vi.runOnlyPendingTimers();
    await flushMicrotasks();

    expect(persist).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(500);
    await flushMicrotasks();
    expect(persist).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(1000);
    await flushMicrotasks();
    expect(persist).toHaveBeenCalledTimes(3);

    // no more retries
    vi.advanceTimersByTime(5000);
    await flushMicrotasks();
    expect(persist).toHaveBeenCalledTimes(3);
  });

  it('new reorder cancels scheduled auto-retry (no extra call at old retry time)', async () => {
    vi.useFakeTimers();

    // first call fails -> schedules auto-retry
    // second call (new reorder) succeeds -> clears auto-retry and should not schedule new one
    const persist = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);

    const p = createDraftPhotosOrderPersister(persist, {
      debounceMs: 0,
      retryDelaysMs: [1000]
    });

    // first attempt (fails)
    p.schedule(['a', 'b']);
    vi.runOnlyPendingTimers();
    await flushMicrotasks();
    expect(persist).toHaveBeenCalledTimes(1);

    // new reorder happens before retry time -> should cancel old auto-retry
    p.schedule(['b', 'a']);
    vi.runOnlyPendingTimers();
    await flushMicrotasks();
    expect(persist).toHaveBeenCalledTimes(2);

    // at old retry time nothing extra must happen
    vi.advanceTimersByTime(1000);
    await flushMicrotasks();
    expect(persist).toHaveBeenCalledTimes(2);
  });
});
