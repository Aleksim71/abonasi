import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const photosApiMock = vi.hoisted(() => {
  return {
    uploadAdPhotosMultipart: vi.fn(),
    reorderAdPhotos: vi.fn(),
    sortPhotosByOrder: vi.fn((photos: any[]) => photos)
  };
});

vi.mock('../../api/photos.api', () => {
  return {
    uploadAdPhotosMultipart: photosApiMock.uploadAdPhotosMultipart,
    reorderAdPhotos: photosApiMock.reorderAdPhotos,
    sortPhotosByOrder: photosApiMock.sortPhotosByOrder
  };
});

vi.mock('../../store/auth.store', () => {
  return {
    useAuth: () => ({
      user: { id: 'u1', email: 'u1@example.com' },
      token: 'TEST_TOKEN'
    })
  };
});

import { DraftPhotosPage } from '../../pages/DraftPhotosPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/draft/111/photos']}>
      <Routes>
        <Route path="/draft/:id/photos" element={<DraftPhotosPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('DraftPhotosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    photosApiMock.uploadAdPhotosMultipart.mockResolvedValue({
      photos: [{ id: 'p1', src: '/uploads/p1.jpg' }]
    });
  });

  test('renders upload control (file input)', async () => {
    renderPage();

    const input = await screen.findByTestId('photo-file');
    expect(input).toBeTruthy();
  });

  test('upload calls uploadAdPhotosMultipart', async () => {
    const user = userEvent.setup();
    renderPage();

    const input = (await screen.findByTestId('photo-file')) as HTMLInputElement;

    const file = new File(['hello'], 'hello.png', { type: 'image/png' });
    await user.upload(input, file);

    expect(photosApiMock.uploadAdPhotosMultipart).toHaveBeenCalledTimes(1);

    // optional: ensure it was called with object arg containing adId/files/token
    const firstArg = photosApiMock.uploadAdPhotosMultipart.mock.calls[0]?.[0];
    expect(firstArg).toBeTruthy();
  });
});
