// StorageService abstraction (req 26).
//
// The backend stores files for professional portfolios, verification
// documents, payment receipts and profile photos THROUGH this interface only.
// Controllers/services depend on the abstract `StorageService` — never on a
// concrete implementation — so the local backend can be swapped for S3,
// Cloudinary or Cloudflare R2 without touching controllers.
//
// Files are NEVER exposed publicly by default: stored URLs are treated as
// private identifiers and only returned through guarded endpoints.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");

const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

/**
 * StorageService interface.
 * @typedef {Object} StorageService
 * @property {(bucket: string, file: {originalname: string, mimetype: string, size: number, buffer?: Buffer, stream?: NodeJS.ReadableStream, path?: string}) => Promise<{url: string, key: string, mimeType: string, size: number}>} put
 * @property {(key: string) => Promise<{buffer: Buffer, mimeType: string}|null>} get
 * @property {(key: string) => Promise<boolean>} delete
 * @property {(key: string) => Promise<boolean>} exists
 */

function sanitizeFileName(name = "") {
  const ext = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, "");
  const base = path.basename(name, ext).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${base || "file"}${ext}`;
}

function makeKey(bucket, fileName) {
  return `${bucket}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}/${sanitizeFileName(fileName)}`;
}

// ── Local filesystem adapter (replacable by S3 / Cloudinary / R2) ───────────
class LocalStorage {
  constructor({ root = path.join(process.cwd(), "storage"), baseUrl = "/files" } = {}) {
    this.root = root;
    this.baseUrl = baseUrl;
  }

  _resolve(key) {
    const full = path.join(this.root, key);
    // Guard against path traversal — keys must stay inside the storage root.
    if (!full.startsWith(path.resolve(this.root))) {
      throw new Error("Invalid storage key");
    }
    return full;
  }

  async put(bucket, file) {
    const key = makeKey(bucket, file.originalname || "upload");
    const target = this._resolve(key);
    await mkdir(path.dirname(target), { recursive: true });

    if (file.buffer) {
      await writeFile(target, file.buffer);
    } else if (file.stream) {
      await new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(target);
        file.stream.pipe(ws).on("finish", resolve).on("error", reject);
      });
    } else if (file.path) {
      await mkdir(path.dirname(target), { recursive: true });
      fs.copyFileSync(file.path, target);
    } else {
      throw new Error("No file content provided.");
    }

    return {
      url: `${this.baseUrl}/${key}`,
      key,
      mimeType: file.mimetype || "application/octet-stream",
      size: file.size || 0
    };
  }

  async get(key) {
    const full = this._resolve(key);
    if (!fs.existsSync(full)) return null;
    const buffer = await readFile(full);
    return { buffer, mimeType: "application/octet-stream" };
  }

  async delete(key) {
    const full = this._resolve(key);
    if (!fs.existsSync(full)) return false;
    await unlink(full);
    return true;
  }

  async exists(key) {
    const full = this._resolve(key);
    return fs.existsSync(full);
  }
}

// Factory so callers ask for "a StorageService" and receive the configured one.
function createStorageService(opts) {
  // Production/config switch would select S3/R2/Cloudinary per env var;
  // local is the default and only implementation wired here.
  return new LocalStorage(opts);
}

module.exports = { createStorageService, LocalStorage, StorageService: LocalStorage };
