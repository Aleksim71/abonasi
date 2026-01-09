// frontend/src/pages/draftPhotos.persistOrder.ts
'use strict';

export type PersistRetryState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'retryScheduled'; attempt: number; delayMs: number }
  | { kind: 'waitingForOnline'; attempt: number }
  | { kind: 'failed'; attempt: number; error: unknown };

export type DraftPhotosOrderPersisterOptions = {
  debounceMs?: number;

  // B2 UI hooks
  onSavingChange?: (saving: boolean) => void;
  onError?: (message: string | null) => void;

  // B3.1 "Saved" feedback
  savedMs?: number;
  onSavedChange?: (saved: boolean) => void;

  // B3.2 auto retry/backoff
  maxAutoRetries?: number; // default 2
  retryDelaysMs?: number[]; // default [1000, 3000]

  // B3.3 retry state for UI
  onRetryStateChange?: (s: PersistRetryState) => void;
};

export type DraftPhotosOrderPersister = {
  schedule: (ids: string[]) => void;
  retryNow: () => boolean;

  /**
   * Cancel pending timers (debounce + auto-retry + saved-hide timer).
   * Kept for backward compatibility with DraftPhotosPage cleanup.
   */
  cancel: () => void;

  /**
   * Full cleanup: cancel() + remove event listeners.
   */
  dispose: () => void;
};

function errToMessage(err: unknown): string {
  if (err instanceof Error) return err.message || 'Error';
  return String(err);
}

function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

function pickDelayMs(attemptIndex0: number, retryDelaysMs: number[]): number {
  if (!retryDelaysMs.length) return 1000;
  const idx = attemptIndex0 < retryDelaysMs.length ? attemptIndex0 : retryDelaysMs.length - 1;
  return retryDelaysMs[idx] ?? 1000;
}

/**
 * DraftPhotos order persister:
 * - debounced schedule() ("only last scheduled wins")
 * - race guard against late resolve
 * - B2: saving/error + manual retryNow()
 * - B3.1: "Saved" for savedMs
 * - B3.2: auto-retry with backoff; canceled on new schedule() and manual retryNow()
 * - B3.3: if offline -> waitingForOnline; resume on 'online'
 */
