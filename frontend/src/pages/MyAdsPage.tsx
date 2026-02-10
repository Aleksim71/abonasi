import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as AdsApi from '../api/ads.api';
import { ApiError } from '../api/http';
import { ErrorBox } from '../ui/ErrorBox';
import { Loading } from '../ui/Loading';

export function MyAdsPage() {
  const [ads, setAds] = useState<AdsApi.AdListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const data = await AdsApi.myAds();
        if (!alive) return;
        setAds(data);
      } catch (err) {
        const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
        if (alive) setError(msg);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>My Ads</h2>
        <Link className="btn" to="/draft/new" style={{ textDecoration: 'none' }}>
          New draft
        </Link>
      </div>

      {error && <ErrorBox message={error} />}
      {loading && <Loading />}

      {!loading && (
        <div className="grid">
          {ads.map((ad) => (
            <div className="card" key={ad.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{ad.title}</strong>
                <span className="small muted">{ad.status}</span>
              </div>
              <div className="small muted">id: {ad.id}</div>
              <div style={{ marginTop: 10 }}>
                <Link to={`/ads/${ad.id}`}>Open</Link>
              </div>
            </div>
          ))}
          {ads.length === 0 && <p className="muted">No ads yet.</p>}
        </div>
      )}
    </div>
  );
}
