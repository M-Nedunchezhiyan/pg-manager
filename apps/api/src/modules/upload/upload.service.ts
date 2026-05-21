import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import mime from 'mime-types';

import { env } from '../../config/env';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB

export type UploadCategory = 'resident-photo' | 'resident-id' | 'pg-image' | 'expense-receipt';
const CATEGORIES = new Set<UploadCategory>([
  'resident-photo',
  'resident-id',
  'pg-image',
  'expense-receipt',
]);

@Injectable()
export class UploadService {
  private readonly root: string;

  constructor() {
    this.root = resolve(env.STORAGE_ROOT);
  }

  /**
   * Persist an uploaded file to local disk and return a key for retrieval.
   * Bytes are NEVER served raw — clients fetch via /api/v1/files/:key with auth.
   */
  async store(opts: {
    userId: string;
    category: UploadCategory;
    originalName: string;
    mimetype: string;
    buffer: Buffer;
  }): Promise<{ key: string; url: string; size: number }> {
    if (!CATEGORIES.has(opts.category)) {
      throw new BadRequestException(`Unknown category: ${opts.category}`);
    }
    if (!ALLOWED_MIME.has(opts.mimetype)) {
      throw new BadRequestException(`Unsupported content type: ${opts.mimetype}`);
    }
    if (opts.buffer.length === 0 || opts.buffer.length > MAX_BYTES) {
      throw new BadRequestException(`File too large (max ${MAX_BYTES / 1024 / 1024} MiB)`);
    }
    const ext = extname(opts.originalName).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      throw new BadRequestException(`Unsupported file extension: ${ext}`);
    }
    if (!this.headerMatches(opts.mimetype, opts.buffer)) {
      throw new BadRequestException('Content does not match declared MIME type');
    }

    const safeName = `${randomUUID()}${ext}`;
    const relDir = join(opts.category, opts.userId);
    const absDir = this.safeJoin(relDir);
    await mkdir(absDir, { recursive: true, mode: 0o750 });

    const absPath = join(absDir, safeName);
    await writeFile(absPath, opts.buffer, { mode: 0o640 });

    const key = `${opts.category}/${opts.userId}/${safeName}`;
    return { key, url: `/api/v1/files/${encodeURIComponent(key)}`, size: opts.buffer.length };
  }

  /** Open a readable stream for a stored file. Returns mime + stream + size. */
  async open(key: string): Promise<{ stream: NodeJS.ReadableStream; mimetype: string; size: number }> {
    const abs = this.safeJoin(key);
    const s = await stat(abs).catch(() => null);
    if (!s || !s.isFile()) throw new NotFoundException();
    const mimetype = mime.lookup(abs) || 'application/octet-stream';
    return { stream: createReadStream(abs), mimetype, size: s.size };
  }

  // ── path safety ────────────────────────────────────────────────────────

  /**
   * Resolve a relative key under the storage root, REFUSING to escape it.
   * Defends against `../../etc/passwd` style traversal.
   */
  private safeJoin(rel: string): string {
    const normalized = normalize(rel).replace(/^([\\/])+/, '');
    if (normalized.includes('..') || normalized.startsWith('..')) {
      throw new BadRequestException('Invalid path');
    }
    const abs = resolve(this.root, normalized);
    if (!abs.startsWith(this.root + sep) && abs !== this.root) {
      throw new BadRequestException('Path escapes storage root');
    }
    return abs;
  }

  /** Lightweight magic-number check so a `.exe` renamed to `.png` is rejected. */
  private headerMatches(mimetype: string, buf: Buffer): boolean {
    if (buf.length < 4) return false;
    if (mimetype === 'image/png') {
      return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    }
    if (mimetype === 'image/jpeg') {
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    }
    if (mimetype === 'image/webp') {
      return buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
    }
    if (mimetype === 'application/pdf') {
      return buf.toString('ascii', 0, 4) === '%PDF';
    }
    return false;
  }
}
