import { useCallback, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { uploadAdPhotosMultipart, sortPhotosByOrder, Photo } from '../api/photos.api';
import { useAuth } from '../store/auth.store';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function extractUploadedPhotos(res: unknown): Photo[] {
  if (Array.isArray(res)) return res as Photo[];

  if (isRecord(res)) {
    const candidates = [
      res['photos'],
      res['items'],
      res['data'],
      isRecord(res['result']) ? res['result']['photos'] : undefined
    ];

    for (const c of candidates) {
      if (Array.isArray(c)) return c as Photo[];
    }
  }

  return [];
}

function getPhotoSrc(photo: Photo): string {
  const p = photo as unknown;
  if (!isRecord(p)) return '';

  const candidates = [p['url'], p['src'], p['path'], p['fileUrl'], p['imageUrl']];

  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }

  return '';
}

function getPhotoId(photo: Photo): string {
  const p = photo as unknown;
  if (!isRecord(p)) return String(Math.random());

  const id = p['id'];
  if (typeof id === 'string' && id) return id;

  // fallback to stable-ish key
  return getPhotoSrc(photo) || String(Math.random());
}

export function DraftPhotosPage() {
  const { id: adId } = useParams<{ id: string }>();
  const { token } = useAuth();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);

  const onUploadFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0 || !adId || !token) return;

      // ✅ API expects File[]
      const files = Array.from(fileList);

      setLoading(true);
      try {
        // ✅ API expects one argument: object
        const res = await uploadAdPhotosMultipart({ adId, files, token });

        const uploadedPhotos = extractUploadedPhotos(res);
        if (uploadedPhotos.length) {
          setPhotos(prev => sortPhotosByOrder([...prev, ...uploadedPhotos]));
        }
      } finally {
        setLoading(false);
      }
    },
    [adId, token]
  );

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      void onUploadFiles(e.target.files);
      // allow uploading same file again
      e.target.value = '';
    },
    [onUploadFiles]
  );

  const onClickUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div>
      <h1>Draft photos</h1>

      {/* IMPORTANT: always present in DOM for tests */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        data-testid="photo-file"
        onChange={onFileInputChange}
      />

      <button type="button" onClick={onClickUpload} disabled={loading}>
        Upload photo
      </button>

      <ul>
        {photos.map(photo => (
          <li key={getPhotoId(photo)}>
            <img src={getPhotoSrc(photo)} alt="" />
          </li>
        ))}
      </ul>
    </div>
  );
}
