// frontend/src/pages/FeedPage.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as AdsApi from '../api/ads.api';
import { ApiError } from '../api/http';
import { useAuth } from '../store/auth.store';
import { useLocationStore } from '../store/location.store';
import { ErrorBox } from '../ui/ErrorBox';
import { Loading } from '../ui/Loading';

import './FeedPage.css';

export function FeedPage() {
  const nav = useNavigate();
  const { token } = useAuth();
  const isAuthed = Boolean(token);

  // ✅ теперь тут UUID
  const locationId = useLocationStore((s) => s.selectedId);
  const locationLabel = useLocationStore((s) => s.asLabel());

  const [ads, setAds] = useState<AdsApi.AdListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLocation = Boolean(locationId);
  const createTarget = useMemo(() => (isAuthed ? '/draft/new' : '/login'), [isAuthed]);

  const load = useCallback(async () => {
    if (!locationId) {
      setAds([]);
      setError(null);
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const data = await AdsApi.feed({ locationId });
      setAds(data);
    } catch (err) {
      const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  return (
    <div className="feed">
      <div className="feed__top">
        <div className="feed__titleRow">
          <h2 className="feed__title">Лента</h2>

          <div className="feed__meta">
            {hasLocation ? (
              <>
                <span className="feed__metaLabel">Район:</span>
                <span className="feed__metaValue">{locationLabel}</span>
                <Link className="feed__metaLink" to="/locations">
                  Сменить
                </Link>
              </>
            ) : (
              <Link className="feed__metaLink" to="/locations">
                Выбрать район
              </Link>
            )}
          </div>
        </div>

        <div className="feed__actions">
          <button className="feed__btn feed__btn--primary" type="button" onClick={() => nav(createTarget)}>
            Создать объявление
          </button>
          <button className="feed__btn" type="button" onClick={() => nav('/')}>
            На главную
          </button>
        </div>
      </div>

      {!hasLocation && (
        <div className="feed__panel">
          <p className="feed__muted">Чтобы увидеть ленту, сначала выберите район.</p>
          <button className="feed__btn feed__btn--primary" type="button" onClick={() => nav('/locations')}>
            Выбрать район
          </button>
        </div>
      )}

      {error && (
        <div className="feed__panel">
          <ErrorBox message={error} />
          <div className="feed__panelActions">
            <button className="feed__btn" type="button" onClick={load} disabled={loading}>
              Повторить
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="feed__panel">
          <Loading />
        </div>
      )}

      {!loading && hasLocation && !error && ads.length === 0 && (
        <div className="feed__panel">
          <h3 className="feed__panelTitle">Пока нет объявлений</h3>
          <p className="feed__muted">Попробуйте другой район или создайте первое объявление.</p>
          <div className="feed__panelActions">
            <button className="feed__btn feed__btn--primary" type="button" onClick={() => nav(createTarget)}>
              Создать объявление
            </button>
            <button className="feed__btn" type="button" onClick={() => nav('/locations')}>
              Сменить район
            </button>
          </div>
        </div>
      )}

      {!loading && hasLocation && !error && ads.length > 0 && (
        <div className="feed__grid" aria-label="Список объявлений">
          {ads.map((ad) => (
            <article className="feed__card" key={ad.id}>
              <div className="feed__cardHead">
                <strong className="feed__cardTitle" title={ad.title}>
                  {ad.title}
                </strong>
                <span className="feed__badge">{ad.status}</span>
              </div>

              <div className="feed__cardFooter">
                <Link className="feed__link" to={`/ads/${ad.id}`}>
                  Открыть
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
