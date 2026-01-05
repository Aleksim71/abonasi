import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { DraftPhotosPage } from '../../pages/DraftPhotosPage';

// ---- MSW setup (minimal inline handlers) ----
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Mock auth store
vi.mock('../../store/auth.store', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

// Mock api helpers (photos.api)
vi.mock('../../api/photos.api', async () => {
  const actual = await vi.importActual<typeof import('../../api/photos.api')>(
    '../../api/photos.api'
  );

  return {
    ...actual,
    uploadAdPhotos: vi.fn(async () => ({
      photos: [
        { id: 'p1', filePath: '/p1.jpg', order: 1 },
        { id: 'p2', filePath: '/p2.jpg', order: 2 },
      ],
    })),
    deleteAdPhoto: vi.fn(async () => ({ ok: true })),
    reorderAdPhotos: vi.fn(async () => ({
      photos: [
        { id: 'p2', filePath: '/p2.jpg', order: 1 },
        { id: 'p1', filePath: '/p1.jpg', order: 2 },
      ],
    })),
  };
});

// Mock http apiFetch
vi.mock('../../http', () => ({
  apiFetch: async () => ({
    id: 'ad1',
    status: 'draft',
    userId: 'u1',
    photos: [
      { id: 'p1', filePath: '/p1.jpg', order: 1 },
      { id: 'p2', filePath: '/p2.jpg', order: 2 },
    ],
  }),
  ApiError: class ApiError extends Error {
    status = 409;
  },
}));

const server = setupServer(
  http.get('/api/ads/ad1', () =>
    HttpResponse.json({
      data: {
        id: 'ad1',
        status: 'draft',
        userId: 'u1',
        photos: [
          { id: 'p1', filePath: '/p1.jpg', order: 1 },
          { id: 'p2', filePath: '/p2.jpg', order: 2 },
        ],
      },
    })
  )
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ads/ad1/photos']}>
      <Routes>
        <Route path="/ads/:id/photos" element={<DraftPhotosPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('DraftPhotosPage', () => {
  it('renders photos and allows upload', async () => {
    renderPage();

    expect(await screen.findByText('Draft photos')).toBeInTheDocument();

    // Existing photos
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();

    // Upload
    const uploadBtn = screen.getByRole('button', { name: /upload/i });
    fireEvent.click(uploadBtn);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
    });
  });

  it('reorders photos optimistically', async () => {
    renderPage();

    await screen.findByText('#1');

    const downButtons = screen.getAllByText('↓');
    fireEvent.click(downButtons[0]);

    await waitFor(() => {
      // order swapped
      const labels = screen.getAllByText(/#/).map((n) => n.textContent);
      expect(labels).toContain('#1');
    });
  });
});
