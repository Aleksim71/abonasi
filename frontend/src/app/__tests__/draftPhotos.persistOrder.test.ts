import { describe, it, expect, vi, afterEach } from 'vitest';
import { createDraftPhotosOrderPersister } from '../../pages/draftPhotos.persistOrder';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function flushMicrotasks(times = 3) {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

describe('draftPhotos.persistOrder - B2 UX signals', () => {
  it('toggles onSavingChange true->false around successful persist', async () => {
    const onSavingChange = vi.fn();
    const onError = vi.fn();
    const persist = vi.fn().mockResolvedValue(undefined);

    const p = createDraftPhotosOrderPersister(persist, {
      debounceMs: 10,
      onSavingChange,
      onError
    });

    p.schedule(['a', 'b']);
    expect(persist).toHaveBeenCalledTimes(0);

    await new Promise((r) => setTimeout(r, 20));

    expect(persist).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(null);
    expect(onSavingChange).toHaveBeenCalledWith(true);
    expect(onSavingChange).toHaveBeenLastCalledWith(false);
  });

  it('sets error on failure and retryNow() persists immediately', async () => {
    const onSavingChange = vi.fn();
    const onError = vi.fn();

    const persist = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);

    const p = createDraftPhotosOrderPersister(persist, {
      debounceMs: 10,
      onSavingChange,
      onError
    });

    p.schedule(['a', 'b']);
    await new Promise((r) => setTimeout(r, 20));

    expect(persist).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenLastCalledWith('boom');

    const started = p.retryNow();
    expect(started).toBe(true);

    await flushMicrotasks();
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it('race guard: late completion must not clear newer error', async () => {
    vi.useFakeTimers();

    // first persist resolves late
    let resolveLate!: () => void;
    const latePromise = new Promise<void>((resolve) => {
      resolveLate = resolve;
    });

    // second persist fails (newer)
    const persist = vi
      .fn()
      .mockImplementationOnce(() => latePromise)
      .mockRejectedValueOnce(new Error('newer failed'));

    const onError = vi.fn();

    const p = createDraftPhotosOrderPersister(persist, {
      debounceMs: 0,
      onError
    });

    // start save#1 (timer even with 0ms)
    p.schedule(['a', 'b']);
    vi.runOnlyPendingTimers();
    await flushMicrotasks();
    expect(persist).toHaveBeenCalledTimes(1);

    // start save#2 (newer) and fail it
    p.schedule(['b', 'a']);
    vi.runOnlyPendingTimers();
    await flushMicrotasks();
    expect(persist).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenLastCalledWith('newer failed');

    // now resolve older late
    resolveLate();
    await flushMicrotasks();

    // must stay with newer error, late success must not override it
    expect(onError).toHaveBeenLastCalledWith('newer failed');
  });
});

describe('draftPhotos.persistOrder - B3.1 saved feedback', () => {
  it('emits saved=true and auto-hides after savedMs', async () => {
    vi.useFakeTimers();

    const onSavedChange = vi.fn();
    const persist = vi.fn().mockResolvedValue(undefined);

    const p = createDraftPhotosOrderPersister(persist, {
      debounceMs: 0,
      savedMs: 1500,
      onSavedChange
    });

    p.schedule(['a', 'b']);
    vi.runOnlyPendingTimers();
    await flushMicrotasks();

    expect(onSavedChange).toHaveBeenCalledWith(true);

    vi.advanceTimersByTime(1499);
    await flushMicrotasks();
    expect(onSavedChange).not.toHaveBeenCalledWith(false);

    vi.advanceTimersByTime(2);
    await flushMicrotasks();
    expect(onSavedChange).toHaveBeenCalledWith(false);
  });

  it('new schedule hides saved immediately', async () => {
    vi.useFakeTimers();

    const onSavedChange = vi.fn();
    const persist = vi.fn().mockResolvedValue(undefined);

    const p = createDraftPhotosOrderPersister(persist, {
      debounceMs: 0,
      savedMs: 1500,
      onSavedChange
    });

    // first save -> show saved
    p.schedule(['a', 'b']);
    vi.runOnlyPendingTimers();
    await flushMicrotasks();
    expect(onSavedChange).toHaveBeenCalledWith(true);

    // new reorder hides saved immediately (before next success)
    p.schedule(['b', 'a']);
    expect(onSavedChange).toHaveBeenCalledWith(false);

    // run second save to keep timers clean
    vi.runOnlyPendingTimers();
    await flushMicrotasks();
  });
});
