import './draftPhotos.savedIndicator.css';

type SavedIndicatorProps = {
  /**
   * true — показать Saved ✓
   * false — скрыть (мгновенно гасится при reorder / saving / offline)
   */
  visible: boolean;
};

/**
 * Saved ✓ indicator
 *
 * UX contract:
 * - visibility управляется ТОЛЬКО состоянием (`state === 'saved'`)
 * - никаких таймеров внутри
 * - reorder мгновенно скрывает
 * - safe for optimistic UI
 */
export function SavedIndicator({ visible }: SavedIndicatorProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={`saved ${visible ? 'is-visible' : ''}`}
    >
      Saved ✓
    </div>
  );
}
