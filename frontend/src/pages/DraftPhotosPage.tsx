import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as AdsApi from '../api/ads.api';
import { ApiError } from '../api/http';
import { ErrorBox } from '../ui/ErrorBox';
import { Loading } from '../ui/Loading';

export function DraftPhotosPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [ad, setAd] = useState<AdsApi.AdDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Hooks must NOT be conditional. So we keep hooks above any early return.
  const adId = id ?? '';

  const photos = useMemo(() => {
    const list = ad?.photos ?? [];
    return list.slice().sort((a, b) => a.order - b.order);
  }, [ad]);

  const canPublish = Boolean(ad && ad.status === 'draft' && photos.length >= 1 && !busy);

  async function refresh() {
    if (!adId) return;

    setError(null);
    setLoading(true);
    try {
      const data = await AdsApi.getById(adId);
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
  }, [adId]);

  async function onAdd(file: File) {
    if (!adId) return;

    setError(null);
    setBusy(true);
    try {
      const data = await AdsApi.addPhoto(adId, file);
      setAd(data);
    } catch (err) {
      const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(photoId: string) {
    if (!adId || !ad) return;

    const prev = ad;
    const nextPhotos = (prev.photos ?? []).filter((p) => p.id !== photoId);

    // optimistic UI
    setAd({ ...prev, photos: nextPhotos });
    setError(null);
    setBusy(true);

    try {
      const data = await AdsApi.deletePhoto(adId, photoId);
      setAd(data);
    } catch (err) {
      // rollback
      setAd(prev);
      const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onMove(photoId: string, dir: -1 | 1) {
    if (!adId || !ad) return;

    const sorted = photos;
    const idx = sorted.findIndex((p) => p.id === photoId);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= sorted.length) return;

    const prev = ad;

    // build new order list (ids)
    const ids = sorted.map((p) => p.id);
    const tmp = ids[idx];
    ids[idx] = ids[nextIdx];
    ids[nextIdx] = tmp;

    // optimistic: rebuild photos with new .order for UI
    const byId = new Map((prev.photos ?? []).map((p) => [p.id, p] as const));
    const optimisticPhotos = ids
      .map((pid, i) => {
        const p = byId.get(pid);
        return p ? { ...p, order: i + 1 } : null;
      })
      .filter(Boolean) as NonNullable<AdsApi.AdDetails['photos']>;

    setAd({ ...prev, photos: optimisticPhotos });
    setError(null);
    setBusy(true);

    try {
      const data = await AdsApi.reorderPhotos(adId, ids);
      setAd(data);
    } catch (err) {
      // rollback
      setAd(prev);
      const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    if (!adId || !ad) return;

    setError(null);
    setBusy(true);
    try {
      const data = await AdsApi.publish(adId);
      setAd(data);
      nav(`/ads/${data.id}`, { replace: true });
    } catch (err) {
      const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  if (!id) return <ErrorBox message="Missing id param" />;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Draft photos</h2>
        <Link to="/my-ads">Back to my ads</Link>
      </div>

      {error && <ErrorBox message={error} />}
      {loading && <Loading />}

      {!loading && ad && (
        <>
          <div className="small muted">
            adId: {ad.id} | status: {ad.status} | photos: {photos.length}
          </div>

          <div style={{ marginTop: 12 }} className="row">
            <input
              className="input"
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onAdd(f);
                e.currentTarget.value = '';
              }}
            />
            <button className="btn" onClick={refresh} disabled={busy}>
              Refresh
            </button>

            <button className="btn" onClick={onPublish} disabled={!canPublish}>
              Publish
            </button>
          </div>

          {ad.status === 'draft' && photos.length === 0 && (
            <div className="small muted" style={{ marginTop: 8 }}>
              Add at least 1 photo to publish.
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            {photos.length === 0 ? (
              <p className="muted">No photos yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
                {photos.map((p, index) => {
                  const isFirst = index === 0;
                  const isLast = index === photos.length - 1;

                  return (
                    <li
                      key={p.id}
                      className="row"
                      style={{
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        border: '1px solid rgba(0,0,0,0.08)',
                        borderRadius: 10,
                        padding: 10
                      }}
                    >
                      <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                        <div className="small muted" style={{ width: 44 }}>
                          #{p.order}
                        </div>

                        <img
                          src={p.url}
                          alt={`photo-${p.order}`}
                          style={{
                            width: 86,
                            height: 86,
                            objectFit: 'cover',
                            borderRadius: 10,
                            border: '1px solid rgba(0,0,0,0.08)'
                          }}
                        />

                        <div style={{ display: 'grid', gap: 4 }}>
                          <div className="small muted" style={{ maxWidth: 520, wordBreak: 'break-all' }}>
                            {p.url}
                          </div>
                        </div>
                      </div>

                      <span className="row" style={{ gap: 8 }}>
                        <button className="btn" disabled={busy || isFirst} onClick={() => onMove(p.id, -1)}>
                          ↑
                        </button>
                        <button className="btn" disabled={busy || isLast} onClick={() => onMove(p.id, 1)}>
                          ↓
                        </button>
                        <button className="btn danger" disabled={busy} onClick={() => onDelete(p.id)}>
                          Delete
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
