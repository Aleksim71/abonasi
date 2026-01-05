import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as AdsApi from '../api/ads.api';
import { ApiError } from '../api/http';
import { useAuth } from '../store/auth.store';
import { ErrorBox } from '../ui/ErrorBox';
import { Loading } from '../ui/Loading';

export function AdDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [ad, setAd] = useState<AdsApi.AdDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = useMemo(() => {
    if (!ad || !user) return false;
    // backend may return ownerId; if not, just hide owner actions
    return ad.ownerId ? ad.ownerId === user.id : false;
  }, [ad, user]);

  async function refresh() {
    if (!id) return;
    setError(null);
    setLoading(true);
    try {
      const data = await AdsApi.getById(id);
      setAd(data);
    } catch (err) {
      const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function act(fn: () => Promise<AdsApi.AdDetails>) {
    setError(null);
    setMutating(true);
    try {
      const data = await fn();
      setAd(data);
    } catch (err) {
      const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
      setError(msg);
    } finally {
      setMutating(false);
    }
  }

  if (!id) return <ErrorBox message="Missing id param" />;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Ad</h2>
        <Link to="/feed">Back to feed</Link>
      </div>

      {error && <ErrorBox message={error} />}
      {loading && <Loading />}

      {!loading && ad && (
        <>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>{ad.title}</strong>
            <span className="small muted">{ad.status}</span>
          </div>
          <div className="small muted">id: {ad.id}</div>
          <p className="muted">{ad.description ?? ''}</p>

          {Array.isArray(ad.photos) && ad.photos.length > 0 && (
            <div>
              <div className="small muted">Photos:</div>
              <ul>
           {ad.photos
  .slice()
  .sort((a, b) => String(a.id).localeCompare(String(b.id)))
  .map((p, idx) => (
    <li key={p.id}>
      <span className="small muted">#{idx + 1}</span> {p.filePath}
    </li>
  ))}

              </ul>
            </div>
          )}

          <hr />

          <div className="row">
            <button className="btn" onClick={refresh} disabled={mutating}>
              Refresh
            </button>

            {isOwner && (
              <>
                {ad.status === 'draft' && (
                  <Link to={`/draft/${ad.id}/photos`} className="btn" style={{ textDecoration: 'none' }}>
                    Photos
                  </Link>
                )}

                <button
                  className="btn"
                  disabled={mutating || ad.status !== 'draft'}
                  onClick={() => act(() => AdsApi.publish(ad.id))}
                >
                  Publish
                </button>
                <button
                  className="btn"
                  disabled={mutating || ad.status !== 'active'}
                  onClick={() => act(() => AdsApi.stop(ad.id))}
                >
                  Stop
                </button>
                <button
                  className="btn"
                  disabled={mutating || ad.status !== 'stopped'}
                  onClick={() => act(() => AdsApi.restart(ad.id))}
                >
                  Restart
                </button>
              </>
            )}

            {!isOwner && <span className="small muted">Owner actions hidden.</span>}
          </div>
        </>
      )}
    </div>
  );
}
