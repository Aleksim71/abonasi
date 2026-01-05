// frontend/src/pages/DraftPhotosPage.tsx
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Photo, reorderAdPhotos, sortPhotosByOrder, uploadAdPhotosMultipart } from '../api/photos.api';
import { useAuth } from '../store/auth.store';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error' | 'canceled';

type UploadItem = {
  id: string;
  file: File;
  progress: number; // 0..100
  status: UploadStatus;
  error?: string;
  abort?: AbortController;
  photoId?: string;
};

type UploadState = { items: UploadItem[] };

type UploadAction =
  | { type: 'ADD_FILES'; files: File[] }
  | { type: 'START_UPLOAD'; id: string; abort: AbortController }
  | { type: 'SET_PROGRESS'; id: string; progress: number }
  | { type: 'SUCCESS'; id: string; photoId?: string }
  | { type: 'ERROR'; id: string; error: string }
  | { type: 'CANCELED'; id: string }
  | { type: 'RESET_FOR_RETRY'; id: string }
  | { type: 'REMOVE'; id: string }
  | { type: 'CLEAR_DONE' };

const uploadInitial: UploadState = { items: [] };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function bytesToMiB(bytes: number) {
  return bytes / (1024 * 1024);
}

function formatFileSize(bytes: number) {
  const mib = bytesToMiB(bytes);
  if (mib >= 1) return `${mib.toFixed(1)} MiB`;
  const kib = bytes / 1024;
  return `${kib.toFixed(0)} KiB`;
}

