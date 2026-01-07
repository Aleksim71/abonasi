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
 */
export function createDraftPhotosOrderPersister(persist: PersistOrderFn, opts: Opts = {}) {
  const debounceMs = Number.isFinite(opts.debounceMs) ? Number(opts.debounceMs) : 700;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight = 0;
  let lastQueued: string[] | null = null;
  let lastSavedKey: string | null = null;

  function keyOf(ids: string[]) {
    return ids.join('|');
  }

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function flushQueued() {
    if (!lastQueued) return;

    const ids = lastQueued;
    lastQueued = null;

    const key = keyOf(ids);
    if (key === lastSavedKey) return;

    inflight += 1;
    opts.onError?.(null);
    opts.onSavingChange?.(true);

    try {
      await persist(ids);
      lastSavedKey = key;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      opts.onError?.(msg || 'Failed to save photo order');
      // do NOT update lastSavedKey => next schedule can retry
    } finally {
      inflight -= 1;
      if (inflight <= 0) opts.onSavingChange?.(false);
    }
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

    /** Cancel pending debounce timer (use on unmount) */
    cancel() {
      clearTimer();
      lastQueued = null;
    }
  };
}
