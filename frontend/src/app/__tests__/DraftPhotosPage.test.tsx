import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { rest } from 'msw';

import { DraftPhotosPage } from '../../pages/DraftPhotosPage';

// ------------------------------
// MSW
// ------------------------------

type Photo = {
  id: string;
  filePath: string;
  position: number;
};

let photosState: Photo[] = [
  { id: 'p1', filePath: '/uploads/p1.jpg', position: 1 },
  { id: 'p2', filePath: '/uploads/p2.jpg', position: 2 }
];

// Match both relative and absolute URL forms:
// - /api/ads/ad1
// - http://localhost:3001/api/ads/ad1
const reGetAd = /\/api\/ads\/[^/]+$/;

// - /api/ads/ad1/photos/reorder
// - http://localhost:3001/api/ads/ad1/photos/reorder
const reReorder = /\/api\/ads\/[^/]+\/photos\/reorder$/;

const server = setupServer(
  rest.get(reGetAd, (_req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        id: 'ad1',
        photos: photosState
      })
    );
  }),

  rest.put(reReorder, async (req, res, ctx) => {
    // Accept common payload variants
    let ordered: string[] | null = null;
    try {
      const body: any = await req.json();
      ordered = body?.orderedIds ?? body?.photoIds ?? body?.ids ?? null;
    } catch {
      ordered = null;
    }

    if (Array.isArray(ordered) && ordered.length) {
      const byId = new Map(photosState.map((p) => [p.id, p] as const));
      const next: Photo[] = ordered
        .map((id, idx) => {
          const p = byId.get(String(id));
          if (!p) return null;
          return { ...p, position: idx + 1 };
        })
        .filter(Boolean) as Photo[];

      // Keep any missing items appended (defensive)
      const used = new Set(next.map((p) => p.id));
      for (const p of photosState) {
        if (!used.has(p.id)) next.push({ ...p, position: next.length + 1 });
      }

      photosState = next;
    }

    // Small delay so we can assert optimistic UI
    return res(ctx.delay(250), ctx.status(200), ctx.json({ ok: true }));
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ------------------------------
// Test helpers
// ------------------------------

function renderPage() {
  const router = createMemoryRouter(
    [
      {
        path: '/draft/:id/photos',
        element: <DraftPhotosPage />
      }
    ],
    {
      initialEntries: ['/draft/ad1/photos']
    }
  );

  render(<RouterProvider router={router} />);
}

function getExistingPhotoImgs(): HTMLImageElement[] {
  // On the page there can be other images (e.g. previews of selected files).
  // Existing photos are served from /uploads/*
  return screen
    .getAllByRole('img')
    .map((n) => n as HTMLImageElement)
    .filter((img) => (img.getAttribute('src') || '').startsWith('/uploads/'));
}

// ------------------------------
// Tests
// ------------------------------

describe('DraftPhotosPage', () => {
  test('renders photos and allows upload', async () => {
    photosState = [
      { id: 'p1', filePath: '/uploads/p1.jpg', position: 1 },
      { id: 'p2', filePath: '/uploads/p2.jpg', position: 2 }
    ];

    renderPage();

    // Existing photos should appear
    await screen.findByAltText('photo-1');
    expect(screen.getByAltText('photo-2')).toBeInTheDocument();

    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();

    // Select a file (no user-event package needed)
    const input = screen.getByLabelText(/select images/i) as HTMLInputElement;

    const file = new File(['hello'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    // Toolbar "Upload photos" button should become enabled
    const uploadPhotosBtn = screen.getByRole('button', { name: 'Upload photos' });
    expect(uploadPhotosBtn).toBeEnabled();
  });

  test('reorders photos optimistically', async () => {
    photosState = [
      { id: 'p1', filePath: '/uploads/p1.jpg', position: 1 },
      { id: 'p2', filePath: '/uploads/p2.jpg', position: 2 }
    ];

    renderPage();

    // Ensure initial render is ready
    await screen.findByAltText('photo-1');
    expect(screen.getByAltText('photo-2')).toBeInTheDocument();

    // Move second photo up
    const moveUpButtons = screen.getAllByRole('button', { name: /move up/i });
    expect(moveUpButtons.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(moveUpButtons[1]);

    // Optimistic UI: your UI keeps alt/labels per slot, but swaps the photo content.
    // So we assert by src order (/uploads/p2.jpg should become first).
    await waitFor(() => {
      const imgs = getExistingPhotoImgs();
      expect(imgs.length).toBe(2);

      expect(imgs[0].getAttribute('src')).toBe('/uploads/p2.jpg');
      expect(imgs[1].getAttribute('src')).toBe('/uploads/p1.jpg');
    });
  });
});
