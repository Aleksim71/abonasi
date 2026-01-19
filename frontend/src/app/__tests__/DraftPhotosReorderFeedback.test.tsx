import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { DraftPhotosPage } from '../../pages/DraftPhotosPage';

// --- auth mock ---
vi.mock('../../store/auth.store', () => ({
  useAuth: () => ({ token: 'test-token', user: { id: 'u1' } }),
}));

// --- Photos API mock ---
const uploadAdPhotosMultipartMock = vi.fn();
const reorderAdPhotosMock = vi.fn();

vi.mock('../../api/photos.api', () => ({
  uploadAdPhotosMultipart: (...args: unknown[]) => uploadAdPhotosMultipartMock(...args),
  reorderAdPhotos: (...args: unknown[]) => reorderAdPhotosMock(...args),
}));

// --- order persister mock ---
vi.mock('../../pages/draftPhotos.persistOrder', () => ({
  createDraftPhotosOrderPersister: () => ({
    schedule: vi.fn(),
    cancel: vi.fn(),
    retryNow: vi.fn(() => true),
  }),
}));

function makeDataTransfer() {
  const store: Record<string, string> = {};
  return {
    effectAllowed: 'move',
    dropEffect: 'move',
    setData: (_type: string, val: string) => {
      store['text/plain'] = String(val);
    },
    getData: () => store['text/plain'] ?? '',
    clearData: () => {
      delete store['text/plain'];
    },
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ads/123/photos']}>
      <Routes>
        <Route path="/ads/:id/photos" element={<DraftPhotosPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('B6 reorder micro-feedback (native DnD)', () => {
  beforeEach(() => {
    // IMPORTANT: do NOT use fake timers globally — RTL findBy* relies on timers.
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });

    uploadAdPhotosMultipartMock.mockReset();
    reorderAdPhotosMock.mockReset();

    uploadAdPhotosMultipartMock
      .mockResolvedValueOnce({ photo: { id: 'p1', url: 'https://example.com/p1.jpg' } })
      .mockResolvedValueOnce({ photo: { id: 'p2', url: 'https://example.com/p2.jpg' } });

    reorderAdPhotosMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('adds is-dragging on dragStart and updates drop target on dragOver', async () => {
    renderPage();

    const input = screen.getByTestId('photo-file') as HTMLInputElement;
    const file1 = new File(['a'], 'a.png', { type: 'image/png' });
    const file2 = new File(['b'], 'b.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file1, file2] } });

    const card1 = await screen.findByTestId('server-photo-p1');
    const card2 = await screen.findByTestId('server-photo-p2');

    const dt = makeDataTransfer();

    fireEvent.dragStart(card1, { dataTransfer: dt });
    expect(card1).toHaveClass('is-dragging');

    fireEvent.dragOver(card2, { dataTransfer: dt });
    expect(card2).toHaveClass('is-drop-target');
  });

  it('adds is-settling on drop and clears it after timeout', async () => {
    renderPage();

    const input = screen.getByTestId('photo-file') as HTMLInputElement;
    const file1 = new File(['a'], 'a.png', { type: 'image/png' });
    const file2 = new File(['b'], 'b.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file1, file2] } });

    const card1 = await screen.findByTestId('server-photo-p1');
    const card2 = await screen.findByTestId('server-photo-p2');

    // enable fake timers ONLY for settle timeout handling
    vi.useFakeTimers();

    const dt = makeDataTransfer();

    fireEvent.dragStart(card1, { dataTransfer: dt });
    fireEvent.dragOver(card2, { dataTransfer: dt });
    fireEvent.drop(card2, { dataTransfer: dt });

    expect(document.querySelectorAll('.dp-item.is-settling').length).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(220);
    });

    expect(document.querySelectorAll('.dp-item.is-settling').length).toBe(0);

    vi.useRealTimers();
  });

  it('clears drag classes on dragEnd (even without drop)', async () => {
    renderPage();

    const input = screen.getByTestId('photo-file') as HTMLInputElement;
    const file1 = new File(['a'], 'a.png', { type: 'image/png' });
    const file2 = new File(['b'], 'b.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file1, file2] } });

    const card1 = await screen.findByTestId('server-photo-p1');
    const dt = makeDataTransfer();

    fireEvent.dragStart(card1, { dataTransfer: dt });
    expect(card1).toHaveClass('is-dragging');

    fireEvent.dragEnd(card1, { dataTransfer: dt });

    const card1Again = await screen.findByTestId('server-photo-p1');
    expect(card1Again).not.toHaveClass('is-dragging');
  });
});
