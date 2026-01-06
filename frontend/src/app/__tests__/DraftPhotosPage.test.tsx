import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../store/auth.store', () => ({
  useAuth: () => ({ token: 'test-token' })
}));

const uploadSpy = vi.fn();

vi.mock('../../api/photos.api', () => ({
  uploadAdPhotosMultipart: (...args: unknown[]) => uploadSpy(...args)
}));

import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DraftPhotosPage } from '../../pages/DraftPhotosPage';

function getOrderFromServerPhotos(): string[] {
  const container = screen.getByTestId('server-photos');
  const ids: string[] = [];
  for (const el of Array.from(container.children)) {
    const id = el.getAttribute('data-photo-id');
    if (id) ids.push(id);
  }
  return ids;
}

describe('DraftPhotosPage', () => {
  it('renders upload control (file input)', async () => {
    render(
      <MemoryRouter initialEntries={['/ads/123/photos']}>
        <Routes>
          <Route path="/ads/:id/photos" element={<DraftPhotosPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('photo-file')).toBeInTheDocument();
  });

  it('upload calls uploadAdPhotosMultipart', async () => {
    uploadSpy.mockResolvedValueOnce({
      photo: { id: 'p1', url: 'https://example.com/p1.jpg' }
    });

    render(
      <MemoryRouter initialEntries={['/ads/123/photos']}>
        <Routes>
          <Route path="/ads/:id/photos" element={<DraftPhotosPage />} />
        </Routes>
      </MemoryRouter>
    );

    const user = userEvent.setup();
    const input = screen.getByTestId('photo-file') as HTMLInputElement;

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await user.upload(input, file);

    expect(uploadSpy).toHaveBeenCalledTimes(1);
  });

  it('reorder changes server photos order (via fallback buttons)', async () => {
    uploadSpy
      .mockResolvedValueOnce({ photo: { id: 'p1', url: 'https://example.com/p1.jpg' } })
      .mockResolvedValueOnce({ photo: { id: 'p2', url: 'https://example.com/p2.jpg' } });

    render(
      <MemoryRouter initialEntries={['/ads/123/photos']}>
        <Routes>
          <Route path="/ads/:id/photos" element={<DraftPhotosPage />} />
        </Routes>
      </MemoryRouter>
    );

    const user = userEvent.setup();
    const input = screen.getByTestId('photo-file') as HTMLInputElement;

    const f1 = new File(['1'], '1.png', { type: 'image/png' });
    const f2 = new File(['2'], '2.png', { type: 'image/png' });

    await user.upload(input, f1);
    await user.upload(input, f2);

    // wait until both server photos exist
    await screen.findByTestId('server-photo-p1');
    await screen.findByTestId('server-photo-p2');

    expect(getOrderFromServerPhotos()).toEqual(['p1', 'p2']);

    // move p2 up (becomes first)
    const moveUpP2 = screen.getByTestId('move-up-p2');
    await user.click(moveUpP2);

    expect(getOrderFromServerPhotos()).toEqual(['p2', 'p1']);
  });
});
