import { describe, it, expect, vi, afterEach } from 'vitest';
import { createDraftPhotosOrderPersister } from '../../pages/draftPhotos.persistOrder';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function flushMicrotasks(times = 3) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

describe('draftPhotos.persistOrder - B2 UX signals', () => {
  it('toggles onSavingChange true->false around successful persist', async () => {
    vi.useFakeTimers();

    const persist = vi.fn().mockResolvedValue(undefined);
    const onSavingChange = vi.fn();

    const p = createDraftPhotosOrderPersister(persist, {
      debounceMs: 0,
      onSavingChange
    });

    p.schedule(['a', 'b']);

    // schedule() only sets timer; saving starts when flush runs
    vi.runOnlyPendingTimers();
    await flushMicrotasks();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(onSavingChange).toHaveBeenCalledWith(true);
    expect(onSavingChange).toHaveBeenLastCalledWith(false);
  });

  it('sets error on failure and retryNow() persists immediately', async () => {
    vi.useFakeTimers();

    const persist = vi.fn().mockRejectedValue(new Error('fail'));
    const onError = vi.fn();

    const p = createDraftPhotosOrderPersister(persist, {
      debounceMs: 0,
      onError
    });

    p.schedule(['a', 'b']);
    vi.runOnlyPendingTimers();
    await flushMicrotasks();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalled();

    persist.mockResolvedValueOnce(undefined);

    const started = p.retryNow();
    expect(started).toBe(true);

    await flushMicrotasks();
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it('guards against late resolve (race protection)', async () => {
    vi.useFakeTimers();

    let resolve1!: () => void;
    let resolve2!: () => void;

    const persist = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((r) => {
            resolve1 = r;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((r) => {
            resolve2 = r;
          })
      );

    const p = createDraftPhotosOrderPersister(persist, {
      debounceMs: 0
    });

    p.schedule(['a', 'b']);
    vi.runOnlyPendingTimers();
    await flushMicrotasks();

    p.schedule(['b', 'a']);
    vi.runOnlyPendingTimers();
    await flushMicrotasks();

    expect(persist).toHaveBeenCalledTimes(2);

    // resolve newer first
    resolve2();
    await flushMicrotasks();

    // late resolve of older request must be ignored
    resolve1();
    await flushMicrotasks();

    expect(persist).toHaveBeenCalledTimes(2);
  });
});

describe('draftPhotos.persistOrder - B3.1 saved feedback', () => {
  it('emits saved=true and auto-hides after savedMs', async () => {
    vi.useFakeTimers();

    const persist = vi.fn().mockResolvedValue(undefined);
    const onSavedChange = vi.fn();

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
    expect(onSavedChange).not.toHaveBeenLastCalledWith(false);

    vi.advanceTimersByTime(1);
    expect(onSavedChange).toHaveBeenLastCalledWith(false);
  });

  it('new schedule hides saved immediately', async () => {
    vi.useFakeTimers();

    const persist = vi.fn().mockResolvedValue(undefined);
    const onSavedChange = vi.fn();

    const p = createDraftPhotosOrderPersister(persist, {
      debounceMs: 0,
      savedMs: 1500,
      onSavedChange
    });

    p.schedule(['a', 'b']);
    vi.runOnlyPendingTimers();
    await flushMicrotasks();

    expect(onSavedChange).toHaveBeenCalledWith(true);

    // new reorder should immediately hide "saved"
    p.schedule(['b', 'a']);
    expect(onSavedChange).toHaveBeenLastCalledWith(false);
  });
});
