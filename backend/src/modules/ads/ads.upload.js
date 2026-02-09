'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');

function isUuid(v) {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function safeName(original) {
  const base = String(original || 'file')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);

  const ext = path.extname(base).slice(0, 12) || '.jpg';
  const stem = path.basename(base, path.extname(base)) || 'photo';

  return { stem, ext };
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function createPhotosUploader() {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const adId = String(req.params.id || '').trim();
      const root = path.join(__dirname, '../../public/uploads');
      const folder = isUuid(adId) ? path.join(root, 'ads', adId) : path.join(root, 'ads', 'unknown');
      try {
        ensureDir(folder);
        cb(null, folder);
      } catch (e) {
        cb(e, folder);
      }
    },
    filename: (req, file, cb) => {
      const { stem, ext } = safeName(file.originalname);
      const stamp = Date.now();
      const rnd = Math.random().toString(16).slice(2, 10);
      cb(null, `${stem}_${stamp}_${rnd}${ext}`);
    }
  });

  return multer({
    storage,
    limits: {
      files: 12,
      fileSize: 8 * 1024 * 1024 // 8MB per file
    },
    fileFilter: (req, file, cb) => {
      const mime = String(file.mimetype || '');
      if (mime.startsWith('image/')) return cb(null, true);
      cb(new Error('Only image/* files are allowed'));
    }
  });
}

/**
 * Run multer only for multipart/form-data.
 * Keeps JSON {filePath} route working.
 */
function maybeUploadPhotos(req, res, next) {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.includes('multipart/form-data')) return next();

  const uploader = createPhotosUploader().array('photos', 12);
  uploader(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: err.message || 'Upload failed'
      });
    }
    return next();
  });
}

module.exports = { maybeUploadPhotos };
