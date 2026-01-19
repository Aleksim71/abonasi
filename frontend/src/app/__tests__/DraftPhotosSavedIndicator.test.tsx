import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { DraftPhotosSavedIndicator } from '../../pages/DraftPhotosSavedIndicator';

describe('DraftPhotosSavedIndicator', () => {
  it('shows Saved ✓ only when uxState === "saved"', () => {
    const { rerender } = render(<DraftPhotosSavedIndicator uxState="saving" />);

    // rendered but hidden
    expect(screen.getByText('Saved ✓')).not.toHaveClass('is-visible');

    // becomes visible
    rerender(<DraftPhotosSavedIndicator uxState="saved" />);
    expect(screen.getByText('Saved ✓')).toHaveClass('is-visible');

    // hides again
    rerender(<DraftPhotosSavedIndicator uxState="error" />);
    expect(screen.getByText('Saved ✓')).not.toHaveClass('is-visible');
  });

  it('hides Saved ✓ immediately on reorder-like state change', () => {
    const { rerender } = render(<DraftPhotosSavedIndicator uxState="saved" />);

    expect(screen.getByText('Saved ✓')).toHaveClass('is-visible');

    // simulate reorder → saving
    rerender(<DraftPhotosSavedIndicator uxState="saving" />);
    expect(screen.getByText('Saved ✓')).not.toHaveClass('is-visible');
  });

  it('never shows Saved ✓ under higher priority states', () => {
    const { rerender } = render(
      <DraftPhotosSavedIndicator uxState="waitingForOnline" />
    );

    // waitingForOnline
    expect(screen.getByText('Saved ✓')).not.toHaveClass('is-visible');

    // saving
    rerender(<DraftPhotosSavedIndicator uxState="saving" />);
    expect(screen.getByText('Saved ✓')).not.toHaveClass('is-visible');

    // error
    rerender(<DraftPhotosSavedIndicator uxState="error" />);
    expect(screen.getByText('Saved ✓')).not.toHaveClass('is-visible');
  });
});
