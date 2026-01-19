// frontend/src/app/__tests__/DraftPhotosPage.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, cleanup, screen, act } from '@testing-library/react';

import { renderDraftPhotosPage } from './DraftPhotosPage.test.helpers';

// --- mocks: auth (правильный путь относительно __tests__) ---
vi.mock('../../store/auth.store', () => ({
  useAuth: () => ({ token: 'test-token', user: { id: 'u1' } })
}));

// --- mocks: Photos API ---
const reorderSpy = vi.fn();

vi.mock('../../api/photos.api', () => ({
  reorderAdPhotos: (...args: any[]) => reorderSpy(...args),
  uploadAdPhotosMultipart: vi.fn()
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
  reorderSpy.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    value,
    configurable: true
  });
}

describe('DraftPhotosPage - B1/B2 persist order', () => {
  it('debounced reorder persists order (via fallback buttons)', async () => {
    reorderSpy.mockResolvedValue({ ok: true });

    renderDraftPhotosPage('/draft/ad-1/photos');

    const moveDownP1 = screen.getByTestId('move-down-p1');
    fireEvent.click(moveDownP1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
      await flushMicrotasks();
    });

    expect(reorderSpy).toHaveBeenCalledTimes(1);
    expect(reorderSpy).toHaveBeenCalledWith({
      adId: 'ad-1',
      photoIds: ['p2', 'p1'],
      token: 'test-token'
    });
  });

  it('B2: shows saving indicator while request is pending', async () => {
    let resolve!: (v: unknown) => void;

    reorderSpy.mockImplementation(
      () =>
        new Promise((res) => {
          resolve = res;
        })
    );

    renderDraftPhotosPage('/draft/ad-1/photos');

    fireEvent.click(screen.getByTestId('move-down-p1'));

    // trigger debounce -> starts request -> saving indicator must appear
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
      await flushMicrotasks();
    });

    expect(screen.getByTestId('saving-indicator')).toBeInTheDocument();
    expect(screen.queryByTestId('order-saved')).toBeNull();
    expect(reorderSpy).toHaveBeenCalledTimes(1);

    // resolve request -> indicator disappears
    resolve({ ok: true });

    await act(async () => {
      await flushMicrotasks();
    });

    expect(screen.queryByTestId('saving-indicator')).toBeNull();
  });

  it('B2: shows error and retry triggers second save', async () => {
    reorderSpy.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ ok: true });

    renderDraftPhotosPage('/draft/ad-1/photos');

    fireEvent.click(screen.getByTestId('move-down-p1'));

    // first attempt fails
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
      await flushMicrotasks();
    });

    expect(reorderSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('order-save-error')).toBeInTheDocument();
    expect(screen.queryByTestId('order-saved')).toBeNull();
    expect(screen.getByTestId('persist-order-retry')).toBeInTheDocument();

    // retry triggers immediate persist (no debounce)
    fireEvent.click(screen.getByTestId('persist-order-retry'));

    await act(async () => {
      await flushMicrotasks();
    });

    expect(reorderSpy).toHaveBeenCalledTimes(2);
  });

  it('B4.1: shows Saved after successful persist and hides automatically; resets on new reorder', async () => {
    reorderSpy.mockResolvedValue({ ok: true });

    renderDraftPhotosPage('/draft/ad-1/photos');

    // reorder 1
    fireEvent.click(screen.getByTestId('move-down-p1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
      await flushMicrotasks();
    });

    expect(screen.getByTestId('order-saved')).toBeInTheDocument();

    // auto-hide after 1500ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
      await flushMicrotasks();
    });

    expect(screen.queryByTestId('order-saved')).toBeNull();

    // reorder 2 -> should stay hidden immediately (reset)
    fireEvent.click(screen.getByTestId('move-up-p1'));
    expect(screen.queryByTestId('order-saved')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
      await flushMicrotasks();
    });

    // Saved should show again after second success
    expect(screen.getByTestId('order-saved')).toBeInTheDocument();
  });

  it('B4.2: does not show Saved while waitingForOnline (offline has priority)', async () => {
    // simulate offline at the moment of failure
    setNavigatorOnline(false);

    reorderSpy.mockRejectedValueOnce(new Error('offline'));

    renderDraftPhotosPage('/draft/ad-1/photos');

    fireEvent.click(screen.getByTestId('move-down-p1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
      await flushMicrotasks();
    });

    expect(screen.getByTestId('waiting-for-online')).toBeInTheDocument();
    expect(screen.queryByTestId('order-saved')).toBeNull();

    // restore online for subsequent tests safety
    setNavigatorOnline(true);
  });

  it('B4.2: does not show Saved while saving (saving has priority)', async () => {
    let resolve!: (v: unknown) => void;

    reorderSpy.mockImplementation(
      () =>
        new Promise((res) => {
          resolve = res;
        })
    );

    renderDraftPhotosPage('/draft/ad-1/photos');

    fireEvent.click(screen.getByTestId('move-down-p1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
      await flushMicrotasks();
    });

    expect(screen.getByTestId('saving-indicator')).toBeInTheDocument();
    expect(screen.queryByTestId('order-saved')).toBeNull();

    // complete save — Saved may appear afterwards; we don't assert it here
    resolve({ ok: true });

    await act(async () => {
      await flushMicrotasks();
    });
  });

  it('B4.2: does not show Saved when error is shown (error has priority)', async () => {
    reorderSpy.mockRejectedValueOnce(new Error('network'));

    renderDraftPhotosPage('/draft/ad-1/photos');

    fireEvent.click(screen.getByTestId('move-down-p1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
      await flushMicrotasks();
    });

    expect(screen.getByTestId('order-save-error')).toBeInTheDocument();
    expect(screen.queryByTestId('order-saved')).toBeNull();
  });
});
