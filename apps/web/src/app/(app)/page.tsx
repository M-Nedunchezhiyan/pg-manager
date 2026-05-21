'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { errorMessage } from '@/lib/api';
import { createPG, listPGs, type CreatePGInput } from '@/lib/pgs';

const FormSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.enum(['MALE', 'FEMALE', 'COED']),
  address: z.string().min(5).max(500),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().regex(/^\d{6}$/, '6 digits'),
  phone: z
    .string()
    .regex(/^\+?\d{10,15}$/, '10–15 digits')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});
type FormValues = z.infer<typeof FormSchema>;

export default function HomePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const qc = useQueryClient();
  const { data: pgs, isLoading } = useQuery({ queryKey: ['pgs'], queryFn: listPGs });

  const close = () => setModalOpen(false);
  const created = () => {
    qc.invalidateQueries({ queryKey: ['pgs'] });
    close();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your PGs</h1>
          <p className="text-sm text-muted">Select a PG to manage residents, rooms, and food.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(pgs ?? []).map((pg) => (
            <Link
              key={pg.id}
              href={`/pg/${pg.id}` as never}
              className="group rounded-lg border bg-surface p-4 shadow-card transition hover:border-primary/60"
            >
              <div className="mb-3 flex h-32 items-center justify-center rounded-md bg-primary-soft/60">
                {pg.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pg.imageUrl} alt={pg.name} className="h-full w-full rounded-md object-cover" />
                ) : (
                  <Building2 className="h-10 w-10 text-primary-deep/70" />
                )}
              </div>
              <div className="font-medium">{pg.name}</div>
              <div className="text-sm text-muted">
                {pg.city}, {pg.state}
              </div>
              <div className="mt-2 text-xs uppercase tracking-wide text-muted">
                {pg.type} · {pg._count?.residents ?? 0} active
              </div>
            </Link>
          ))}

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-primary/40 bg-primary-soft/40 text-primary-deep transition hover:border-primary hover:bg-primary-soft"
          >
            <Plus className="mb-2 h-6 w-6" />
            <span className="font-medium">Add PG</span>
          </button>
        </div>
      )}

      {modalOpen && <AddPGModal onClose={close} onCreated={created} />}
    </div>
  );
}

function AddPGModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { type: 'COED' },
  });

  const mutation = useMutation({
    mutationFn: (v: CreatePGInput) => createPG(v),
    onSuccess: onCreated,
    onError: (e) => setServerError(errorMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4">
      <div className="w-full max-w-md rounded-lg border bg-bg p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add PG</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-3">
          <Field label="PG name" error={errors.name?.message}>
            <input {...register('name')} className={inputCls} placeholder="Green Stays" />
          </Field>

          <Field label="Type" error={errors.type?.message}>
            <select {...register('type')} className={inputCls}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="COED">Co-ed (floor segregated)</option>
            </select>
          </Field>

          <Field label="Address" error={errors.address?.message}>
            <textarea {...register('address')} rows={2} className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="City" error={errors.city?.message}>
              <input {...register('city')} className={inputCls} />
            </Field>
            <Field label="State" error={errors.state?.message}>
              <input {...register('state')} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Pincode" error={errors.pincode?.message}>
              <input {...register('pincode')} className={inputCls} inputMode="numeric" />
            </Field>
            <Field label="Phone (optional)" error={errors.phone?.message}>
              <input {...register('phone')} className={inputCls} inputMode="tel" />
            </Field>
          </div>

          {serverError && (
            <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {serverError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-surface">
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-deep disabled:opacity-60"
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-md border bg-bg px-3 py-2 text-sm outline-none transition focus:border-primary';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}
