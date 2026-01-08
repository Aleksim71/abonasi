'use strict';

export type PersistOrderFn = (photoIds: string[]) => Promise<void>;

type Opts = {
  debounceMs?: number;
  onSavingChange?: (isSaving: boolean) => void;
  onError?: (message: string | null) => void;

  // B3.1: transient "Saved" feedback
  onSavedChange?: (isSaved: boolean) => void;
  savedMs?: number;
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
 * - guards against late resolves (older completions do not override newer state)
 *
 * B3.1 additions:
 * - emits transient "Saved" signal after successful persist (auto-hide)
 * - clears "Saved" when a new reorder happens (so it doesn't "stick")
 */
export function createDraftPhotosOrderPersister(persist: PersistOrderFn, opts: Opts = {}) {
  const debounceMs = Number.isFinite(opts.debounceMs) ? Number(opts.debounceMs) : 700;
  const savedMs = Number.isFinite(opts.savedMs) ? Number(opts.savedMs) : 1500;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight = 0;

  let lastQueued: string[] | null = null;
  let lastSavedKey: string | null = null;
  let lastFailed: string[] | null = null;

  // monotonic counter to guard against "late resolves" updating state incorrectly
  let saveSeq = 0;

  // B3.1: transient "Saved" flag + timer
  let isSaved = false;
  let savedTimer: ReturnType<typeof setTimeout> | null = null;

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

  function clearSaved() {
    if (savedTimer) {
      clearTimeout(savedTimer);
      savedTimer = null;
    }
    if (isSaved) {
      isSaved = false;
      opts.onSavedChange?.(false);
    }
  }

  function setSaved() {
    if (!isSaved) {
      isSaved = true;
      opts.onSavedChange?.(true);
    }

    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      savedTimer = null;
      if (isSaved) {
        isSaved = false;
        opts.onSavedChange?.(false);
      }
    }, savedMs);
  }

  async function flush(ids: string[]) {
    const seq = ++saveSeq;

    const key = keyOf(ids);
    if (key === lastSavedKey) return;

    inflight += 1;

    // B3.1: while saving a new order, hide "Saved"
    clearSaved();

    setError(null);
    setSaving(true);

    try {
      await persist(ids);

      // If a newer save was started after this one, ignore this completion.
      if (seq !== saveSeq) return;

      lastSavedKey = key;
      lastFailed = null;

      // B3.1: success -> show "Saved" briefly
      setSaved();
    } catch (e) {
      // If a newer save was started after this one, ignore this completion.
      if (seq !== saveSeq) return;

      const msg = e instanceof Error ? e.message : String(e);
      lastFailed = ids.slice();
      setError(msg || 'Failed to save photo order');
      // do NOT update lastSavedKey => retry remains possible

      // B3.1: on error, keep "Saved" hidden
      clearSaved();
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

      // B3.1: new reorder => hide "Saved" immediately
      clearSaved();

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

      // B3.1: user tries again => hide "Saved"
      clearSaved();

      clearTimer();
      void flush(lastFailed.slice());
      return true;
    },

    /** Cancel pending debounce timer (use on unmount) */
    cancel() {
      clearTimer();
      clearSaved();
      lastQueued = null;
    }
  };
}
