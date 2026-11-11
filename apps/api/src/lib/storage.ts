import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import type { Response } from 'express';
import { randomToken } from './crypto';

/**
 * File storage abstraction, selected with STORAGE_PROVIDER:
 *   • `local` (default) writes under apps/api/uploads — fine for one long-running server / development.
 *   • `vercel-blob` stores files as *private* Vercel Blob objects (needs BLOB_READ_WRITE_TOKEN). Use it on Vercel,
 *     whose functions have no persistent disk. Files are only ever served through the API, so access checks still apply.
 * Keys look like `<folder>/<timestamp>-<random>.<ext>` for every provider.
 */
export interface StoredFile {
  key: string;
  size: number;
}

export interface StorageProvider {
  readonly name: string;
  save(folder: string, originalName: string, data: Buffer): Promise<StoredFile>;
  /** A readable stream of the file, or null when it doesn't exist. */
  open(key: string): Promise<Readable | null>;
  remove(key: string): Promise<void>;
}

function newKey(folder: string, originalName: string) {
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8);
  return `${folder}/${Date.now()}-${randomToken(8)}${ext}`;
}

const ROOT = path.resolve(process.env.STORAGE_DIR ?? path.resolve(__dirname, '../../uploads'));

class LocalStorage implements StorageProvider {
  readonly name = 'local';
  private pathFor(key: string) {
    const full = path.resolve(ROOT, key);
    if (!full.startsWith(ROOT + path.sep)) throw new Error('Invalid storage key'); // path traversal guard
    return full;
  }
  async save(folder: string, originalName: string, data: Buffer): Promise<StoredFile> {
    const key = newKey(folder, originalName);
    const full = this.pathFor(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return { key, size: data.length };
  }
  async open(key: string) {
    const full = this.pathFor(key);
    try {
      await fs.access(full);
    } catch {
      return null;
    }
    return createReadStream(full);
  }
  async remove(key: string) {
    await fs.rm(this.pathFor(key), { force: true });
  }
}

class VercelBlobStorage implements StorageProvider {
  readonly name = 'vercel-blob';
  async save(folder: string, originalName: string, data: Buffer): Promise<StoredFile> {
    const { put } = await import('@vercel/blob');
    const key = newKey(folder, originalName);
    await put(key, data, { access: 'private', addRandomSuffix: false });
    return { key, size: data.length };
  }
  async open(key: string) {
    const { get } = await import('@vercel/blob');
    const r = await get(key, { access: 'private' });
    if (!r || r.statusCode !== 200) return null;
    return Readable.fromWeb(r.stream as unknown as WebReadableStream<Uint8Array>);
  }
  async remove(key: string) {
    const { del } = await import('@vercel/blob');
    await del(key);
  }
}

export const storage: StorageProvider = process.env.STORAGE_PROVIDER === 'vercel-blob' ? new VercelBlobStorage() : new LocalStorage();

const CONTENT_TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/** Streams a stored file to the response. Returns false (nothing sent) when the file doesn't exist. */
export async function sendStored(res: Response, key: string, cacheControl: string): Promise<boolean> {
  const stream = await storage.open(key);
  if (!stream) return false;
  res.setHeader('Content-Type', CONTENT_TYPES[path.extname(key).toLowerCase()] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', cacheControl);
  try {
    await pipeline(stream, res);
  } catch {
    res.destroy(); // client went away mid-download, or the source failed after headers were sent
  }
  return true;
}
