import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, cleanup, screen, act } from '@testing-library/react';

import { renderDraftPhotosPage } from './DraftPhotosPage.test.helpers';

// --- mocks: auth (правильный путь относительно __tests__) ---
vi.mock('../../store/auth.store', () => ({
  useAuth: () => ({ token: 'test-token', user: { id: 'u1' } })
}));

// --- mocks: Photos API ---
const reorderSpy = vi.fn().mockResolvedValue({ ok: true });

vi.mock('../../api/photos.api', () => ({
  reorderAdPhotos: (...args: any[]) => reorderSpy(...args),
  uploadAdPhotosMultipart: vi.fn()
}));

// --- mock order persister: real debounce via timers (deterministic in tests) ---
vi.mock('../../pages/draftPhotos.persistOrder', () => ({
  createDraftPhotosOrderPersister: (
    saveFn: (photoIds: string[]) => Promise<unknown>,
    opts: {
      debounceMs?: number;
      onSavingChange?: (v: boolean) => void;
      onError?: (msg: string | null) => void;
    }
  ) => {
    const debounceMs = opts?.debounceMs ?? 700;
    let t: ReturnType<typeof setTimeout> | null = null;

    return {
      schedule(photoIds: string[]) {
        if (t) clearTimeout(t);
        t = setTimeout(async () => {
          try {
            opts?.onSavingChange?.(true);
            opts?.onError?.(null);
            await saveFn(photoIds);
          } catch (e: any) {
            opts?.onError?.(String(e?.message || e || 'save failed'));
          } finally {
            opts?.onSavingChange?.(false);
          }
        }, debounceMs);
      },
      cancel() {
        if (t) clearTimeout(t);
        t = null;
      }
    };
  }
}));

// --- mock reducer/state to have deterministic server photos + MOVE_PHOTO behaviour ---
vi.mock('../../pages/draftPhotos.state', () => {
  const initialDraftPhotosState = {
    uploads: [],
    photos: [
      { id: 'p1', url: '/p1.jpg' },
      { id: 'p2', url: '/p2.jpg' }
    ],
    coverPhotoId: null as string | null,
    pageError: null as string | null
  };

  function draftPhotosReducer(state: any, action: any) {
    if (action?.type === 'MOVE_PHOTO') {
      const { fromIndex, toIndex } = action.payload || {};
      const next = [...state.photos];

      if (
        typeof fromIndex !== 'number' ||
        typeof toIndex !== 'number' ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= next.length ||
        toIndex >= next.length
      ) {
        return state;
      }

      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...state, photos: next };
    }

    if (action?.type === 'SET_COVER') {
      return { ...state, coverPhotoId: action.payload?.photoId ?? null };
    }

    return state;
  }

  return {
    draftPhotosReducer,
    initialDraftPhotosState
  };
});

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  reorderSpy.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('DraftPhotosPage - B1 persist order', () => {
  it('debounced reorder persists order (via fallback buttons)', async () => {
    renderDraftPhotosPage('/draft/ad-1/photos');

    const moveDownP1 = screen.getByTestId('move-down-p1');
    fireEvent.click(moveDownP1);

    await act(async () => {
      vi.advanceTimersByTime(800);
      await flushMicrotasks();
    });

    expect(reorderSpy).toHaveBeenCalledTimes(1);
    expect(reorderSpy).toHaveBeenCalledWith({
      adId: 'ad-1',
      photoIds: ['p2', 'p1'],
      token: 'test-token'
    });
  });
});