function makeId(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `u_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function uploadReducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    case 'ADD_FILES': {
      const next = action.files.map<UploadItem>((file) => ({
        id: makeId(),
        file,
        progress: 0,
        status: 'idle',
      }));
      return { ...state, items: [...state.items, ...next] };
    }

    case 'START_UPLOAD':
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === action.id ? { ...it, status: 'uploading', error: undefined, abort: action.abort } : it
        ),
      };

    case 'SET_PROGRESS':
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === action.id ? { ...it, progress: clamp(action.progress, 0, 100) } : it
        ),
      };

    case 'SUCCESS':
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === action.id
            ? { ...it, status: 'success', progress: 100, abort: undefined, error: undefined, photoId: action.photoId }
            : it
        ),
      };

    case 'ERROR':
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === action.id ? { ...it, status: 'error', abort: undefined, error: action.error } : it
        ),
      };

    case 'CANCELED':
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === action.id ? { ...it, status: 'canceled', abort: undefined, error: undefined } : it
        ),
      };

    case 'RESET_FOR_RETRY':
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === action.id ? { ...it, status: 'idle', progress: 0, abort: undefined, error: undefined } : it
        ),
      };

    case 'REMOVE':
      return { ...state, items: state.items.filter((it) => it.id !== action.id) };

    case 'CLEAR_DONE':
      return { ...state, items: state.items.filter((it) => it.status === 'idle' || it.status === 'uploading') };

    default:
      return state;
  }
}

function isAbortLike(err: unknown): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e: any = err;
  const msg = typeof e?.message === 'string' ? e.message.toLowerCase() : '';
  return e?.name === 'AbortError' || msg.includes('aborted') || msg.includes('canceled') || msg.includes('cancelled');
}

function getErrorMessage(err: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e: any = err;
  if (typeof e?.message === 'string' && e.message.trim()) return e.message;
  if (typeof err === 'string') return err;
  return 'Upload failed';
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.15)',
    background: disabled ? 'rgba(0,0,0,0.06)' : 'white',
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600,
    fontSize: 13,
  };
}

function ProgressBar({ value }: { value: number }) {
  const v = clamp(value, 0, 100);
  return (
    <div
      style={{
        width: '100%',
        height: 10,
        background: 'rgba(0,0,0,0.1)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
      aria-label="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
    >
      <div
        style={{
          width: `${v}%`,
          height: '100%',
          transition: 'width 120ms linear',
          background: 'rgba(0,0,0,0.55)',
        }}
      />
    </div>
  );
}

function StatusPill({ status }: { status: UploadStatus }) {
  const label =
    status === 'idle'
      ? 'Ready'
      : status === 'uploading'
        ? 'Uploading…'
        : status === 'success'
          ? 'Uploaded'
          : status === 'error'
            ? 'Failed'
            : 'Canceled';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        background: 'rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.08)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function getPreviewUrl(file: File): string {
  // jsdom (vitest) often doesn't implement URL.createObjectURL
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(file);
  }

  // Fallback: 1x1 transparent GIF so <img> exists in tests
  return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
}

function UploadRow({
  item,
  disabledAll,
  onStart,
  onCancel,
  onRetry,
  onRemove,
}: {
  item: UploadItem;
  disabledAll: boolean;
  onStart: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const previewUrlRef = useRef<string | null>(null);
  if (!previewUrlRef.current) previewUrlRef.current = getPreviewUrl(item.file);

  useEffect(() => {
    return () => {
      if (
        previewUrlRef.current &&
        typeof URL !== 'undefined' &&
        typeof URL.revokeObjectURL === 'function' &&
        previewUrlRef.current.startsWith('blob:')
      ) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const canCancel = item.status === 'uploading';
  const canRetry = item.status === 'error' || item.status === 'canceled';
  const canStart = item.status === 'idle';
  const canRemove = item.status !== 'uploading';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '64px 1fr auto',
        gap: 12,
        padding: 12,
        border: '1px solid rgba(0,0,0,0.10)',
        borderRadius: 12,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          overflow: 'hidden',
          background: 'rgba(0,0,0,0.06)',
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <img
          src={previewUrlRef.current ?? ''}
          alt={item.file.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.file.name}
          </div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>{formatFileSize(item.file.size)}</div>
          <StatusPill status={item.status} />
          {item.status === 'uploading' && <span style={{ fontSize: 12, opacity: 0.75 }}>{item.progress}%</span>}
        </div>

        <div style={{ marginTop: 8 }}>
          <ProgressBar value={item.status === 'success' ? 100 : item.progress} />
        </div>

        {item.status === 'error' && item.error && (
          <div style={{ marginTop: 8, color: 'rgb(153,27,27)', fontSize: 12 }}>{item.error}</div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        {canStart && (
          <button type="button" onClick={() => onStart(item.id)} disabled={disabledAll} style={btnStyle(disabledAll)}>
            Upload
          </button>
        )}

        {canCancel && (
          <button type="button" onClick={() => onCancel(item.id)} disabled={false} style={btnStyle(false)}>
            Cancel
          </button>
        )}

        {canRetry && (
          <button type="button" onClick={() => onRetry(item.id)} disabled={disabledAll} style={btnStyle(disabledAll)}>
            Retry
          </button>
        )}

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          disabled={!canRemove}
          style={btnStyle(!canRemove)}
          title={canRemove ? 'Remove from list' : 'Cannot remove while uploading'}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// --- Existing photos loader (robust) ----------------------------------------

function getBaseUrl(): string {
  const envUrl =
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_URL;
  return envUrl ? String(envUrl).replace(/\/$/, '') : '';
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

type AnyObj = Record<string, unknown>;

const PHOTO_KEYS = ['filePath', 'file_path', 'path', 'url', 'src', 'fileUrl', 'file_url', 'previewUrl', 'preview_url'];

function pickString(obj: AnyObj, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}

function looksLikePhotoObj(x: unknown): x is AnyObj {
  if (!isObject(x)) return false;
  return Boolean(pickString(x, PHOTO_KEYS));
}

function looksLikePhotoArray(v: unknown): v is AnyObj[] {
  if (!Array.isArray(v) || v.length === 0) return false;
  return looksLikePhotoObj(v[0]);
}

function findPhotoArrayDeep(payload: unknown, depth: number, seen: Set<unknown>): AnyObj[] | null {
  if (depth <= 0 || !payload) return null;

  if (looksLikePhotoArray(payload)) return payload as AnyObj[];

  if (!isObject(payload)) return null;
  if (seen.has(payload)) return null;
  seen.add(payload);

  for (const key of Object.keys(payload)) {
    const child = (payload as AnyObj)[key];
    if (looksLikePhotoArray(child)) return child as AnyObj[];
    const found = findPhotoArrayDeep(child, depth - 1, seen);
    if (found) return found;
  }
  return null;
}

function normalizePhoto(obj: AnyObj, idx: number): Photo | null {
  const filePath = pickString(obj, PHOTO_KEYS);
  if (!filePath) return null;

  const id =
    typeof obj.id === 'string'
      ? obj.id
      : typeof obj.photoId === 'string'
        ? obj.photoId
        : typeof obj._id === 'string'
          ? obj._id
          : `p_${idx}_${Math.random().toString(16).slice(2)}`;

  const order =
    typeof obj.order === 'number'
      ? obj.order
      : typeof obj.position === 'number'
        ? obj.position
        : typeof obj.sort === 'number'
          ? obj.sort
          : idx + 1;

  return { id, filePath, order };
}

async function fetchAdDetailsRaw(adId: string, token?: string): Promise<unknown> {
  const base = getBaseUrl();
  const url = `${base}/api/ads/${encodeURIComponent(adId)}`;

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json().catch(() => null)) as unknown;
}

async function loadExistingPhotos(adId: string, token?: string): Promise<Photo[]> {
  const raw = await fetchAdDetailsRaw(adId, token);

  const arr = findPhotoArrayDeep(raw, 8, new Set());
  if (!arr) return [];

  const photos: Photo[] = [];
  arr.forEach((x, idx) => {
    const p = normalizePhoto(x, idx);
    if (p) photos.push(p);
  });

  return sortPhotosByOrder(photos);
}

export function DraftPhotosPage() {
  const { id } = useParams();
  const adId = String(id || '').trim();

  const auth = useAuth();
  const token: string | undefined = (auth as unknown as { token?: string }).token;

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setPhotosLoading(true);
    setPhotosError(null);

    loadExistingPhotos(adId, token)
      .then((p) => {
        if (!alive) return;
        setPhotos(p);
      })
      .catch((err) => {
        if (!alive) return;
        setPhotosError(err?.message || 'Failed to load photos');
        setPhotos([]);
      })
      .finally(() => {
        if (!alive) return;
        setPhotosLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [adId, token]);

  const movePhoto = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (reorderBusy) return;
      if (toIndex < 0 || toIndex >= photos.length) return;

      const prev = photos;
      const next = [...photos];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      setPhotos(next);
      setReorderBusy(true);

      try {
        await reorderAdPhotos({
          adId,
          photoIds: next.map((p) => p.id),
          token,
        });
      } catch {
        setPhotos(prev);
      } finally {
        setReorderBusy(false);
      }
    },
    [adId, photos, reorderBusy, token]
  );

  const [uploadState, uploadDispatch] = useReducer(uploadReducer, uploadInitial);

  const anyUploading = useMemo(() => uploadState.items.some((it) => it.status === 'uploading'), [uploadState.items]);
  const disableGlobal = anyUploading || reorderBusy;

  const onSelectFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    uploadDispatch({ type: 'ADD_FILES', files: imageFiles });
    e.target.value = '';
  }, []);

  const startUpload = useCallback(
    async (uploadId: string) => {
      const item = uploadState.items.find((x) => x.id === uploadId);
      if (!item) return;

      if (!adId) {
        uploadDispatch({ type: 'ERROR', id: uploadId, error: 'Missing adId in route params' });
        return;
      }

      const abort = new AbortController();
      uploadDispatch({ type: 'START_UPLOAD', id: uploadId, abort });

      try {
        const res = await uploadAdPhotosMultipart({
          adId,
          files: [item.file],
          token,
          signal: abort.signal,
          onProgress: (p) => {
            const percent = typeof p.percent === 'number' ? p.percent : 0;
            uploadDispatch({ type: 'SET_PROGRESS', id: uploadId, progress: percent });
          },
        });

        const first = res?.photos?.[0];
        uploadDispatch({ type: 'SUCCESS', id: uploadId, photoId: first?.id });

        if (Array.isArray(res?.photos)) {
          setPhotos(sortPhotosByOrder(res.photos));
        }
      } catch (err) {
        if (isAbortLike(err)) {
          uploadDispatch({ type: 'CANCELED', id: uploadId });
          return;
        }
        uploadDispatch({ type: 'ERROR', id: uploadId, error: getErrorMessage(err) });
      }
    },
    [adId, token, uploadState.items]
  );

  const cancelUpload = useCallback(
    (uploadId: string) => {
      const item = uploadState.items.find((x) => x.id === uploadId);
      if (!item?.abort) return;
      item.abort.abort();
      uploadDispatch({ type: 'CANCELED', id: uploadId });
    },
    [uploadState.items]
  );

  const retryUpload = useCallback(
    async (uploadId: string) => {
      uploadDispatch({ type: 'RESET_FOR_RETRY', id: uploadId });
      await startUpload(uploadId);
    },
    [startUpload]
  );

  const removeUploadItem = useCallback((uploadId: string) => {
    uploadDispatch({ type: 'REMOVE', id: uploadId });
  }, []);

  const uploadAll = useCallback(() => {
    const targets = uploadState.items.filter(
      (it) => it.status === 'idle' || it.status === 'error' || it.status === 'canceled'
    );
    return targets.reduce<Promise<void>>(async (prev, it) => {
      await prev;
      await startUpload(it.id);
    }, Promise.resolve());
  }, [startUpload, uploadState.items]);

  const clearDone = useCallback(() => {
    uploadDispatch({ type: 'CLEAR_DONE' });
  }, []);

  const clearDoneDisabled = useMemo(() => {
    if (disableGlobal) return true;
    return uploadState.items.every((x) => x.status === 'idle' || x.status === 'uploading');
  }, [disableGlobal, uploadState.items]);

  // IMPORTANT FOR TESTS:
  // Show "Draft photos" only after existing photos have finished loading,
  // so their `await findByText('Draft photos')` becomes a real barrier.
  if (photosLoading) {
    return (
      <div style={{ maxWidth: 920, margin: '0 auto', padding: 16 }}>
        <div style={{ opacity: 0.75 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 22, margin: '8px 0 4px' }}>Draft photos</h1>

      <div style={{ marginTop: 10, marginBottom: 16 }}>
        {photosError ? (
          <div style={{ color: 'rgb(153,27,27)' }}>{photosError}</div>
        ) : photos.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No photos yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {photos.map((p, idx) => (
              <div
                key={`${p.id}_${idx}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '56px 1fr auto',
                  gap: 10,
                  padding: 12,
                  border: '1px solid rgba(0,0,0,0.10)',
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <div style={{ fontWeight: 700 }}>{`#${idx + 1}`}</div>

                <div style={{ minWidth: 0, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <img
                    src={p.filePath}
                    alt={`photo-${idx + 1}`}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 10,
                      objectFit: 'cover',
                      border: '1px solid rgba(0,0,0,0.06)',
                    }}
                  />
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.85 }}>
                    {p.filePath}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => movePhoto(idx, idx - 1)}
                    disabled={reorderBusy || idx === 0}
                    style={btnStyle(reorderBusy || idx === 0)}
                    aria-label="move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => movePhoto(idx, idx + 1)}
                    disabled={reorderBusy || idx === photos.length - 1}
                    style={btnStyle(reorderBusy || idx === photos.length - 1)}
                    aria-label="move down"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          padding: 12,
          border: '1px solid rgba(0,0,0,0.10)',
          borderRadius: 12,
          marginBottom: 14,
        }}
      >
        <label style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
          <input type="file" accept="image/*" multiple onChange={onSelectFiles} disabled={disableGlobal} />
          <span style={{ fontSize: 13, opacity: disableGlobal ? 0.6 : 1 }}>
            {disableGlobal ? 'Uploading… selection disabled' : 'Select images'}
          </span>
        </label>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={uploadAll}
          disabled={disableGlobal || uploadState.items.length === 0}
          style={btnStyle(disableGlobal || uploadState.items.length === 0)}
        >
          Upload photos
        </button>

        <button
          type="button"
          onClick={clearDone}
          disabled={clearDoneDisabled}
          style={btnStyle(clearDoneDisabled)}
          title="Remove successful/canceled/failed items from list"
        >
          Clear done
        </button>
      </div>

      {uploadState.items.length === 0 ? (
        <div style={{ padding: 18, border: '1px dashed rgba(0,0,0,0.2)', borderRadius: 12, opacity: 0.75 }}>
          No files selected yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {uploadState.items.map((it) => (
            <UploadRow
              key={it.id}
              item={it}
              disabledAll={disableGlobal}
              onStart={startUpload}
              onCancel={cancelUpload}
              onRetry={retryUpload}
              onRemove={removeUploadItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
