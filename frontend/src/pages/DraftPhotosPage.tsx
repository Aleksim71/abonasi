// frontend/src/pages/DraftPhotosPage.tsx
import { useEffect, useMemo, useReducer, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError } from '../api/http';
import * as PhotosApi from '../api/photos.api';
import { useAuth } from '../store/auth.store';
import { ErrorBox } from '../ui/ErrorBox';

import {
  draftPhotosReducer,
  initialDraftPhotosState,
  type UploadItem,
  type ServerPhoto
} from './draftPhotos.state';

// -----------------------------
// Safe helpers (do not trust API shape)
// -----------------------------
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return '';
}

function getPhotoId(candidate: unknown): string {
  if (!isRecord(candidate)) return '';
  return pickString(candidate, ['id', 'photoId', 'uuid', 'key']);
}

function getPhotoSrc(candidate: unknown): string {
  if (!isRecord(candidate)) return '';
  return pickString(candidate, ['url', 'src', 'imageUrl', 'publicUrl', 'path', 'filename']);
}

function makeLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `local_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toUserMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message || 'Upload failed';
  if (err instanceof Error) return err.message;
  return 'Upload failed';
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

function extractFirstPhotoFromResponse(res: unknown): unknown {
  // Accept shapes:
  // - { photo: {...} }
  // - { photos: [...] }
  // - { items: [...] }
  // - [...]
  if (Array.isArray(res)) return res[0];

  if (isRecord(res)) {
    if (res.photo) return res.photo;

    const photos = res.photos;
    if (Array.isArray(photos)) return photos[0];

    const items = res.items;
    if (Array.isArray(items)) return items[0];
  }

  return undefined;
}

export function DraftPhotosPage() {
  const { id } = useParams();
  const adId = String(id ?? '').trim();

  const auth = useAuth() as unknown;
  const token = (isRecord(auth) && typeof auth.token === 'string' ? auth.token : undefined) ?? undefined;

  const [state, dispatch] = useReducer(draftPhotosReducer, initialDraftPhotosState);

  // Keep a registry of object URLs for cleanup
  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  const canUpload = useMemo(() => Boolean(adId) && Boolean(token), [adId, token]);

  useEffect(() => {
    const map = objectUrlsRef.current;
    return () => {
      for (const url of map.values()) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }
      map.clear();
    };
  }, []);

  async function uploadOne(localId: string, file: File) {
    if (!canUpload || !token) return;

    dispatch({ type: 'START_UPLOAD', payload: { localId } });

    try {
      // Important trick: payload variable -> avoids excess-property error without "any"
      const payload: Parameters<typeof PhotosApi.uploadAdPhotosMultipart>[0] & {
        onUploadProgress?: (evt: unknown) => void;
      } = {
        adId,
        files: [file],
        token,
        onUploadProgress: (evt: unknown) => {
          // Axios-like: { loaded, total } or custom percent/progress
          if (typeof evt === 'number') {
            dispatch({ type: 'PROGRESS', payload: { localId, progress: clampPercent(evt) } });
            return;
          }

          if (isRecord(evt)) {
            const percent =
              typeof evt.percent === 'number'
                ? evt.percent
                : typeof evt.progress === 'number'
                  ? evt.progress
                  : typeof evt.loaded === 'number' && typeof evt.total === 'number' && evt.total > 0
                    ? (evt.loaded / evt.total) * 100
                    : 0;

            dispatch({ type: 'PROGRESS', payload: { localId, progress: clampPercent(percent) } });
          }
        }
      };

      const res = await PhotosApi.uploadAdPhotosMultipart(payload);

      const candidate = extractFirstPhotoFromResponse(res);

      const serverPhoto: ServerPhoto = {
        id: getPhotoId(candidate),
        url: getPhotoSrc(candidate)
      };

      if (!serverPhoto.id || !serverPhoto.url) {
        throw new Error('Upload succeeded but server returned an unexpected photo payload');
      }

      dispatch({ type: 'UPLOAD_SUCCESS', payload: { localId, serverPhoto } });
    } catch (e) {
      dispatch({ type: 'UPLOAD_ERROR', payload: { localId, message: toUserMessage(e) } });
    }
  }

  async function onFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;

    dispatch({ type: 'RESET_PAGE_ERROR' });

    const items: UploadItem[] = Array.from(files).map((file) => {
      const localId = makeLocalId();
      const previewUrl = URL.createObjectURL(file);
      objectUrlsRef.current.set(localId, previewUrl);

      return {
        localId,
        file,
        previewUrl,
        progress: 0,
        status: 'queued'
      };
    });

    dispatch({ type: 'ADD_FILES', payload: { items } });

    // Upload in parallel (per-file progress)
    await Promise.allSettled(items.map((it) => uploadOne(it.localId, it.file)));
  }

  function removeUpload(localId: string) {
    const url = objectUrlsRef.current.get(localId);
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
      objectUrlsRef.current.delete(localId);
    }
    dispatch({ type: 'REMOVE_UPLOAD', payload: { localId } });
  }

  function retryUpload(localId: string) {
    const item = state.uploads.find((u) => u.localId === localId);
    if (!item) return;
    void uploadOne(localId, item.file);
  }

  if (!adId) {
    return <ErrorBox title="Ошибка" message="Нет adId в URL (ожидался параметр :id)." />;
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: '0 0 12px' }}>Фото объявления</h1>

      {!token && <ErrorBox title="Нет доступа" message="Нужно войти в аккаунт, чтобы загружать фото." />}

      {state.pageError && <ErrorBox title="Ошибка" message={state.pageError} />}

      <div style={{ marginBottom: 12 }}>
        {/* IMPORTANT: input always in DOM for stable tests */}
        <input
          type="file"
          multiple
          accept="image/*"
          data-testid="photo-file"
          disabled={!canUpload}
          onChange={(e) => void onFilesSelected(e.target.files)}
        />
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {state.uploads.map((u) => (
          <div
            key={u.localId}
            style={{
              display: 'grid',
              gridTemplateColumns: '96px 1fr auto',
              alignItems: 'center',
              gap: 12,
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 10
            }}
          >
            <div
              style={{
                width: 96,
                height: 72,
                borderRadius: 6,
                overflow: 'hidden',
                background: '#f5f5f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img
                src={u.previewUrl}
                alt={u.file.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{u.file.name}</div>

              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {u.status === 'queued' && 'В очереди'}
                {u.status === 'uploading' && 'Загрузка...'}
                {u.status === 'success' && 'Загружено ✅'}
                {u.status === 'error' && `Ошибка: ${u.errorMessage ?? 'Upload failed'}`}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <progress value={u.progress} max={100} style={{ width: '100%' }} />
                <div style={{ width: 46, textAlign: 'right', fontSize: 12 }}>{Math.round(u.progress)}%</div>
              </div>

              {u.status === 'error' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => retryUpload(u.localId)} disabled={!canUpload}>
                    Retry
                  </button>
                  <button type="button" onClick={() => removeUpload(u.localId)}>
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div>
              <button type="button" onClick={() => removeUpload(u.localId)} disabled={u.status === 'uploading'}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {state.photos.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>Загруженные фото</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {state.photos.map((p) => (
              <div
                key={p.id}
                style={{
                  width: 120,
                  height: 90,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: state.coverPhotoId === p.id ? '2px solid #111' : '1px solid #ddd'
                }}
                title={state.coverPhotoId === p.id ? 'Cover' : undefined}
              >
                <img src={p.url} alt="uploaded" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