export function createDraftPhotosOrderPersister(
  persistOrder: (ids: string[]) => Promise<void>,
  options: DraftPhotosOrderPersisterOptions = {}
): DraftPhotosOrderPersister {
  const debounceMs = options.debounceMs ?? 0;
  const savedMs = options.savedMs ?? 1500;

  const maxAutoRetries = options.maxAutoRetries ?? 2;
  const retryDelaysMs = options.retryDelaysMs ?? [1000, 3000];

  let scheduledTimer: ReturnType<typeof setTimeout> | null = null;
  let autoRetryTimer: ReturnType<typeof setTimeout> | null = null;
  let savedHideTimer: ReturnType<typeof setTimeout> | null = null;

  let latestSeq = 0; // race guard: only latest seq may mutate state
  let lastScheduled: string[] | null = null;

  let lastFailed: string[] | null = null;
  let lastFailedSeq = 0;

  // after a failure cycle, how many auto retries already executed (0..maxAutoRetries)
  let autoRetryUsed = 0;

  // token invalidates any pending autoRetry timer when changed
  let retryToken = 0;

  let retryState: PersistRetryState = { kind: 'idle' };
  const emitRetryState = (s: PersistRetryState) => {
    retryState = s;
    options.onRetryStateChange?.(s);
  };

  const setSaving = (v: boolean) => {
    options.onSavingChange?.(v);
    if (v) emitRetryState({ kind: 'saving' });
    else if (retryState.kind === 'saving') emitRetryState({ kind: 'idle' });
  };

  const clearSavedTimer = () => {
    if (savedHideTimer) {
      clearTimeout(savedHideTimer);
      savedHideTimer = null;
    }
  };

  const hideSaved = () => {
    clearSavedTimer();
    options.onSavedChange?.(false);
  };

  const showSaved = () => {
    if (!options.onSavedChange) return;
    options.onSavedChange(true);

    clearSavedTimer();
    if (savedMs > 0) {
      savedHideTimer = setTimeout(() => {
        options.onSavedChange?.(false);
      }, savedMs);
    }
  };

  const cancelScheduledFlush = () => {
    if (scheduledTimer) {
      clearTimeout(scheduledTimer);
      scheduledTimer = null;
    }
  };

  const cancelAutoRetry = () => {
    retryToken += 1;
    autoRetryUsed = 0;
    if (autoRetryTimer) {
      clearTimeout(autoRetryTimer);
      autoRetryTimer = null;
    }
  };

  const planAutoRetryAfterFailure = () => {
    if (!lastFailed) return;

    if (!isOnline()) {
      emitRetryState({ kind: 'waitingForOnline', attempt: autoRetryUsed + 1 });
      return;
    }

    if (autoRetryUsed >= maxAutoRetries) {
      emitRetryState({
        kind: 'failed',
        attempt: autoRetryUsed,
        error: new Error('auto-retries exhausted'),
      });
      return;
    }

    const tokenAtSchedule = (retryToken += 1);
    const attempt = autoRetryUsed + 1; // 1..maxAutoRetries
    const delayMs = pickDelayMs(autoRetryUsed, retryDelaysMs);

    emitRetryState({ kind: 'retryScheduled', attempt, delayMs });

    autoRetryTimer = setTimeout(() => {
      if (tokenAtSchedule !== retryToken) return;
      if (!lastFailed) return;
      if (lastFailedSeq !== latestSeq) return;

      if (!isOnline()) {
        emitRetryState({ kind: 'waitingForOnline', attempt });
        return;
      }

      // IMPORTANT: count this auto attempt as USED before firing (so failures won't reset it)
      autoRetryUsed += 1;
      startPersist(lastFailed, 'auto');
    }, delayMs);
  };

  const startPersist = (ids: string[], origin: 'scheduled' | 'manual' | 'auto') => {
    const seq = (latestSeq += 1);

    setSaving(true);

    const p = persistOrder(ids);

    p.then(
      () => {
        if (seq !== latestSeq) return;

        setSaving(false);
        options.onError?.(null);

        lastFailed = null;
        lastFailedSeq = 0;

        // success ends the failure cycle
        autoRetryUsed = 0;
        cancelAutoRetry();

        emitRetryState({ kind: 'idle' });
        showSaved();
      },
      (err) => {
        if (seq !== latestSeq) return;

        setSaving(false);

        const msg = errToMessage(err);
        options.onError?.(msg);

        lastFailed = ids;
        lastFailedSeq = seq;

        // CRITICAL FIX (B3.2):
        // - For a NEW cycle (scheduled/manual) reset autoRetryUsed.
        // - For failures during auto-retry chain, DO NOT reset,
        //   otherwise maxAutoRetries will never be reached.
        if (origin !== 'auto') {
          autoRetryUsed = 0;
        }

        planAutoRetryAfterFailure();
      }
    ).catch(() => {
      // no-op
    });

    // scheduled/manual should cancel any planned auto-retry (B3.2)
    if (origin !== 'auto') cancelAutoRetry();
  };

  const flushScheduled = () => {
    scheduledTimer = null;
    if (!lastScheduled) return;
    startPersist(lastScheduled, 'scheduled');
  };

  const schedule = (ids: string[]) => {
    lastScheduled = ids.slice();

    // UX: new reorder hides error & saved immediately
    options.onError?.(null);
    hideSaved();

    // B3.2: new schedule cancels any pending auto-retry and resets cycle
    cancelAutoRetry();
    emitRetryState({ kind: 'idle' });

    cancelScheduledFlush();
    scheduledTimer = setTimeout(flushScheduled, debounceMs);
  };

  const retryNow = (): boolean => {
    // B3.2: manual retry cancels auto-retry and resets cycle
    cancelAutoRetry();
    emitRetryState({ kind: 'idle' });

    if (!lastFailed) return false;

    if (!isOnline()) {
      emitRetryState({ kind: 'waitingForOnline', attempt: 1 });
      return false;
    }

    cancelScheduledFlush();
    startPersist(lastFailed, 'manual');
    return true;
  };

  // --- B3.3: online/offline listeners ---
  const onOnline = () => {
    if (retryState.kind === 'waitingForOnline' && lastFailed) {
      retryNow();
    }
  };

  const onOffline = () => {
    // show waitingForOnline only after actual failure while offline
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
  }

  const cancel = () => {
    cancelScheduledFlush();
    cancelAutoRetry();
    clearSavedTimer();
    emitRetryState({ kind: 'idle' });
  };

  const dispose = () => {
    cancel();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    }
  };

  return { schedule, retryNow, cancel, dispose };
}
