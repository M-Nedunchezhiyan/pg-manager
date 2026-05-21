import { createClient } from '@/lib/supabase/client';

export type UploadCategory = 'resident-photo' | 'resident-id' | 'pg-image' | 'expense-receipt';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ACCEPTED: Record<UploadCategory, string[]> = {
  'resident-photo': ['image/jpeg', 'image/png', 'image/webp'],
  'resident-id': ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  'pg-image': ['image/jpeg', 'image/png', 'image/webp'],
  'expense-receipt': ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
};

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

  const supabase = createClient();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const path = `${category}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('pg-uploads').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
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
