'use strict';

export type PersistOrderFn = (photoIds: string[]) => Promise<void>;

type Opts = {
  debounceMs?: number;
  onSavingChange?: (isSaving: boolean) => void;
  onError?: (message: string | null) => void;
};

/**
 * Debounced order persister:
 * - schedule(photoIds) queues a single request after debounce
 * - only last scheduled order wins
 * - safe to call frequently (DnD move)
 *
 * B2 additions:
 * - remembers last failed order
 * - retryNow() allows UX "Retry" button without duplicating logic in the page
 */
export function createDraftPhotosOrderPersister(persist: PersistOrderFn, opts: Opts = {}) {
  const debounceMs = Number.isFinite(opts.debounceMs) ? Number(opts.debounceMs) : 700;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight = 0;

  let lastQueued: string[] | null = null;
  let lastSavedKey: string | null = null;
  let lastFailed: string[] | null = null;

  // monotonic counter to guard against "late resolves" updating state incorrectly
  let saveSeq = 0;

  function keyOf(ids: string[]) {
    return ids.join('|');
  }

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function setSaving(v: boolean) {
    opts.onSavingChange?.(v);
  }

  function setError(msg: string | null) {
    opts.onError?.(msg);
  }

  async function flush(ids: string[]) {
    const seq = ++saveSeq;

    const key = keyOf(ids);
    if (key === lastSavedKey) return;

    inflight += 1;
    setError(null);
    setSaving(true);

    try {
      await persist(ids);

      // If a newer save was started after this one, ignore this completion.
      if (seq !== saveSeq) return;

      lastSavedKey = key;
      lastFailed = null;
    } catch (e) {
      if (seq !== saveSeq) return;

      const msg = e instanceof Error ? e.message : String(e);
      lastFailed = ids.slice();
      setError(msg || 'Failed to save photo order');
      // do NOT update lastSavedKey => retry remains possible
    } finally {
      inflight -= 1;
      if (inflight <= 0) setSaving(false);
    }
  }

  async function flushQueued() {
    if (!lastQueued) return;

    const ids = lastQueued;
    lastQueued = null;

    await flush(ids);
  }

  return {
    /**
     * Queue save. If order changes again within debounce window,
     * only the last order is sent.
     */
    schedule(photoIds: string[]) {
      if (!Array.isArray(photoIds) || photoIds.length < 2) return;

      lastQueued = photoIds.slice();
      clearTimer();

      timer = setTimeout(() => {
        timer = null;
        void flushQueued();
      }, debounceMs);
    },

    /**
     * Retry last failed order immediately (no debounce).
     * Returns true if retry started, false if there is nothing to retry.
     */
    retryNow() {
      if (!lastFailed || lastFailed.length < 2) return false;

      clearTimer();
      // Important: run immediately, do not debounce user-initiated retry.
      void flush(lastFailed.slice());
      return true;
    },

    /** Cancel pending debounce timer (use on unmount) */
    cancel() {
      clearTimer();
      lastQueued = null;
    }
  };
}
