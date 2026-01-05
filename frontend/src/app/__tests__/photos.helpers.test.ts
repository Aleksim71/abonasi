import { describe, it, expect } from 'vitest';
import { getPreviewFilePath, sortPhotosByOrder, type Photo } from '../../api/photos.api';

describe('photos.api helpers', () => {
  it('sortPhotosByOrder sorts ascending by order and does not mutate input', () => {
    const input: Photo[] = [
      { id: 'p2', filePath: '/p2.jpg', order: 2 },
      { id: 'p1', filePath: '/p1.jpg', order: 1 },
      { id: 'p3', filePath: '/p3.jpg', order: 3 },
    ];

    const out = sortPhotosByOrder(input);

    expect(out.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    // input unchanged
    expect(input.map((p) => p.id)).toEqual(['p2', 'p1', 'p3']);
  });

  it('getPreviewFilePath returns string preview when previewPhoto is string', () => {
    const p: Photo = { id: 'p1', filePath: '/full.jpg', order: 1, previewPhoto: '/preview.jpg' };
    expect(getPreviewFilePath(p)).toBe('/preview.jpg');
  });

  it('getPreviewFilePath returns nested filePath when previewPhoto is object', () => {
    const p: Photo = {
      id: 'p1',
      filePath: '/full.jpg',
      order: 1,
      previewPhoto: { id: 'pp1', filePath: '/preview.jpg' },
    };
    expect(getPreviewFilePath(p)).toBe('/preview.jpg');
  });

  it('getPreviewFilePath returns null when previewPhoto is missing/invalid', () => {
    const p1: Photo = { id: 'p1', filePath: '/full.jpg', order: 1 };
    const p2: Photo = { id: 'p2', filePath: '/full.jpg', order: 1, previewPhoto: null };
    const p3 = {
  id: 'p3',
  filePath: '/full.jpg',
  order: 1,
  previewPhoto: {} as unknown,
} as Photo;


    expect(getPreviewFilePath(p1)).toBeNull();
    expect(getPreviewFilePath(p2)).toBeNull();
    expect(getPreviewFilePath(p3)).toBeNull();
  });
});
