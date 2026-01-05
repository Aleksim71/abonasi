import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { apiFetch, ApiError } from '../api/http';
import { useAuth } from '../store/auth.store';
import { ErrorBox } from '../ui/ErrorBox';
import { Loading } from '../ui/Loading';

import {
  deleteAdPhoto,
  getPreviewFilePath,
  reorderAdPhotos,
  sortPhotosByOrder,
  uploadAdPhotos,
  type Photo,
} from '../api/photos.api';

type AdDetails = {
  id: string;
  status: string;
  userId?: string | null;
  photos?: Photo[];
};

function isDraft(status: string | undefined | null): boolean {
  return String(status || '').toLowerCase() === 'draft';
}

function hasMessage(x: unknown): x is { message: unknown } {
  return typeof x === 'object' && x !== null && 'message' in x;
}

function toMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;

  if (hasMessage(e) && typeof e.message === 'string' && e.message.trim()) {
    return e.message;
  }

  return 'Something went wrong';
}

function toErrorHint(e: unknown): string | null {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Please sign in again.';
    if (e.status === 403) return 'You have no permissions to edit these photos.';
    if (e.status === 409) return 'Action not allowed in current status (draft-only).';
    if (e.status === 422) return 'Invalid data. Please check selected files.';
  }
  return null;
}

export function DraftPhotosPage() {
  const { id: adIdParam } = useParams();
  const adId = String(adIdParam || '').trim();
  const { user } = useAuth();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [ad, setAd] = useState<AdDetails | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [mutating, setMutating] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const isOwner = useMemo(() => {
    if (!user || !ad) return false;
    if (!ad.userId) return false;
    return String(ad.userId) === String(user.id);
  }, [user, ad]);

  const canEdit = useMemo(() => {
    return Boolean(isOwner && isDraft(ad?.status));
  }, [isOwner, ad?.status]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setHint(null);

      try {
        const data = await apiFetch<AdDetails>(`/api/ads/${encodeURIComponent(adId)}`, { method: 'GET' });
        if (cancelled) return;

        setAd(data);
        setPhotos(sortPhotosByOrder((data?.photos || []) as Photo[]));
      } catch (e) {
        if (cancelled) return;
        setError(toMessage(e));
        setHint(toErrorHint(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (!adId) {
      setLoading(false);
      setAd(null);
      setPhotos([]);
      setError('Ad id is missing');
      return;
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [adId]);

  async function onPickFiles(ev: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(ev.target.files || []);
    ev.target.value = '';

    if (!files.length) return;

    setError(null);
    setHint(null);
    setUploading(true);

    try {
      const res = await uploadAdPhotos({ adId, files });
      setPhotos(sortPhotosByOrder(res.photos));
    } catch (e) {
      setError(toMessage(e));
      setHint(toErrorHint(e));
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(photoId: string) {
    if (!canEdit) return;

    setError(null);
    setHint(null);
    setMutating(true);

    try {
      const res = await deleteAdPhoto({ adId, photoId });
      if (res.photos) setPhotos(sortPhotosByOrder(res.photos));
      else setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (e) {
      setError(toMessage(e));
      setHint(toErrorHint(e));
    } finally {
      setMutating(false);
    }
  }

  async function onMove(photoId: string, dir: -1 | 1) {
    if (!canEdit) return;

    const idx = photos.findIndex((p) => p.id === photoId);
    if (idx === -1) return;

    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= photos.length) return;

    const optimistic = [...photos];
    const [item] = optimistic.splice(idx, 1);
    optimistic.splice(nextIdx, 0, item);
    setPhotos(optimistic);

    setError(null);
    setHint(null);
    setMutating(true);

    try {
      const res = await reorderAdPhotos({ adId, photoIds: optimistic.map((p) => p.id) });
      setPhotos(sortPhotosByOrder(res.photos));
    } catch (e) {
      setPhotos(sortPhotosByOrder(photos));
      setError(toMessage(e));
      setHint(toErrorHint(e));
    } finally {
      setMutating(false);
    }
  }

  function onClickUpload() {
    if (!canEdit || uploading || mutating) return;
    fileInputRef.current?.click();
  }

  if (loading) return <Loading />;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <h2 style={{ margin: 0 }}>Draft photos</h2>
          <div style={{ fontSize: 13, opacity: 0.8 }}>
            <span>
              Ad: <code>{adId}</code>
            </span>
            {' · '}
            <span>
              Status: <b>{ad?.status || '—'}</b>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to={`/ads/${adId}`} style={{ textDecoration: 'none' }}>
            ← Back to details
          </Link>

          <button
            type="button"
            onClick={onClickUpload}
            disabled={!canEdit || uploading || mutating}
            title={!canEdit ? 'Only owner can edit draft photos' : 'Upload photos'}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onPickFiles}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {!isOwner && <ErrorBox message="Only the owner can edit photos." />}

      {ad && !isDraft(ad.status) && <ErrorBox message="Photos can be edited only for drafts." />}

      {error && <ErrorBox message={hint ? `${error} — ${hint}` : error} />}

      <div style={{ display: 'grid', gap: 10 }}>
        {photos.length === 0 ? (
          <div style={{ opacity: 0.8 }}>
            No photos yet. {canEdit ? 'Upload the first one.' : ''}
          </div>
        ) : (
          photos.map((p, index) => {
            const src = getPreviewFilePath(p) || p.filePath;
            const canMutate = canEdit && !uploading && !mutating;

            return (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '96px 1fr auto',
                  alignItems: 'center',
                  gap: 12,
                  padding: 10,
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    width: 96,
                    height: 72,
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {src ? (
                    <img
                      src={src}
                      alt={`photo ${index + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                  ) : (
                    <span style={{ opacity: 0.7, fontSize: 12 }}>No preview</span>
                  )}
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <b>#{index + 1}</b>
                    <code style={{ opacity: 0.85 }}>{p.id}</code>
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.85 }}>
                    order: <b>{p.order}</b>
                    {p.createdAt ? (
                      <>
                        {' · '}
                        <span>{new Date(p.createdAt).toLocaleString()}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button type="button" disabled={!canMutate || index === 0} onClick={() => onMove(p.id, -1)}>
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={!canMutate || index === photos.length - 1}
                    onClick={() => onMove(p.id, 1)}
                  >
                    ↓
                  </button>
                  <button type="button" disabled={!canMutate} onClick={() => onDelete(p.id)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ fontSize: 12, opacity: 0.75 }}>
        Tip: reordering is optimistic — if backend rejects, the order is rolled back.
      </div>
    </div>
  );
}
