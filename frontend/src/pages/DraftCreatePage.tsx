import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as AdsApi from '../api/ads.api';
import { ApiError } from '../api/http';
import { ErrorBox } from '../ui/ErrorBox';
import { Loading } from '../ui/Loading';
import { useLocationStore } from '../store/location.store';

// -----------------------------
// helpers
// -----------------------------
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}

function extractLocationIdFromStore(store: unknown): string | null {
  if (!isRecord(store)) return null;

  // 1) direct id fields
  const direct = pickString(store, [
    'locationId',
    'location_id',
    'selectedLocationId',
    'currentLocationId'
  ]);
  if (direct) return direct;

  // 2) nested object candidates
  const nestedCandidates: unknown[] = [
    store.selectedLocation,
    store.currentLocation,
    store.location,
    store.selected,
    store.current
  ];

  for (const cand of nestedCandidates) {
    if (!isRecord(cand)) continue;
    const id = pickString(cand, ['id', 'locationId', 'uuid']);
    if (id) return id;
  }

  // 3) sometimes selectedId/currentId
  const selectedId = pickString(store, ['selectedId', 'currentId']);
  if (selectedId) return selectedId;

  return null;
}

// -----------------------------
// page
// -----------------------------
export function DraftCreatePage() {
  const nav = useNavigate();

  // Zustand store returns whole state
  const locationStore = useLocationStore() as unknown;
  const locationId = useMemo(
    () => extractLocationIdFromStore(locationStore),
    [locationStore]
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!locationId) {
      setError('Сначала выберите локацию');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const ad = await AdsApi.createDraft({
        title,
        description,
        locationId
      });

      nav(`/ads/${ad.id}/photos`);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message || 'Не удалось создать черновик');
      } else {
        setError('Не удалось создать черновик');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Новое объявление</h1>

      {error && <ErrorBox title="Ошибка" message={error} />}

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
        <input
          placeholder="Заголовок"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
        />

        <textarea
          placeholder="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          rows={5}
        />

        <button type="submit" disabled={loading || !locationId}>
          {loading ? <Loading /> : 'Продолжить'}
        </button>

        {!locationId && (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Сначала выберите локацию
          </div>
        )}
      </form>
    </div>
  );
}
