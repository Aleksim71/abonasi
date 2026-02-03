// frontend/src/pages/dev/DraftPhotosPlayground.tsx
import React, { useMemo, useState } from 'react';
import './draftPhotosPlayground.css';

type UiState = 'idle' | 'reorder' | 'saving' | 'saved' | 'offline';

type Photo = {
  id: string;
  src: string;
  alt: string;
};

function makeSvgDataUrl(label: string): string {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#d9d9d9"/>
        <stop offset="100%" stop-color="#bfbfbf"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect x="40" y="40" width="720" height="720" fill="none" stroke="#8a8a8a" stroke-width="8"/>
    <text x="50%" y="52%" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial"
      font-size="72" fill="#2c2c2c">${label}</text>
  </svg>
  `.trim();

  // encode as URI (safe for quick mocks)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function DraftPhotosPlayground(): JSX.Element {
  const initialPhotos = useMemo<Photo[]>(
    () => [
      { id: 'p1', src: makeSvgDataUrl('1'), alt: 'Photo 1' },
      { id: 'p2', src: makeSvgDataUrl('2'), alt: 'Photo 2' },
      { id: 'p3', src: makeSvgDataUrl('3'), alt: 'Photo 3' },
      { id: 'p4', src: makeSvgDataUrl('4'), alt: 'Photo 4' },
      { id: 'p5', src: makeSvgDataUrl('5'), alt: 'Photo 5' },
      { id: 'p6', src: makeSvgDataUrl('6'), alt: 'Photo 6' }
    ],
    []
  );

  const [uiState, setUiState] = useState<UiState>('idle');
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);

  const isBusy = uiState === 'saving';
  const isOffline = uiState === 'offline';
  const isReorder = uiState === 'reorder';

  function onAddPhoto() {
    if (isBusy) return;
    const nextIndex = photos.length + 1;
    const id = `p${nextIndex}`;
    setPhotos((prev) => [
      ...prev,
      { id, src: makeSvgDataUrl(String(nextIndex)), alt: `Photo ${nextIndex}` }
    ]);
  }

  function onRemoveLast() {
    if (isBusy) return;
    setPhotos((prev) => prev.slice(0, Math.max(0, prev.length - 1)));
  }

  function onMove(idx: number, dir: -1 | 1) {
    if (isBusy) return;
    if (!isReorder && uiState !== 'idle' && uiState !== 'offline') return;

    const to = idx + dir;
    if (to < 0 || to >= photos.length) return;
    setPhotos((prev) => moveItem(prev, idx, to));
  }

  function statusText(): string {
    if (uiState === 'saving') return 'Saving…';
    if (uiState === 'saved') return 'Saved';
    if (uiState === 'offline') return 'Offline — changes will sync when online';
    return '';
  }

  return (
    <main className="dp-page" aria-label="Draft Photos debug page">
      <header className="dp-header">
        <div className="dp-header__titles">
          <h1 className="dp-title">Photos</h1>
          <p className="dp-hint">
            {uiState === 'reorder'
              ? 'Reorder mode — use controls or keyboard focus to inspect'
              : 'Drag to reorder (debug: use arrows on cards)'}
          </p>
        </div>

        <div className="dp-toolbar" role="group" aria-label="Debug controls">
          <label className="dp-field">
            <span className="dp-field__label">State</span>
            <select
              className="dp-select"
              value={uiState}
              onChange={(e) => setUiState(e.target.value as UiState)}
              aria-label="UI state"
            >
              <option value="idle">idle</option>
              <option value="reorder">reorder</option>
              <option value="saving">saving</option>
              <option value="saved">saved</option>
              <option value="offline">offline</option>
            </select>
          </label>

          <button className="dp-btn" type="button" onClick={onAddPhoto} disabled={isBusy}>
            Add photo
          </button>

          <button className="dp-btn" type="button" onClick={onRemoveLast} disabled={isBusy || photos.length === 0}>
            Remove last
          </button>
        </div>
      </header>

      <section
        className={`dp-grid ${isBusy ? 'dp-grid--disabled' : ''}`}
        aria-label="Photos grid"
        aria-busy={isBusy ? 'true' : 'false'}
      >
        {photos.map((p, idx) => (
          <article
            key={p.id}
            className={`dp-card ${isReorder ? 'dp-card--reorder' : ''}`}
            tabIndex={0}
            aria-label={`Photo ${idx + 1}`}
          >
            <img className="dp-card__img" src={p.src} alt={p.alt} draggable={false} />
            <div className="dp-card__meta">
              <span className="dp-index" aria-hidden="true">
                {idx + 1}
              </span>

              <div className="dp-card__actions" aria-label="Reorder controls">
                <button
                  className="dp-iconbtn"
                  type="button"
                  onClick={() => onMove(idx, -1)}
                  disabled={isBusy || idx === 0}
                  aria-label="Move left"
                  title="Move left"
                >
                  ←
                </button>
                <button
                  className="dp-iconbtn"
                  type="button"
                  onClick={() => onMove(idx, 1)}
                  disabled={isBusy || idx === photos.length - 1}
                  aria-label="Move right"
                  title="Move right"
                >
                  →
                </button>
              </div>
            </div>
          </article>
        ))}

        <article className="dp-card dp-card--add" tabIndex={0} aria-label="Add photo">
          <button className="dp-add" type="button" onClick={onAddPhoto} disabled={isBusy}>
            Add photo
          </button>
        </article>
      </section>

      <footer className="dp-status" aria-live="polite">
        <span className={`dp-status__text ${statusText() ? 'dp-status__text--on' : ''}`}>
          {statusText()}
        </span>

        {/* маленькая подсказка для проверки offline поведения */}
        {isOffline && (
          <span className="dp-status__sub" aria-hidden="true">
            (Reorder stays enabled)
          </span>
        )}
      </footer>
    </main>
  );
}

export default DraftPhotosPlayground;
