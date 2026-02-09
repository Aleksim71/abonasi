// frontend/src/pages/DraftPhotosPage.tsx
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError } from '../api/http';
import * as PhotosApi from '../api/photos.api';
import { useAuth } from '../store/auth.store';
import { ErrorBox } from '../ui/ErrorBox';
import { createDraftPhotosOrderPersister } from './draftPhotos.persistOrder';
import './draftPhotos.reorderFeedback.css';
import './draftPhotos.a11y.css';
import './draftPhotos.mobileReorder.css';
import './draftPhotos.page.css';
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

function getClosestDpIndex(target: EventTarget | null): number | null {
  const el = (target as HTMLElement | null)?.closest?.('[data-dp-index]') as HTMLElement | null;
  const raw = el?.dataset?.dpIndex ?? '';
  const idx = Number(raw);
  return Number.isFinite(idx) && idx >= 0 ? idx : null;
}

function getDpIndexFromPoint(clientX: number, clientY: number): number | null {
  // Vitest/jsdom tests typically stub document.elementFromPoint to support this logic.
  const el = document.elementFromPoint?.(clientX, clientY) as HTMLElement | null;
  if (!el) return null;

  const host = el.closest?.('[data-dp-index]') as HTMLElement | null;
  const raw = host?.dataset?.dpIndex ?? '';
  const idx = Number(raw);
  return Number.isFinite(idx) && idx >= 0 ? idx : null;
}

