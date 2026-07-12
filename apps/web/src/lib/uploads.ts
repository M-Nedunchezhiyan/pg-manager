import { createClient } from '@/lib/supabase/client';

export type UploadCategory = 'resident-photo' | 'resident-id' | 'pg-image' | 'expense-receipt';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB, checked before compression

const ACCEPTED: Record<UploadCategory, string[]> = {
  'resident-photo': ['image/jpeg', 'image/png', 'image/webp'],
  'resident-id': ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  'pg-image': ['image/jpeg', 'image/png', 'image/webp'],
  'expense-receipt': ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
};

// Images are downscaled + re-encoded as WebP before upload to keep the
// (free-tier) Supabase Storage quota small. Larger caps for categories where
// legibility matters (ID proofs, receipts); PDFs pass through untouched.
const COMPRESSION: Record<UploadCategory, { maxDimension: number; quality: number }> = {
  'resident-photo': { maxDimension: 800, quality: 0.82 },
  'pg-image': { maxDimension: 1280, quality: 0.82 },
  'expense-receipt': { maxDimension: 1600, quality: 0.85 },
  'resident-id': { maxDimension: 1800, quality: 0.88 },
};

async function compressImage(file: File, { maxDimension, quality }: { maxDimension: number; quality: number }): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (!blob) return file;

  const newName = file.name.replace(/\.[^./]+$/, '') + '.webp';
  return new File([blob], newName, { type: 'image/webp' });
}

/**
 * Upload directly from the browser to Supabase Storage, then return a
 * signed URL good for 1 hour. The bucket is private; signed URLs are
 * minted on every render via /api/uploads/sign.
 *
 * Returns the storage path (not the URL) — callers store the path; UI
 * components call signUrl() to get a fresh signed URL when displaying.
 */
export async function uploadFile(file: File, category: UploadCategory): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (max ${Math.floor(MAX_BYTES / 1024 / 1024)} MB)`);
  }
  if (!ACCEPTED[category].includes(file.type)) {
    throw new Error(`File type not allowed for ${category}`);
  }

  const uploadTarget = file.type.startsWith('image/')
    ? await compressImage(file, COMPRESSION[category]).catch(() => file)
    : file;

  const supabase = createClient();
  const ext = uploadTarget.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const path = `${category}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('pg-uploads').upload(path, uploadTarget, {
    cacheControl: '3600',
    upsert: false,
    contentType: uploadTarget.type,
  });
  if (error) throw new Error(error.message);
  return path;
}

/**
 * Mint a 1-hour signed URL for a stored object. Called when rendering an
 * <img src> that points at a private file.
 */
export async function signUrl(path: string, expiresIn = 60 * 60): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from('pg-uploads').createSignedUrl(path, expiresIn);
  if (error || !data) throw new Error(error?.message ?? 'Failed to sign URL');
  return data.signedUrl;
}
