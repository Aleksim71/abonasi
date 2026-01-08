'use strict';

export type PersistOrderFn = (photoIds: string[]) => Promise<void>;

type Opts = {
  debounceMs?: number;
  onSavingChange?: (isSaving: boolean) => void;
  onError?: (message: string | null) => void;

  // B3.1
  onSavedChange?: (isSaved: boolean) => void;
  savedMs?: number;

  // B3.2
  maxAutoRetries?: number;   // default: 2
  retryDelaysMs?: number[]; // default: [1000, 3000]
};

export function createDraftPhotosOrderPersister(
  persist: PersistOrderFn,
  opts: Opts = {}
) {
  const debounceMs = Number.isFinite(opts.debounceMs) ? Number(opts.debounceMs) : 700;
  const savedMs = Number.isFinite(opts.savedMs) ? Number(opts.savedMs) : 1500;

  const maxAutoRetries = Number.isFinite(opts.maxAutoRetries)
    ? Number(opts.maxAutoRetries)
    : 2;

  const retryDelaysMs =
    Array.isArray(opts.retryDelaysMs) && opts.retryDelaysMs.length > 0
      ? opts.retryDelaysMs
      : [1000, 3000];

  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight = 0;

  let lastQueued: string[] | null = null;
  let lastSavedKey: string | null = null;
  let lastFailed: string[] | null = null;

  // race guard
  let saveSeq = 0;

  // B3.1: Saved feedback
  let isSaved = false;
  let savedTimer: ReturnType<typeof setTimeout> | null = null;

  // B3.2: auto-retry state
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryCount = 0;

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

  function clearAutoRetry() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    retryCount = 0;
  }

  function scheduleAutoRetry(ids: string[]) {
    if (retryCount >= maxAutoRetries) return;

    const delay =
      retryDelaysMs[retryCount] ??
      retryDelaysMs[Math.max(0, retryDelaysMs.length - 1)];

    retryCount += 1;

    retryTimer = setTimeout(() => {
      retryTimer = null;
      void flush(ids);
    }, delay);
  }

  async function flush(ids: string[]) {
    const seq = ++saveSeq;

    const key = keyOf(ids);
    if (key === lastSavedKey) return;

    inflight += 1;

    clearSaved();
    setError(null);
    setSaving(true);

    try {
      await persist(ids);

      if (seq !== saveSeq) return;

      lastSavedKey = key;
      lastFailed = null;
      clearAutoRetry();
      setSaved();
    } catch (e) {
      if (seq !== saveSeq) return;

      const msg = e instanceof Error ? e.message : String(e);
      lastFailed = ids.slice();
      setError(msg || 'Failed to save photo order');
      clearSaved();

      scheduleAutoRetry(ids);
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
    schedule(photoIds: string[]) {
      if (!Array.isArray(photoIds) || photoIds.length < 2) return;

      clearSaved();
      clearAutoRetry();

      lastQueued = photoIds.slice();
      clearTimer();

      timer = setTimeout(() => {
        timer = null;
        void flushQueued();
      }, debounceMs);
    },

    retryNow() {
      if (!lastFailed || lastFailed.length < 2) return false;

      clearSaved();
      clearAutoRetry();
      clearTimer();

      void flush(lastFailed.slice());
      return true;
    },

    cancel() {
      clearTimer();
      clearSaved();
      clearAutoRetry();
      lastQueued = null;
    }
  };
}
