import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';

import { DraftPhotosPage } from '../../pages/DraftPhotosPage';

/**
 * Helper to render DraftPhotosPage with router + route params
 *
 * Usage:
 *   renderDraftPhotosPage('/draft/ad-1/photos')
 */
export function renderDraftPhotosPage(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/draft/:id/photos" element={<DraftPhotosPage />} />
      </Routes>
    </MemoryRouter>
  );
}
