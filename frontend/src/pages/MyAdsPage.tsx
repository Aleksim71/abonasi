import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as AdsApi from '../api/ads.api';
import { ApiError } from '../api/http';
import { ErrorBox } from '../ui/ErrorBox';
import { Loading } from '../ui/Loading';

import './myAds.css';

function statusLabel(status: AdsApi.AdStatus): string {
  switch (status) {
    case 'draft':
      return 'Черновик';
    case 'active':
      return 'Опубликовано';
    case 'stopped':
      return 'Остановлено';
    default:
      return status;
  }
}

function statusClass(status: AdsApi.AdStatus): string {
  return `myads__status myads__status--${status}`;
}

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

  return (
    <div className="myads">
      <div className="myads__header">
        <h2 className="myads__title">Мои объявления</h2>

        <Link className="btn" to="/draft/new" style={{ textDecoration: 'none' }}>
          Создать объявление
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

      {!loading && !error && ads.length === 0 && (
        <div className="card myads__empty">
          <div className="myads__empty-title">У вас пока нет объявлений</div>
          <div className="myads__empty-text muted">
            Создайте первое объявление — это займёт пару минут.
          </div>
          <div style={{ marginTop: 12 }}>
            <Link className="btn" to="/draft/new" style={{ textDecoration: 'none' }}>
              Создать объявление
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && ads.length > 0 && (
        <div className="myads__grid">
          {ads.map((ad) => (
            <div className="card myads__card" key={ad.id}>
              <div className="myads__card-meta">
                <div className="myads__card-title">{ad.title}</div>
                <span className={statusClass(ad.status)}>
                  {statusLabel(ad.status)}
                </span>
              </div>

              <div className="small muted">
                {ad.price != null
                  ? `${ad.price} ${ad.currency ?? ''}`.trim()
                  : 'Цена не указана'}
              </div>

              <div>
                <Link to={`/ads/${ad.id}`}>Открыть</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
