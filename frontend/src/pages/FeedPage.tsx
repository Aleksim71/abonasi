// frontend/src/pages/FeedPage.tsx

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as AdsApi from '../api/ads.api';
import { ApiError } from '../api/http';
import { useLocationStore } from '../store/location.store';
import { ErrorBox } from '../ui/ErrorBox';
import { Loading } from '../ui/Loading';

type FeedPhoto = { id: string; url: string; order: number };

// Feed items may or may not include photos (backend can extend later).
type FeedAdMaybePhotos = AdsApi.AdListItem & { photos?: FeedPhoto[] };

export function FeedPage() {
  // Store does NOT expose `locationId` directly (TS error).
  // It likely stores selected location object; we derive the id from it.
  const { location } = useLocationStore() as unknown as { location?: { id: string } | null };
  const locationId = location?.id ?? '';

  const [ads, setAds] = useState<FeedAdMaybePhotos[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
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
        if (!alive) return;
        setAds(data as FeedAdMaybePhotos[]);
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
  }, [locationId]);

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Feed</h2>
        {!!locationId && <span className="small muted">locationId: {locationId}</span>}
      </div>

      {!locationId && (
        <p className="muted" style={{ marginTop: 10 }}>
          Select a location to see the feed.
        </p>
      )}

      {error && <ErrorBox message={error} />}
      {loading && <Loading />}

      {!loading && !!locationId && (
        <div className="grid">
          {ads.map((ad) => {
            const photos = ad.photos ?? [];
            const preview = photos.find((p) => p.order === 1) ?? photos[0] ?? null;
            const photosCount = photos.length;

            return (
              <div className="card" key={ad.id}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ad.title}
                  </strong>
                  <span className="small muted">{ad.status}</span>
                </div>

                <div style={{ marginTop: 10 }}>
                  {preview ? (
                    <div style={{ position: 'relative' }}>
                      <img
                        src={preview.url}
                        alt="preview"
                        style={{
                          width: '100%',
                          height: 170,
                          objectFit: 'cover',
                          borderRadius: 12,
                          border: '1px solid rgba(0,0,0,0.08)'
                        }}
                      />

                      {photosCount > 1 && (
                        <div
                          className="small"
                          style={{
                            position: 'absolute',
                            right: 10,
                            bottom: 10,
                            padding: '4px 8px',
                            borderRadius: 999,
                            background: 'rgba(0,0,0,0.65)',
                            color: 'white'
                          }}
                        >
                          📷 {photosCount}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className="muted"
                      style={{
                        width: '100%',
                        height: 170,
                        borderRadius: 12,
                        border: '1px dashed rgba(0,0,0,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      No photo
                    </div>
                  )}
                </div>

                <div className="small muted" style={{ marginTop: 10 }}>
                  id: {ad.id}
                </div>

                <div style={{ marginTop: 10 }}>
                  <Link to={`/ads/${ad.id}`}>Open</Link>
                </div>
              </div>
            );
          })}

          {ads.length === 0 && <p className="muted">No ads yet.</p>}
        </div>
      )}
    </div>
  );
}
