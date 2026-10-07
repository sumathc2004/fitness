import fs from 'node:fs/promises';
import path from 'node:path';
import { randomToken } from './crypto';

/**
 * File storage abstraction. `local` writes under apps/api/uploads (fine for one server / development).
 * To use Cloudinary or S3, implement StorageProvider and select it with STORAGE_PROVIDER — nothing else changes.
 */
export interface StoredFile {
  key: string;
  size: number;
}

export interface StorageProvider {
  readonly name: string;
  save(folder: string, originalName: string, data: Buffer): Promise<StoredFile>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  /** Absolute path for streaming (local provider only). */
  pathFor?(key: string): string;
}

const ROOT = path.resolve(process.env.STORAGE_DIR ?? path.resolve(__dirname, '../../uploads'));

class LocalStorage implements StorageProvider {
  readonly name = 'local';
  pathFor(key: string) {
    const full = path.resolve(ROOT, key);
    if (!full.startsWith(ROOT + path.sep)) throw new Error('Invalid storage key'); // path traversal guard
    return full;
  }
  async save(folder: string, originalName: string, data: Buffer): Promise<StoredFile> {
    const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8);
    const key = `${folder}/${Date.now()}-${randomToken(8)}${ext}`;
    const full = this.pathFor(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return { key, size: data.length };
  }
  read(key: string) {
    return fs.readFile(this.pathFor(key));
  }
  async remove(key: string) {
    await fs.rm(this.pathFor(key), { force: true });
  }
}

export const storage: StorageProvider = new LocalStorage();
export const STORAGE_ROOT = ROOT;
