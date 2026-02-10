import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as AdsApi from '../api/ads.api';
import { ApiError } from '../api/http';
import { ErrorBox } from '../ui/ErrorBox';
import { Loading } from '../ui/Loading';

import './myAds.css';

export function MyAdsPage() {
  const [ads, setAds] = useState<AdsApi.AdListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const data = await AdsApi.myAds();
      setAds(data);
    } catch (err) {
      const msg =
        err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!alive) return;
      await load();
    })();

    return () => {
      alive = false;
    };
  }, [load]);

  const counts = useMemo(() => {
    let drafts = 0;
    let published = 0;

    for (const ad of ads) {
      if (ad.status === 'draft') drafts += 1;
      if (ad.status === 'active') published += 1;
    }

    return { drafts, published };
  }, [ads]);

  return (
    <div className="myads">
      <div className="myads__header">
        <h2 className="myads__title">Мои объявления</h2>

        <Link className="btn" to="/draft/new">
          + Создать объявление
        </Link>
      </div>

      {error && (
        <div className="myads__retry">
          <div style={{ flex: 1 }}>
            <ErrorBox title="Ошибка" message={error} />
          </div>
          <button className="btn" type="button" onClick={load}>
            Повторить
          </button>
        </div>
      )}

      {loading && <Loading />}

      {!loading && !error && (
        <div className="myads__grid">
          {/* Баланс */}
          <div className="card myads__card">
            <div className="myads__card-meta">
              <div className="myads__card-title">Баланс</div>
            </div>

            <div className="myads__balance muted small">0,00 €</div>
          </div>

          {/* Объявления: счётчики */}
          <div className="card myads__card">
            <div className="myads__card-meta">
              <div className="myads__card-title">Объявления</div>
            </div>

            <div className="myads__counters">
              <div className="myads__row">
                <span className="small muted">Опубликовано</span>
                <strong>{counts.published}</strong>
              </div>

              <div className="myads__row">
                <span className="small muted">Черновики</span>
                <strong>{counts.drafts}</strong>
              </div>

              {ads.length === 0 && (
                <div className="myads__hint small muted">
                  У вас пока нет объявлений. Нажмите «Создать объявление», чтобы начать.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
