import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as AdsApi from '../api/ads.api';
import { ApiError } from '../api/http';
import { ErrorBox } from '../ui/ErrorBox';
import { Loading } from '../ui/Loading';

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
      const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
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
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Мои объявления</h2>

        <Link className="btn" to="/draft/new" style={{ textDecoration: 'none' }}>
          Создать объявление
        </Link>
      </div>

      {error && (
        <div className="row" style={{ marginTop: 12, alignItems: 'flex-start' }}>
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
        <div className="card" style={{ marginTop: 12, textAlign: 'center' }}>
          <strong>У вас пока нет объявлений</strong>
          <div className="small muted" style={{ marginTop: 6 }}>
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
        <div className="grid" style={{ marginTop: 12 }}>
          {ads.map((ad) => (
            <div className="card" key={ad.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{ad.title}</strong>
                <span className="small muted">{statusLabel(ad.status)}</span>
              </div>

              <div className="small muted" style={{ marginTop: 6 }}>
                {ad.price != null ? `${ad.price} ${ad.currency ?? ''}`.trim() : 'Цена не указана'}
              </div>

              <div style={{ marginTop: 10 }}>
                <Link to={`/ads/${ad.id}`}>Открыть</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
