// frontend/src/pages/DraftPhotosPage.tsx
import React, { useEffect, useMemo, useReducer, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError } from '../api/http';
import * as PhotosApi from '../api/photos.api';
import { useAuth } from '../store/auth.store';
import { ErrorBox } from '../ui/ErrorBox';
import { createDraftPhotosOrderPersister } from './draftPhotos.persistOrder';
import './draftPhotos.reorderFeedback.css';
import {
  draftPhotosReducer,
  initialDraftPhotosState,
  type UploadItem,
  type ServerPhoto
} from './draftPhotos.state';

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

  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  const canUpload = useMemo(() => Boolean(adId) && Boolean(token), [adId, token]);

  // B2: UX around debounced persist order
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [orderSaveError, setOrderSaveError] = useState<string | null>(null);

  // B3.3: offline-aware UI
  const [waitingForOnline, setWaitingForOnline] = useState(false);

  // B4: compact "Saved ✓" indicator
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<number | null>(null);

  // B6: reorder micro-feedback (native drag'n'drop)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [settleIndex, setSettleIndex] = useState<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const triggerSettle = useCallback(
    (idx: number | null) => {
      clearSettleTimer();
      setSettleIndex(idx);
      if (idx === null) return;

      settleTimerRef.current = window.setTimeout(() => {
        setSettleIndex(null);
        settleTimerRef.current = null;
      }, 160);
    },
    [clearSettleTimer]
  );

  useEffect(() => {
    return () => clearSettleTimer();
  }, [clearSettleTimer]);

  // B4.2: strict priority refs to avoid "Saved" popping later
  const waitingForOnlineRef = useRef(false);
  const isSavingOrderRef = useRef(false);
  const orderSaveErrorRef = useRef<string | null>(null);

  useEffect(() => {
    waitingForOnlineRef.current = waitingForOnline;
  }, [waitingForOnline]);

  useEffect(() => {
    isSavingOrderRef.current = isSavingOrder;
  }, [isSavingOrder]);

  useEffect(() => {
    orderSaveErrorRef.current = orderSaveError;
  }, [orderSaveError]);

  const clearSavedTimer = useCallback(() => {
    if (savedTimerRef.current !== null) {
      window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
  }, []);

  const hideSavedIndicator = useCallback(() => {
    clearSavedTimer();
    setShowSaved(false);
  }, [clearSavedTimer]);

  const canShowSavedNow = useCallback(() => {
    // priority: waitingForOnline > saving > error > saved
    if (waitingForOnlineRef.current) return false;
    if (isSavingOrderRef.current) return false;
    if (orderSaveErrorRef.current) return false; // ✅ lint-friendly (no Boolean())
    return true;
  }, []);

  const showSavedIndicator = useCallback(() => {
    // B4.2: strict priority — if we can't show now, do NOT schedule it later
    if (!canShowSavedNow()) return;

    clearSavedTimer();
    setShowSaved(true);
    savedTimerRef.current = window.setTimeout(() => {
      setShowSaved(false);
      savedTimerRef.current = null;
    }, 1500);
  }, [canShowSavedNow, clearSavedTimer]);

  useEffect(() => {
    return () => {
      clearSavedTimer();
    };
  }, [clearSavedTimer]);

  const orderPersister = useMemo(() => {
    return createDraftPhotosOrderPersister(
      async (photoIds: string[]) => {
        if (!token) throw new Error('no token');

        // PersistOrderFn expects Promise<void>
        await PhotosApi.reorderAdPhotos({ adId, photoIds, token });
      },
      {
        debounceMs: 700,

        // If a new save starts, hide "Saved ✓" (calm priority)
        onSavingChange: (saving) => {
          setIsSavingOrder(saving);
          if (saving) hideSavedIndicator();
        },

        // If error appears, hide "Saved ✓"
        onError: (msg) => {
          setOrderSaveError(msg);
          if (msg) hideSavedIndicator();
        },

        // B4: event from persister (after success + race-guard)
        onSaved: () => {
          showSavedIndicator();
        },

        // B3.3: retry state for calm offline UX
        onRetryStateChange: (s) => {
          const isWaiting = s.kind === 'waitingForOnline';
          setWaitingForOnline(isWaiting);

          // When offline-waiting, hide the "error saving" UI.
          if (isWaiting) setOrderSaveError(null);

          // Offline banner has priority -> hide "Saved ✓"
          if (isWaiting) hideSavedIndicator();
        }
      }
    );
  }, [adId, token, hideSavedIndicator, showSavedIndicator]);

  useEffect(() => {
    return () => orderPersister.cancel();
  }, [orderPersister]);

  // schedule persist when order changes (only server photos)
  const orderKey = useMemo(() => state.photos.map((p) => p.id).join('|'), [state.photos]);

  useEffect(() => {
    const ids = state.photos.map((p) => p.id).filter(Boolean);
    if (ids.length >= 2) orderPersister.schedule(ids);
  }, [orderKey, orderPersister, state.photos]);

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
      const payload: Parameters<typeof PhotosApi.uploadAdPhotosMultipart>[0] & {
        onUploadProgress?: (evt: unknown) => void;
      } = {
        adId,
        files: [file],
        token,
        onUploadProgress: (evt: unknown) => {
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

  function setCover(photoId: string) {
    dispatch({ type: 'SET_COVER', payload: { photoId } });
  }

  function movePhoto(fromIndex: number, toIndex: number) {
    // B4: any new reorder hides Saved immediately
    hideSavedIndicator();

    // optimistic UX: any new reorder hides previous error
    setOrderSaveError(null);
    // also clear calm offline banner on new reorder attempt
    setWaitingForOnline(false);
    dispatch({ type: 'MOVE_PHOTO', payload: { fromIndex, toIndex } });
  }

  // HTML5 DnD (optional in tests; kept for real UX)
  function onDragStart(e: React.DragEvent<HTMLDivElement>, fromIndex: number) {
    // B6: start micro-feedback
    setDraggingIndex(fromIndex);
    setDropTargetIndex(fromIndex);

    // New reorder should immediately clear old UI states
    hideSavedIndicator();
    setOrderSaveError(null);
    setWaitingForOnline(false);

    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(fromIndex));
    } catch {
      // ignore
    }
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // B6: update drop target (closest card)
    const el = (e.target as HTMLElement | null)?.closest?.('[data-dp-index]') as HTMLElement | null;
    const raw = el?.dataset?.dpIndex ?? '';
    const idx = Number(raw);

    if (Number.isFinite(idx) && idx >= 0) {
      setDropTargetIndex(idx);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>, toIndex: number) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    const fromIndex = Number(raw);
    if (!Number.isFinite(fromIndex)) return;

    // settle feedback on target
    triggerSettle(toIndex);

    movePhoto(fromIndex, toIndex);

    // end drag state
    setDraggingIndex(null);
    setDropTargetIndex(null);
  }

  function onDragEnd() {
    // if drag ends without drop, still clear states
    triggerSettle(dropTargetIndex);

    setDraggingIndex(null);
    setDropTargetIndex(null);
  }

  if (!adId) {
    return <ErrorBox title="Ошибка" message="Нет adId в URL (ожидался параметр :id)." />;
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: '0 0 12px' }}>Фото объявления</h1>

      {!token && <ErrorBox title="Нет доступа" message="Нужно войти в аккаунт, чтобы загружать фото." />}

      {state.pageError && <ErrorBox title="Ошибка" message={state.pageError} />}

      {/* B3.3: calm offline message has priority over saving */}
      {waitingForOnline && (
        <div data-testid="waiting-for-online" style={{ marginBottom: 10, fontSize: 12, opacity: 0.85 }}>
          Нет сети — сохраним при появлении соединения.
        </div>
      )}

      {/* B4: Saved ✓ (priority: only when no higher-priority status is shown) */}
      {showSaved && !waitingForOnline && !isSavingOrder && !orderSaveError && (
        <div data-testid="order-saved" style={{ marginBottom: 10, fontSize: 12, opacity: 0.85 }}>
          ✓ Saved
        </div>
      )}

      {/* B2: saving / error / retry */}
      {isSavingOrder && !waitingForOnline && (
        <div data-testid="saving-indicator" style={{ marginBottom: 10, fontSize: 12, opacity: 0.85 }}>
          Сохраняю порядок…
        </div>
      )}

      {/* When waitingForOnline, hide error+retry completely (polish) */}
      {orderSaveError && !isSavingOrder && !waitingForOnline && (
        <div data-testid="order-save-error" style={{ marginBottom: 10 }}>
          <ErrorBox title="Не удалось сохранить порядок" message={orderSaveError} />
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              data-testid="persist-order-retry"
              onClick={() => {
                const started = orderPersister.retryNow();
                if (!started) setOrderSaveError(null);
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
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

          <div data-testid="server-photos" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {state.photos.map((p, idx) => {
              const isCover = state.coverPhotoId === p.id;

              const classes = [
                'dp-item',
                draggingIndex === idx ? 'is-dragging' : '',
                dropTargetIndex === idx && draggingIndex !== null && draggingIndex !== idx ? 'is-drop-target' : '',
                settleIndex === idx ? 'is-settling' : ''
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div
                  key={p.id}
                  data-testid={`server-photo-${p.id}`}
                  data-photo-id={p.id}
                  data-dp-index={idx}
                  draggable
                  onDragStart={(e) => onDragStart(e, idx)}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, idx)}
                  onDragEnd={onDragEnd}
                  className={classes}
                  style={{
                    width: 160,
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: isCover ? '2px solid #111' : '1px solid #ddd',
                    background: '#fff'
                  }}
                >
                  <div style={{ position: 'relative', width: '100%', height: 90 }}>
                    <img
                      src={p.url}
                      alt="uploaded"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />

                    {isCover && (
                      <span
                        data-testid="cover-badge"
                        style={{
                          position: 'absolute',
                          top: 6,
                          left: 6,
                          background: '#111',
                          color: '#fff',
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 999
                        }}
                      >
                        Cover
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gap: 6, padding: 8 }}>
                    <button
                      type="button"
                      onClick={() => setCover(p.id)}
                      disabled={isCover}
                      style={{ width: '100%' }}
                    >
                      {isCover ? 'Cover' : 'Make cover'}
                    </button>

                    {/* fallback controls used in tests */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        aria-label={`Move photo ${idx} up`}
                        data-testid={`move-up-${p.id}`}
                        onClick={() => movePhoto(idx, idx - 1)}
                        disabled={idx === 0}
                        style={{ width: '100%' }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move photo ${idx} down`}
                        data-testid={`move-down-${p.id}`}
                        onClick={() => movePhoto(idx, idx + 1)}
                        disabled={idx === state.photos.length - 1}
                        style={{ width: '100%' }}
                      >
                        ↓
                      </button>
                    </div>

                    <div style={{ fontSize: 11, opacity: 0.65 }}>Drag to reorder</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            Можно перетаскивать карточки для reorder. В тестах reorder проверяем через кнопки ↑↓.
          </div>
        </div>
      )}
    </div>
  );
}
