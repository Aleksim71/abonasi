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

  const photos = useMemo(() => (ad?.photos ?? []).slice().sort((a, b) => a.order - b.order), [ad]);

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

  if (!id) return <ErrorBox message="Missing id param" />;

  async function onAdd(file: File) {
    setError(null);
    setBusy(true);
    try {
      const data = await AdsApi.addPhoto(id, file);
      setAd(data);
    } catch (err) {
      const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(photoId: string) {
    setError(null);
    setBusy(true);
    try {
      const data = await AdsApi.deletePhoto(id, photoId);
      setAd(data);
    } catch (err) {
      const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onMove(photoId: string, dir: -1 | 1) {
    const idx = photos.findIndex((p) => p.id === photoId);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= photos.length) return;

    const reordered = photos.map((p) => p.id);
    const tmp = reordered[idx];
    reordered[idx] = reordered[nextIdx];
    reordered[nextIdx] = tmp;

    setError(null);
    setBusy(true);
    try {
      const data = await AdsApi.reorderPhotos(id, reordered);
      setAd(data);
    } catch (err) {
      const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    setError(null);
    setBusy(true);
    try {
      const data = await AdsApi.publish(id);
      setAd(data);
      nav(`/ads/${data.id}`, { replace: true });
    } catch (err) {
      const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

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
          <div className="small muted">adId: {ad.id} | status: {ad.status}</div>

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
            <button className="btn" onClick={onPublish} disabled={busy || ad.status !== 'draft'}>
              Publish
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            {photos.length === 0 ? (
              <p className="muted">No photos yet.</p>
            ) : (
              <ul>
                {photos.map((p) => (
                  <li key={p.id} className="row" style={{ justifyContent: 'space-between' }}>
                    <span>
                      <span className="small muted">#{p.order}</span> {p.url}
                    </span>
                    <span className="row">
                      <button className="btn" disabled={busy} onClick={() => onMove(p.id, -1)}>
                        ↑
                      </button>
                      <button className="btn" disabled={busy} onClick={() => onMove(p.id, 1)}>
                        ↓
                      </button>
                      <button className="btn danger" disabled={busy} onClick={() => onDelete(p.id)}>
                        Delete
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
