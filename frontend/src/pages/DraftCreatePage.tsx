import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as AdsApi from '../api/ads.api';
import { ApiError } from '../api/http';
import { ErrorBox } from '../ui/ErrorBox';
import { Loading } from '../ui/Loading';
import { useLocationStore } from '../store/location.store';

import './draftCreate.css';

// -----------------------------
// helpers (оставляем — у тебя store мог менять форму)
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

  const direct = pickString(store, [
    'locationId',
    'location_id',
    'selectedLocationId',
    'currentLocationId'
  ]);
  if (direct) return direct;

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
  const locationId = useMemo(() => extractLocationIdFromStore(locationStore), [locationStore]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(locationId) && Boolean(title.trim()) && !loading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!locationId) {
      setError('Сначала выберите локацию');
      return;
    }

    if (!title.trim()) {
      setError('Введите заголовок');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const ad = await AdsApi.createDraft({
        title: title.trim(),
        description: description.trim(),
        locationId
      });

      // ✅ router.tsx: 'draft/:id/photos'
      nav(`/draft/${ad.id}/photos`, { replace: true });
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
    <div className="draftcreate">
      <div className="card draftcreate__card">
        <h2 className="draftcreate__title">Новое объявление</h2>
        <p className="muted small draftcreate__hint">
          Заполните минимум — дальше добавим фото.
        </p>

        {error && <ErrorBox title="Ошибка" message={error} />}

        <form onSubmit={onSubmit} className="draftcreate__form">
          <div className="draftcreate__field">
            <div className="draftcreate__label">Заголовок</div>
            <input
              className="input"
              placeholder="Например: Продам детскую коляску"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="draftcreate__field">
            <div className="draftcreate__label">Описание</div>
            <textarea
              className="input"
              placeholder="Коротко: состояние, комплектация, нюансы"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={5}
            />
          </div>

          {!locationId && <div className="draftcreate__note">Сначала выберите локацию</div>}

          <div className="draftcreate__actions">
            <button className="btn draftcreate__submit" type="submit" disabled={!canSubmit}>
              {loading ? <Loading /> : 'Продолжить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
