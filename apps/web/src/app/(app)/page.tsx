'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2, Plus, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AmenityPicker } from '@/components/amenity-picker';
import { PageLoader } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast-store';
import { resolveAmenity } from '@/lib/amenities';
import { errorMessage } from '@/lib/api';
import { fetchMe } from '@/lib/auth';
import { createPG, listPGs, type CreatePGInput } from '@/lib/pgs';
import { cn } from '@/lib/utils';

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
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });

  const close = () => setModalOpen(false);
  const created = () => {
    qc.invalidateQueries({ queryKey: ['pgs'] });
    close();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-deep">Dashboard</p>
          <h1 className="font-display text-2xl font-medium">Your PGs</h1>
          <p className="text-sm text-muted">Select a PG to manage residents, rooms, and food.</p>
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {(pgs ?? []).map((pg) => (
            <Link
              key={pg.id}
              href={`/pg/${pg.id}` as never}
              className="group overflow-hidden rounded-xl bg-surface shadow-card transition duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-elevated"
            >
              <div className="relative flex h-32 items-center justify-center overflow-hidden bg-brand-gradient-soft">
                {pg.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pg.imageUrl} alt={pg.name} className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-10 w-10 text-primary-deep/60 transition group-hover:scale-110" />
                )}
                <span
                  className={cn(
                    'absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    'bg-bg/85 text-primary-deep backdrop-blur-sm',
                  )}
                >
                  {pg.type}
                </span>
              </div>
              <div className="p-4">
                <div className="font-display font-medium">{pg.name}</div>
                <div className="text-sm text-muted">
                  {pg.city}, {pg.state}
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-muted">
                  <Users className="h-3.5 w-3.5 text-primary-deep" />
                  {pg._count?.residents ?? 0} active residents
                </div>
                {pg.amenities && pg.amenities.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-2.5">
                    {pg.amenities.slice(0, 4).map((key) => {
                      const { label, icon: Icon } = resolveAmenity(key);
                      return (
                        <span
                          key={key}
                          title={label}
                          className="flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary-deep"
                        >
                          <Icon className="h-3 w-3" />
                          {label}
                        </span>
                      );
                    })}
                    {pg.amenities.length > 4 && (
                      <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted">
                        +{pg.amenities.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}

          {me?.role === 'OWNER' && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary-soft/30 text-primary-deep transition hover:border-primary hover:bg-primary-soft"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient text-primary-foreground shadow-card">
                <Plus className="h-5 w-5" />
              </span>
              <span className="font-medium">Add PG</span>
            </button>
          )}
        </div>
      )}

      {modalOpen && <AddPGModal onClose={close} onCreated={created} />}
    </div>
  );
}

function AddPGModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [amenities, setAmenities] = useState<string[]>([]);
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
    onError: (e) => toast({ variant: 'error', title: "Couldn't create PG", description: errorMessage(e) }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-bg p-6 shadow-elevated">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-medium">Add PG</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate({ ...v, amenities }))}
          className="space-y-3"
        >
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="City" error={errors.city?.message}>
              <input {...register('city')} className={inputCls} />
            </Field>
            <Field label="State" error={errors.state?.message}>
              <input {...register('state')} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Pincode" error={errors.pincode?.message}>
              <input {...register('pincode')} className={inputCls} inputMode="numeric" />
            </Field>
            <Field label="Phone (optional)" error={errors.phone?.message}>
              <input {...register('phone')} className={inputCls} inputMode="tel" />
            </Field>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium">Amenities &amp; services</span>
            <AmenityPicker selected={amenities} onChange={setAmenities} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-surface">
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-primary-foreground shadow-card transition hover:brightness-110 disabled:opacity-60"
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
