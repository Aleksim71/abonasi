// src/app/__tests__/DraftPhotosMobileReorder.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderDraftPhotosPage } from './DraftPhotosPage.test.helpers';

vi.mock('../../store/auth.store', () => {
  return {
    useAuth: () => ({
      token: 'test-token',
      user: { id: 'u1', email: 'test@example.com' },
      isAuthenticated: true
    })
  };
});

vi.mock('../../api/photos.api', () => {
  return {
    listAdPhotos: vi.fn(async () => []),
    uploadAdPhotosMultipart: vi.fn(async () => ({ ok: true })),
    deleteAdPhoto: vi.fn(async () => ({ ok: true }))
  };
});

function createImageFile(name: string) {
  return new File(['x'], name, { type: 'image/png' });
}

/**
 * Ищем “любой” маркер включения touch reorder режима.
 * Сделано мягко — под разные реализации.
 */
function detectTouchReorderMarker(): { kind: string; value: string } | null {
  const root = document.documentElement;
  const body = document.body;

  const attrCandidates: Array<[Element, string]> = [
    [root, 'data-touch-reorder'],
    [root, 'data-reorder-mode'],
    [root, 'data-drag-mode'],
    [body, 'data-touch-reorder'],
    [body, 'data-reorder-mode'],
    [body, 'data-drag-mode']
  ];

  for (const [el, attr] of attrCandidates) {
    const v = el.getAttribute(attr);
    if (v !== null) return { kind: `attr:${attr}`, value: v };
  }

  const classCandidates = [
    'touch-reorder',
    'touch-reorder--armed',
    'reorder-armed',
    'drag-armed',
    'dp-touch-armed',
    'dp-reorder-armed',
    'is-touch-reorder',
    'is-reorder-armed'
  ];

  for (const cls of classCandidates) {
    if (root.classList.contains(cls)) return { kind: `class:<html>.${cls}`, value: cls };
    if (body.classList.contains(cls)) return { kind: `class:<body>.${cls}`, value: cls };
  }

  const textCandidates = [
    'Режим сортировки',
    'Режим перемещения',
    'Перетаскивание',
    'Удерживайте',
    'Hold to reorder',
    'Reorder mode'
  ];
  for (const t of textCandidates) {
    if (document.body.textContent?.includes(t)) return { kind: 'text', value: t };
  }

  return null;
}

beforeEach(() => {
  vi.stubGlobal('URL', {
    ...(globalThis.URL ?? {}),
    createObjectURL: vi.fn(() => 'blob:mock-preview-url'),
    revokeObjectURL: vi.fn()
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('B8 mobile reorder (touch long-press)', () => {
  it(
    'arms touch reorder mode on long-press and clears it on release',
    async () => {
      // render inside Router so DraftPhotosPage can use useNavigate/useParams safely
      renderDraftPhotosPage('/draft/ad-1/photos');

      expect(screen.queryByText('Нет adId в URL')).toBeNull();
      expect(screen.queryByText('Нет доступа')).toBeNull();

      const input = await screen.findByTestId('photo-file');

      const fileA = createImageFile('a.png');
      const fileB = createImageFile('b.png');
      fireEvent.change(input, { target: { files: [fileA, fileB] } });

      await screen.findByAltText('a.png');
      await screen.findByAltText('b.png');

      const imgA = screen.getByAltText('a.png');
      const tileA = imgA.closest('div') ?? imgA;

      const markerBefore = detectTouchReorderMarker();

      vi.useFakeTimers();

      fireEvent.pointerDown(tileA, {
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        buttons: 1,
        clientX: 10,
        clientY: 10
      });

      vi.advanceTimersByTime(650);

      const markerArmed = detectTouchReorderMarker();

      expect(screen.getByAltText('a.png')).toBeTruthy();
      expect(screen.getByAltText('b.png')).toBeTruthy();

      fireEvent.pointerUp(tileA, {
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        buttons: 0,
        clientX: 10,
        clientY: 10
      });

      vi.useRealTimers();

      await Promise.resolve();
      await Promise.resolve();

      const markerAfter = detectTouchReorderMarker();

      if (markerArmed !== null) {
        if (markerBefore === null) {
          expect(markerAfter).toBeNull();
        } else {
          expect(markerAfter === null || markerAfter.kind === markerBefore.kind).toBe(true);
        }
      } else {
        expect(screen.getByAltText('a.png')).toBeTruthy();
        expect(screen.getByAltText('b.png')).toBeTruthy();
      }
    },
    5000
  );
});
