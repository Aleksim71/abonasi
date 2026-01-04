import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as AdsApi from '../api/ads.api';
import { ApiError } from '../api/http';
import { ErrorBox } from '../ui/ErrorBox';
import { Loading } from '../ui/Loading';

/**
 * IMPORTANT:
 * Backend expects JSON { filePath } for adding photos (not multipart upload).
 * This page is a minimal UX for MVP: paste a filePath and add it.
 */
export function DraftPhotosPage() {
  const { id } = useParams();
  const adId = String(id || '').trim();

  const [photos, setPhotos] = useState<AdsApi.AdPhoto[]>([]);
  const [filePath, setFilePath] = useState('');
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () => photos.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [photos]
  );

  async function refresh() {
    if (!adId) return;
    setError(null);
    setLoading(true);
    try {
      const ad = await AdsApi.getById(adId);
      setPhotos(Array.isArray(ad.photos) ? ad.photos : []);
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

  async function addByPath() {
    const fp = filePath.trim();
    if (fp.length < 3) {
      setError('BAD_REQUEST: filePath must be 3..500 chars');
      return;
    }

    setError(null);
    setMutating(true);
    try {
      const res = await AdsApi.addPhotoByPath(adId, fp);
      setPhotos(res.photos || []);
      setFilePath('');
    } catch (err) {
      const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
      setError(msg);
    } finally {
      setMutating(false);
    }
  }

  async function remove(photoId: string) {
    setError(null);
    setMutating(true);
    try {
      const res = await AdsApi.deletePhoto(adId, photoId);
      setPhotos(res.photos || []);
    } catch (err) {
      const msg = err instanceof ApiError ? `${err.errorCode}: ${err.message}` : 'Unknown error';
      setError(msg);
    } finally {
      setMutating(false);
    }
  }

  if (!adId) return <ErrorBox message="Missing id param" />;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Draft Photos</h2>
        <Link to={`/ads/${adId}`}>Back to Ad</Link>
      </div>

      <div className="small muted">adId: {adId}</div>

      {error && <ErrorBox message={error} />}
      {loading && <Loading />}

      {!loading && (
        <>
          <div style={{ marginTop: 12 }}>
            <label className="small muted">filePath (paste absolute path)</label>
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="/home/.../picture.jpg"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                disabled={mutating}
              />
              <button className="btn" onClick={addByPath} disabled={mutating || filePath.trim().length < 3}>
                Add
              </button>
            </div>
            <div className="small muted" style={{ marginTop: 6 }}>
              Backend rule: publish requires at least 1 photo.
            </div>
          </div>

          <hr />

          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Photos</strong>
            <button className="btn" onClick={refresh} disabled={mutating}>
              Refresh
            </button>
          </div>

          {sorted.length === 0 && <p className="muted">No photos yet.</p>}

          {sorted.length > 0 && (
            <div className="grid" style={{ marginTop: 10 }}>
              {sorted.map((p) => (
                <div className="card" key={p.id}>
                  <div className="small muted">#{p.sortOrder}</div>
                  <div style={{ wordBreak: 'break-word' }}>{p.filePath}</div>
                  <div className="small muted">id: {p.id}</div>
                  <div style={{ marginTop: 10 }}>
                    <button className="btn" onClick={() => remove(p.id)} disabled={mutating}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
