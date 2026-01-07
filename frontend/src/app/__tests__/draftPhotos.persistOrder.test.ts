import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDraftPhotosOrderPersister } from '../../pages/draftPhotos.persistOrder';

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('draftPhotos.persistOrder - B2 UX signals', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('toggles onSavingChange true->false around successful persist', async () => {
    const saving = vi.fn();
    const error = vi.fn();
    const persist = vi.fn().mockResolvedValue(undefined);

    const p = createDraftPhotosOrderPersister(persist, {
      debounceMs: 200,
      onSavingChange: saving,
      onError: error
    });

    p.schedule(['p1', 'p2']);

    await vi.advanceTimersByTimeAsync(199);
    expect(persist).toHaveBeenCalledTimes(0);

    await vi.advanceTimersByTimeAsync(1);
    await flushMicrotasks();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(null);

    expect(saving).toHaveBeenCalledWith(true);
    expect(saving).toHaveBeenCalledWith(false);
  });

  it('emits error on failure and allows retryNow()', async () => {
    const saving = vi.fn();
    const error = vi.fn();

    const persist = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);

    const p = createDraftPhotosOrderPersister(persist, {
      debounceMs: 100,
      onSavingChange: saving,
      onError: error
    });

    p.schedule(['p1', 'p2']);
    await vi.advanceTimersByTimeAsync(100);
    await flushMicrotasks();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('network');

    const started = p.retryNow();
    expect(started).toBe(true);

    await flushMicrotasks();
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it('ignores late resolve from older saveSeq (race guard)', async () => {
    const saving = vi.fn();
    const error = vi.fn();

    let resolveFirst: (() => void) | undefined;
    let resolveSecond: (() => void) | undefined;

    const persist = vi.fn().mockImplementation((ids: string[]) => {
      const k = ids.join(',');
      if (k === 'p1,p2') {
        return new Promise<void>((res) => {
          resolveFirst = res;
        });
      }
      if (k === 'p2,p1') {
        return new Promise<void>((res) => {
          resolveSecond = res;
        });
      }
      return Promise.resolve();
    });

    const p = createDraftPhotosOrderPersister(persist, {
      debounceMs: 50,
      onSavingChange: saving,
      onError: error
    });

    // schedule first order
    p.schedule(['p1', 'p2']);
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();
    expect(persist).toHaveBeenCalledTimes(1);

    // schedule second order right after (newer)
    p.schedule(['p2', 'p1']);
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();
    expect(persist).toHaveBeenCalledTimes(2);

    // resolve SECOND first (newer succeeds)
    if (resolveSecond) resolveSecond();
    await flushMicrotasks();

    // now resolve FIRST late — must be ignored
    if (resolveFirst) resolveFirst();
    await flushMicrotasks();

    // key assertion: no failure error
    expect(error).not.toHaveBeenCalledWith(expect.stringMatching(/failed/i));
  });
});
