import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { DraftPhotosPage } from '../../pages/DraftPhotosPage';

export function renderDraftPhotosPage(entry = '/draft/ad-1/photos') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/draft/:id/photos" element={<DraftPhotosPage />} />
      </Routes>
    </MemoryRouter>
  );
}
