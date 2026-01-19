import { SavedIndicator } from './SavedIndicator';

type DraftPhotosSavedIndicatorProps = {
  /**
   * UX state from DraftPhotosPage reducer
   * waitingForOnline | saving | error | saved
   */
  uxState: 'waitingForOnline' | 'saving' | 'error' | 'saved';
};

/**
 * DraftPhotos Saved ✓ indicator binding
 *
 * Contract:
 * - Saved ✓ visible ONLY when uxState === 'saved'
 * - Any other state hides immediately (reorder, saving, offline, error)
 * - No timers, no side effects
 */
export function DraftPhotosSavedIndicator({
  uxState,
}: DraftPhotosSavedIndicatorProps) {
  return <SavedIndicator visible={uxState === 'saved'} />;
}