export function DraftPhotosPage() {
  const { id } = useParams();
  const adId = String(id ?? '').trim();

  const auth = useAuth() as unknown;
  const token = (isRecord(auth) && typeof auth.token === 'string' ? auth.token : undefined) ?? undefined;

  const [state, dispatch] = useReducer(draftPhotosReducer, initialDraftPhotosState);

  const objectUrlsRef = useRef<Map<string, string>>(new Map());
  const canUpload = useMemo(() => Boolean(adId) && Boolean(token), [adId, token]);

  // file input ref for CTA buttons (keep input in DOM for tests)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

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
  const dropTargetIndexRef = useRef<number | null>(null);
  const [settleIndex, setSettleIndex] = useState<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    dropTargetIndexRef.current = dropTargetIndex;
  }, [dropTargetIndex]);

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
    if (orderSaveErrorRef.current) return false;
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
        await PhotosApi.reorderAdPhotos({ adId, photoIds, token });
      },
      {
        debounceMs: 700,

        onSavingChange: (saving) => {
          setIsSavingOrder(saving);
          if (saving) hideSavedIndicator();
        },

        onError: (msg) => {
          setOrderSaveError(msg);
          if (msg) hideSavedIndicator();
        },

        onSaved: () => {
          showSavedIndicator();
        },

        onRetryStateChange: (s) => {
          const isWaiting = s.kind === 'waitingForOnline';
          setWaitingForOnline(isWaiting);

          if (isWaiting) setOrderSaveError(null);
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

  const uploadOne = useCallback(
    async (localId: string, file: File) => {
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
    },
    [adId, canUpload, token]
  );

  const onFilesSelected = useCallback(
    async (files: FileList | null) => {
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
    },
    [uploadOne]
  );

  const removeUpload = useCallback((localId: string) => {
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
  }, []);

  const retryUpload = useCallback(
    (localId: string) => {
      const item = state.uploads.find((u) => u.localId === localId);
      if (!item) return;
      void uploadOne(localId, item.file);
    },
    [state.uploads, uploadOne]
  );

  const setCover = useCallback((photoId: string) => {
    dispatch({ type: 'SET_COVER', payload: { photoId } });
  }, []);

  const movePhoto = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      // B4: any new reorder hides Saved immediately
      hideSavedIndicator();

      // optimistic UX: any new reorder hides previous error
      setOrderSaveError(null);
      // also clear calm offline banner on new reorder attempt
      setWaitingForOnline(false);

      dispatch({ type: 'MOVE_PHOTO', payload: { fromIndex, toIndex } });
    },
    [hideSavedIndicator]
  );

  // HTML5 DnD
  const onDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, fromIndex: number) => {
      setDraggingIndex(fromIndex);
      setDropTargetIndex(fromIndex);

      hideSavedIndicator();
      setOrderSaveError(null);
      setWaitingForOnline(false);

      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(fromIndex));
      } catch {
        // ignore
      }
    },
    [hideSavedIndicator]
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = 'move';
    } catch {
      // ignore
    }

    const idx = getClosestDpIndex(e.target);
    if (idx !== null) setDropTargetIndex(idx);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, toIndex: number) => {
      e.preventDefault();
      const raw = (() => {
        try {
          return e.dataTransfer.getData('text/plain');
        } catch {
          return '';
        }
      })();

      const fromIndex = Number(raw);
      if (!Number.isFinite(fromIndex)) return;

      triggerSettle(toIndex);
      movePhoto(fromIndex, toIndex);

      setDraggingIndex(null);
      setDropTargetIndex(null);
    },
    [movePhoto, triggerSettle]
  );

  const onDragEnd = useCallback(() => {
    triggerSettle(dropTargetIndexRef.current);

    setDraggingIndex(null);
    setDropTargetIndex(null);
  }, [triggerSettle]);

  // B8: touch long-press reorder (Pointer Events)
  const longPressMs = 350;
  const touchPressTimerRef = useRef<number | null>(null);
  const touchActiveRef = useRef(false);
  const touchFromIndexRef = useRef<number | null>(null);

  const clearTouchTimer = useCallback(() => {
    if (touchPressTimerRef.current !== null) {
      window.clearTimeout(touchPressTimerRef.current);
      touchPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearTouchTimer();
  }, [clearTouchTimer]);

  const startTouchReorder = useCallback(
    (fromIndex: number) => {
      touchActiveRef.current = true;
      touchFromIndexRef.current = fromIndex;

      setDraggingIndex(fromIndex);
      setDropTargetIndex(fromIndex);

      hideSavedIndicator();
      setOrderSaveError(null);
      setWaitingForOnline(false);
    },
    [hideSavedIndicator]
  );

  const endTouchReorder = useCallback(
    (toIndex: number | null) => {
      const fromIndex = touchFromIndexRef.current;

      if (touchActiveRef.current && fromIndex !== null && toIndex !== null) {
        triggerSettle(toIndex);
        movePhoto(fromIndex, toIndex);
      }

      touchActiveRef.current = false;
      touchFromIndexRef.current = null;

      setDraggingIndex(null);
      setDropTargetIndex(null);
    },
    [movePhoto, triggerSettle]
  );

  const onPointerDownCard = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, fromIndex: number) => {
      if (e.pointerType !== 'touch') return;

      try {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }

      clearTouchTimer();
      touchActiveRef.current = false;
      touchFromIndexRef.current = fromIndex;

      touchPressTimerRef.current = window.setTimeout(() => {
        touchPressTimerRef.current = null;
        startTouchReorder(fromIndex);
      }, longPressMs);
    },
    [clearTouchTimer, startTouchReorder]
  );

  const onPointerMoveCard = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    if (!touchActiveRef.current) return;

    const idx = getDpIndexFromPoint(e.clientX, e.clientY) ?? getClosestDpIndex(e.target);
    if (idx !== null) setDropTargetIndex(idx);
  }, []);

  const onPointerUpCard = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'touch') return;

      if (!touchActiveRef.current) {
        clearTouchTimer();
        touchFromIndexRef.current = null;
        return;
      }

      clearTouchTimer();

      const idx =
        getDpIndexFromPoint(e.clientX, e.clientY) ??
        getClosestDpIndex(e.target) ??
        dropTargetIndexRef.current;

      endTouchReorder(idx ?? null);
    },
    [clearTouchTimer, endTouchReorder]
  );

  const onPointerCancelCard = useCallback(() => {
    clearTouchTimer();

    if (touchActiveRef.current) {
      triggerSettle(dropTargetIndexRef.current);
      touchActiveRef.current = false;
      touchFromIndexRef.current = null;
      setDraggingIndex(null);
      setDropTargetIndex(null);
    }
  }, [clearTouchTimer, triggerSettle]);

  const moveDown = useCallback(
    (photoId: string) => {
      const fromIndex = state.photos.findIndex((p) => p.id === photoId);
      if (fromIndex < 0) return;
      const toIndex = Math.min(state.photos.length - 1, fromIndex + 1);
      movePhoto(fromIndex, toIndex);
    },
    [movePhoto, state.photos]
  );

  const moveUp = useCallback(
    (photoId: string) => {
      const fromIndex = state.photos.findIndex((p) => p.id === photoId);
      if (fromIndex < 0) return;
      const toIndex = Math.max(0, fromIndex - 1);
      movePhoto(fromIndex, toIndex);
    },
    [movePhoto, state.photos]
  );

  const hasAnyServerPhotos = state.photos.length > 0;
  const hasAnyUploads = state.uploads.length > 0;

  if (!adId) {
    return <ErrorBox title="Ошибка" message="Нет adId в URL (ожидался параметр :id)." />;
  }

  return (
    <div className="dp-page">
      <div className="dp-wrap">
        <div className="dp-container">
          <div className="dp-header">
            <div>
              <h1 className="dp-title">Фотографии</h1>
              <p className="dp-subtitle muted small">
                Добавьте фото — первое будет обложкой.
              </p>
            </div>

            <div className="dp-actions">
              <button type="button" className="btn" onClick={openFilePicker} disabled={!canUpload}>
                Добавить фото
              </button>
              <button type="button" className="btn" disabled>
                Опубликовать
              </button>
            </div>
          </div>

          {!token && <ErrorBox title="Нет доступа" message="Нужно войти в аккаунт, чтобы загружать фото." />}

          {state.pageError && <ErrorBox title="Ошибка" message={state.pageError} />}

          {waitingForOnline && (
            <div data-testid="waiting-for-online" className="dp-flash">
              Нет сети — сохраним при появлении соединения.
            </div>
          )}

          {showSaved && !waitingForOnline && !isSavingOrder && !orderSaveError && (
            <div data-testid="order-saved" className="dp-flash">
              Saved ✓
            </div>
          )}

          {isSavingOrder && !waitingForOnline && (
            <div data-testid="saving-indicator" className="dp-flash">
              Сохраняю порядок…
            </div>
          )}

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

          {/* Keep input in DOM always (tests rely on it); disable when no access */}
          <div className="dp-upload">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              data-testid="photo-file"
              disabled={!canUpload}
              onChange={(e) => void onFilesSelected(e.target.files)}
            />
            <div className="dp-upload__hint">Можно выбрать несколько файлов. Поддерживаются изображения.</div>
          </div>

          {!hasAnyServerPhotos && !hasAnyUploads && (
            <div className="card dp-empty">
              <div className="dp-empty__title">Фотографий пока нет</div>
              <div className="dp-empty__text muted">
                Добавьте хотя бы одно фото, чтобы продолжить.
              </div>
              <div style={{ marginTop: 12 }}>
                <button type="button" className="btn" onClick={openFilePicker} disabled={!canUpload}>
                  Добавить фото
                </button>
              </div>
            </div>
          )}

          {hasAnyUploads && (
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
                    <img src={u.previewUrl} alt={u.file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>

                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{u.file.name}</div>

                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {u.status === 'queued' && 'В очереди'}
                      {u.status === 'uploading' && 'Загрузка…'}
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
          )}

          {state.photos.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <h2 className="dp-sectionTitle">Загруженные фото</h2>

              <div data-testid="server-photos" className="dp-serverPhotos">
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
                      onPointerDown={(e) => onPointerDownCard(e, idx)}
                      onPointerMove={onPointerMoveCard}
                      onPointerUp={onPointerUpCard}
                      onPointerCancel={onPointerCancelCard}
                      className={classes}
                      style={{
                        width: 160,
                        borderRadius: 10,
                        overflow: 'hidden',
                        border: isCover ? '2px solid #111' : '1px solid #ddd',
                        background: '#fff',
                        touchAction: 'none'
                      }}
                    >
                      <div style={{ position: 'relative', width: '100%', height: 90 }}>
                        <img
                          src={p.url}
                          alt=""
                          style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }}
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
                        <button type="button" onClick={() => setCover(p.id)} disabled={isCover} style={{ width: '100%' }}>
                          {isCover ? 'Cover' : 'Make cover'}
                        </button>

                        {/* fallback reorder buttons for tests + accessibility */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <button
                            type="button"
                            data-testid={`move-up-${p.id}`}
                            onClick={() => moveUp(p.id)}
                            disabled={idx === 0}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            data-testid={`move-down-${p.id}`}
                            onClick={() => moveDown(p.id)}
                            disabled={idx === state.photos.length - 1}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                Mobile: long-press a photo, then drag to reorder.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
