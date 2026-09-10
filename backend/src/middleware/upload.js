// Multipart upload middleware for professional media (photos + videos).
// Buffers in memory (a media file is ≤ 200 Mo max, far below memory pressure
// for a single request) then delegates persistence to StorageService.

const multer = require("multer");
const { MAX_UPLOAD_BYTES } = require("../services/mediaService");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES }
});

module.exports = { upload };