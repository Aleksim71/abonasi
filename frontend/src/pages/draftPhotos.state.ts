// frontend/src/pages/draftPhotos.state.ts
// Чистая логика стейта: reducer + утилиты (без JSX)

export type UploadStatus = 'queued' | 'uploading' | 'success' | 'error' | 'canceled';

export type UploadItem = {
  localId: string;
  file: File;
  previewUrl: string;
  progress: number; // 0..100
  status: UploadStatus;
  errorMessage?: string;
  serverPhotoId?: string;
  serverUrl?: string;
};

export type ServerPhoto = {
  id: string;
  url: string;
};

export type DraftPhotosUiState = {
  uploads: UploadItem[];
  photos: ServerPhoto[];
  coverPhotoId: string | null;
  isUploading: boolean;
  pageError?: string;
};

export type DraftPhotosAction =
  | { type: 'ADD_FILES'; payload: { items: UploadItem[] } }
  | { type: 'START_UPLOAD'; payload: { localId: string } }
  | { type: 'PROGRESS'; payload: { localId: string; progress: number } }
  | { type: 'UPLOAD_SUCCESS'; payload: { localId: string; serverPhoto: ServerPhoto } }
  | { type: 'UPLOAD_ERROR'; payload: { localId: string; message: string } }
  | { type: 'REMOVE_UPLOAD'; payload: { localId: string } }
  | { type: 'SET_COVER'; payload: { photoId: string | null } }
  | { type: 'SET_PAGE_ERROR'; payload: { message: string } }
  | { type: 'RESET_PAGE_ERROR' };

export const initialDraftPhotosState: DraftPhotosUiState = {
  uploads: [],
  photos: [],
  coverPhotoId: null,
  isUploading: false,
  pageError: undefined
};

// --------------------------------------------------
// helpers (pure)
// --------------------------------------------------

function clampProgress(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

function updateUploadById(
  uploads: UploadItem[],
  localId: string,
  patch: (u: UploadItem) => UploadItem
): UploadItem[] {
  const idx = uploads.findIndex((u) => u.localId === localId);
  if (idx === -1) return uploads;
  const next = uploads.slice();
  next[idx] = patch(next[idx]);
  return next;
}

function removeUploadById(uploads: UploadItem[], localId: string) {
  const idx = uploads.findIndex((u) => u.localId === localId);
  if (idx === -1) return uploads;
  const next = uploads.slice();
  next.splice(idx, 1);
  return next;
}

function upsertPhoto(photos: ServerPhoto[], photo: ServerPhoto): ServerPhoto[] {
  const idx = photos.findIndex((p) => p.id === photo.id);
  if (idx === -1) return [...photos, photo];
  const next = photos.slice();
  next[idx] = photo;
  return next;
}

function ensureCoverStillValid(photos: ServerPhoto[], coverPhotoId: string | null) {
  if (!coverPhotoId) return null;
  const exists = photos.some((p) => p.id === coverPhotoId);
  return exists ? coverPhotoId : (photos[0]?.id ?? null);
}

function computeIsUploading(uploads: UploadItem[]) {
  return uploads.some((u) => u.status === 'queued' || u.status === 'uploading');
}

// --------------------------------------------------
// reducer
// --------------------------------------------------

export function draftPhotosReducer(
  state: DraftPhotosUiState,
  action: DraftPhotosAction
): DraftPhotosUiState {
  switch (action.type) {
    case 'ADD_FILES': {
      const uploads = [...state.uploads, ...action.payload.items].map((u) => ({
        ...u,
        progress: clampProgress(u.progress ?? 0),
        status: u.status ?? 'queued'
      }));

      return {
        ...state,
        uploads,
        isUploading: computeIsUploading(uploads)
      };
    }

    case 'START_UPLOAD': {
      // ✅ ключевой фикс для Retry:
      // сбрасываем прогресс, ошибку и прошлый server-результат
      const uploads = updateUploadById(state.uploads, action.payload.localId, (u) => ({
        ...u,
        status: 'uploading',
        progress: 0,
        errorMessage: undefined,
        serverPhotoId: undefined,
        serverUrl: undefined
      }));

      return {
        ...state,
        uploads,
        isUploading: computeIsUploading(uploads)
      };
    }

    case 'PROGRESS': {
      const uploads = updateUploadById(
        state.uploads,
        action.payload.localId,
        (u) => {
          if (u.status !== 'uploading' && u.status !== 'queued') return u;
          return { ...u, progress: clampProgress(action.payload.progress) };
        }
      );

      return {
        ...state,
        uploads,
        isUploading: computeIsUploading(uploads)
      };
    }

    case 'UPLOAD_SUCCESS': {
      const uploads = updateUploadById(
        state.uploads,
        action.payload.localId,
        (u) => ({
          ...u,
          status: 'success',
          progress: 100,
          errorMessage: undefined,
          serverPhotoId: action.payload.serverPhoto.id,
          serverUrl: action.payload.serverPhoto.url
        })
      );

      const photos = upsertPhoto(state.photos, action.payload.serverPhoto);
      const coverPhotoId = state.coverPhotoId ?? (photos[0]?.id ?? null);

      return {
        ...state,
        uploads,
        photos,
        coverPhotoId,
        isUploading: computeIsUploading(uploads)
      };
    }

    case 'UPLOAD_ERROR': {
      const uploads = updateUploadById(
        state.uploads,
        action.payload.localId,
        (u) => ({
          ...u,
          status: 'error',
          // прогресс не откатываем назад, но и не форсим 0
          errorMessage: action.payload.message || 'Upload failed'
        })
      );

      return {
        ...state,
        uploads,
        isUploading: computeIsUploading(uploads)
      };
    }

    case 'REMOVE_UPLOAD': {
      const uploads = removeUploadById(state.uploads, action.payload.localId);
      return {
        ...state,
        uploads,
        isUploading: computeIsUploading(uploads)
      };
    }

    case 'SET_COVER': {
      const nextCover = action.payload.photoId;
      const coverPhotoId =
        nextCover === null
          ? null
          : state.photos.some((p) => p.id === nextCover)
            ? nextCover
            : state.coverPhotoId;

      return { ...state, coverPhotoId };
    }

    case 'SET_PAGE_ERROR':
      return { ...state, pageError: action.payload.message };

    case 'RESET_PAGE_ERROR':
      return { ...state, pageError: undefined };

    default:
      return state;
  }
}

// --------------------------------------------------
// selectors
// --------------------------------------------------

export function selectUploads(state: DraftPhotosUiState) {
  return state.uploads;
}

export function selectPhotos(state: DraftPhotosUiState) {
  return state.photos;
}

export function selectCover(state: DraftPhotosUiState) {
  if (!state.coverPhotoId) return null;
  return state.photos.find((p) => p.id === state.coverPhotoId) || null;
}

export function normalizeCoverAfterPhotosChange(
  state: DraftPhotosUiState
): DraftPhotosUiState {
  const coverPhotoId = ensureCoverStillValid(
    state.photos,
    state.coverPhotoId
  );
  if (coverPhotoId === state.coverPhotoId) return state;
  return { ...state, coverPhotoId };
}
