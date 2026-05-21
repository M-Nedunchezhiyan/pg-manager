'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { api, errorMessage } from '@/lib/api';
import { onboardResident } from '@/lib/residents';
import { getBedMap, type BedStatus } from '@/lib/rooms';
import { uploadFile } from '@/lib/uploads';
import { cn, paiseToRupees, rupeesToPaise } from '@/lib/utils';

// ── Schema ─────────────────────────────────────────────────────────────

const Schema = z.object({
  // Step 1
  fullName: z.string().min(2),
  phone: z.string().regex(/^\+?\d{10,15}$/, '10–15 digits'),
  alternatePhone: z
    .string()
    .regex(/^\+?\d{10,15}$/)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  gender: z.enum(['MALE', 'FEMALE', 'ANY']),
  dob: z.string().optional(),

  // Step 2 (work/home)
  workOrInstitution: z.string().min(2),
  workAddress: z.string().optional().or(z.literal('').transform(() => undefined)),
  homeAddress: z.string().min(5),
  homeCity: z.string().min(2),
  homeState: z.string().min(2),
  primaryContactName: z.string().min(2),
  primaryContactPhone: z.string().regex(/^\+?\d{10,15}$/, '10–15 digits'),

  // Step 3 (ID)
  idProofType: z.enum(['AADHAAR', 'PAN', 'LICENSE', 'PASSPORT', 'OTHER']).optional(),
  idProofNumber: z.string().optional().or(z.literal('').transform(() => undefined)),
  idProofUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  photoUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),

  // Step 4 — bed selection (just bedId here, picker handles the rest)
  bedId: z.string().cuid('Pick a bed'),
  withFood: z.boolean(),
  joinedOn: z.string().min(8),

  // Step 5 — payment (rupees in form, paise on submit)
  advanceRupees: z.coerce.number().int().min(0),
  firstMonthRentRupees: z.coerce.number().int().min(0),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER']),
  paymentReference: z.string().optional().or(z.literal('').transform(() => undefined)),
});
type FormValues = z.infer<typeof Schema>;

const STEPS = [
  { key: 'personal', label: 'Personal' },
  { key: 'work', label: 'Work & home' },
  { key: 'id', label: 'ID proof' },
  { key: 'bed', label: 'Bed & food' },
  { key: 'payment', label: 'Payment' },
  { key: 'review', label: 'Review' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

const FIELDS_PER_STEP: Record<StepKey, Array<keyof FormValues>> = {
  personal: ['fullName', 'phone', 'alternatePhone', 'email', 'gender', 'dob'],
  work: [
    'workOrInstitution',
    'workAddress',
    'homeAddress',
    'homeCity',
    'homeState',
    'primaryContactName',
    'primaryContactPhone',
  ],
  id: ['idProofType', 'idProofNumber', 'idProofUrl', 'photoUrl'],
  bed: ['bedId', 'withFood', 'joinedOn'],
  payment: ['advanceRupees', 'firstMonthRentRupees', 'paymentMethod', 'paymentReference'],
  review: [],
};

// ── Component ──────────────────────────────────────────────────────────

export default function OnboardPage() {
  const { pgId } = useParams<{ pgId: string }>();
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const f = useForm<FormValues>({
    resolver: zodResolver(Schema),
    mode: 'onBlur',
    defaultValues: {
      gender: 'MALE',
      withFood: true,
      joinedOn: today,
      paymentMethod: 'UPI',
      advanceRupees: 0,
      firstMonthRentRupees: 0,
    },
  });

  const pgQ = useQuery({
    queryKey: ['pg', pgId, 'settings'],
    queryFn: async () => (await api.get(`/pgs/${pgId}`)).data as { settings?: { advanceMonths: number; dueDaysAfterJoin: number } },
  });
  const bedMapQ = useQuery({ queryKey: ['bed-map', pgId], queryFn: () => getBedMap(pgId) });

  const mutation = useMutation({
    mutationFn: () => {
      const v = f.getValues();
      return onboardResident({
        pgId,
        bedId: v.bedId,
        fullName: v.fullName,
        phone: v.phone,
        ...(v.alternatePhone && { alternatePhone: v.alternatePhone }),
        ...(v.email && { email: v.email }),
        gender: v.gender,
        ...(v.dob && { dob: v.dob }),
        ...(v.photoUrl && { photoUrl: v.photoUrl }),
        ...(v.idProofType && { idProofType: v.idProofType }),
        ...(v.idProofNumber && { idProofNumber: v.idProofNumber }),
        ...(v.idProofUrl && { idProofUrl: v.idProofUrl }),
        homeAddress: v.homeAddress,
        homeCity: v.homeCity,
        homeState: v.homeState,
        primaryContactName: v.primaryContactName,
        primaryContactPhone: v.primaryContactPhone,
        workOrInstitution: v.workOrInstitution,
        ...(v.workAddress && { workAddress: v.workAddress }),
        joinedOn: v.joinedOn,
        withFood: v.withFood,
        advanceAmount: rupeesToPaise(v.advanceRupees),
        firstMonthRent: rupeesToPaise(v.firstMonthRentRupees),
        paymentMethod: v.paymentMethod,
        ...(v.paymentReference && { paymentReference: v.paymentReference }),
      });
    },
    onSuccess: () => router.push(`/pg/${pgId}/residents` as never),
    onError: (e) => setServerError(errorMessage(e)),
  });

  const next = async () => {
    const step = STEPS[stepIdx]!.key;
    const ok = await f.trigger(FIELDS_PER_STEP[step]);
    if (!ok) return;
    setStepIdx(Math.min(stepIdx + 1, STEPS.length - 1));
  };
  const prev = () => setStepIdx(Math.max(stepIdx - 1, 0));

  const selectedBed = useMemo(() => {
    const id = f.watch('bedId');
    if (!id || !bedMapQ.data) return null;
    for (const fl of bedMapQ.data) {
      for (const room of fl.rooms) {
        const b = room.beds.find((x) => x.id === id);
        if (b) return { floor: fl, room, bed: b };
      }
    }
    return null;
  }, [f.watch('bedId'), bedMapQ.data]);

  // Auto-fill payment defaults when bed picked.
  const onBedPick = (bedId: string) => {
    f.setValue('bedId', bedId);
    if (!bedMapQ.data || !pgQ.data?.settings) return;
    let monthly = 0;
    for (const fl of bedMapQ.data) {
      for (const room of fl.rooms) {
        if (room.beds.some((b) => b.id === bedId)) {
          monthly = (room.rentOverride ?? room.sharingType.monthlyRent) / 100;
          break;
        }
      }
    }
    f.setValue('firstMonthRentRupees', monthly);
    f.setValue('advanceRupees', monthly * pgQ.data.settings.advanceMonths);
  };

  const dueDayPreview = useMemo(() => {
    const settings = pgQ.data?.settings;
    if (!settings) return null;
    const joined = new Date(f.watch('joinedOn'));
    if (Number.isNaN(joined.getTime())) return null;
    return ((joined.getUTCDate() + settings.dueDaysAfterJoin - 1) % 31) + 1;
  }, [pgQ.data?.settings, f.watch('joinedOn')]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">Onboard resident</h1>
      <p className="mb-6 text-sm text-muted">Complete each step to add a new resident to this PG.</p>

      <Stepper current={stepIdx} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (stepIdx === STEPS.length - 1) mutation.mutate();
          else void next();
        }}
        className="mt-6 rounded-lg border bg-surface p-6 shadow-card"
      >
        {STEPS[stepIdx]!.key === 'personal' && <StepPersonal f={f} />}
        {STEPS[stepIdx]!.key === 'work' && <StepWork f={f} />}
        {STEPS[stepIdx]!.key === 'id' && <StepID f={f} />}
        {STEPS[stepIdx]!.key === 'bed' && (
          <StepBed
            bedMap={bedMapQ.data ?? []}
            selectedId={f.watch('bedId')}
            onPick={onBedPick}
            f={f}
            dueDayPreview={dueDayPreview}
          />
        )}
        {STEPS[stepIdx]!.key === 'payment' && (
          <StepPayment f={f} pgSettings={pgQ.data?.settings} />
        )}
        {STEPS[stepIdx]!.key === 'review' && (
          <StepReview values={f.getValues()} selectedBed={selectedBed} dueDayPreview={dueDayPreview} />
        )}

        {serverError && (
          <div role="alert" className="mt-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {serverError}
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={prev}
            disabled={stepIdx === 0}
            className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-surface disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-deep disabled:opacity-60"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {stepIdx === STEPS.length - 1 ? 'Submit' : 'Next'}
            {stepIdx < STEPS.length - 1 && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Stepper UI ─────────────────────────────────────────────────────────

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs',
                done && 'bg-primary text-primary-foreground',
                active && 'bg-primary-soft text-primary-deep ring-2 ring-primary',
                !done && !active && 'bg-bg text-muted ring-1 ring-border',
              )}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cn('text-xs', active ? 'text-text font-medium' : 'text-muted')}>{s.label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

// ── Step components ────────────────────────────────────────────────────

function StepPersonal({ f }: { f: ReturnType<typeof useForm<FormValues>> }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Field label="Full name" error={f.formState.errors.fullName?.message}>
        <input {...f.register('fullName')} className={inp} />
      </Field>
      <Field label="Gender" error={f.formState.errors.gender?.message}>
        <select {...f.register('gender')} className={inp}>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="ANY">Other</option>
        </select>
      </Field>
      <Field label="Phone" error={f.formState.errors.phone?.message}>
        <input {...f.register('phone')} className={inp} inputMode="tel" />
      </Field>
      <Field label="Alternate phone" error={f.formState.errors.alternatePhone?.message}>
        <input {...f.register('alternatePhone')} className={inp} inputMode="tel" />
      </Field>
      <Field label="Email" error={f.formState.errors.email?.message}>
        <input {...f.register('email')} className={inp} type="email" />
      </Field>
      <Field label="Date of birth" error={f.formState.errors.dob?.message}>
        <input {...f.register('dob')} className={inp} type="date" />
      </Field>
    </div>
  );
}

function StepWork({ f }: { f: ReturnType<typeof useForm<FormValues>> }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Field label="Work / institution" error={f.formState.errors.workOrInstitution?.message}>
        <input {...f.register('workOrInstitution')} className={inp} />
      </Field>
      <Field label="Work address" error={f.formState.errors.workAddress?.message}>
        <input {...f.register('workAddress')} className={inp} />
      </Field>
      <Field label="Home address" error={f.formState.errors.homeAddress?.message} full>
        <textarea {...f.register('homeAddress')} rows={2} className={inp} />
      </Field>
      <Field label="Home city" error={f.formState.errors.homeCity?.message}>
        <input {...f.register('homeCity')} className={inp} />
      </Field>
      <Field label="Home state" error={f.formState.errors.homeState?.message}>
        <input {...f.register('homeState')} className={inp} />
      </Field>
      <Field label="Primary contact name" error={f.formState.errors.primaryContactName?.message}>
        <input {...f.register('primaryContactName')} className={inp} />
      </Field>
      <Field label="Primary contact phone" error={f.formState.errors.primaryContactPhone?.message}>
        <input {...f.register('primaryContactPhone')} className={inp} inputMode="tel" />
      </Field>
    </div>
  );
}

function StepID({ f }: { f: ReturnType<typeof useForm<FormValues>> }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Field label="ID type" error={f.formState.errors.idProofType?.message}>
        <select {...f.register('idProofType')} className={inp}>
          <option value="">—</option>
          <option value="AADHAAR">Aadhaar</option>
          <option value="PAN">PAN</option>
          <option value="LICENSE">Driving license</option>
          <option value="PASSPORT">Passport</option>
          <option value="OTHER">Other</option>
        </select>
      </Field>
      <Field label="ID number" error={f.formState.errors.idProofNumber?.message}>
        <input {...f.register('idProofNumber')} className={inp} />
      </Field>
      <FileField
        label="Photo (jpg/png, max 10MB)"
        category="resident-photo"
        currentUrl={f.watch('photoUrl')}
        onUploaded={(url) => f.setValue('photoUrl', url)}
      />
      <FileField
        label="ID image (jpg/png/pdf, max 10MB)"
        category="resident-id"
        currentUrl={f.watch('idProofUrl')}
        onUploaded={(url) => f.setValue('idProofUrl', url)}
      />
      <p className="text-xs text-muted md:col-span-2">
        Files upload directly to object storage with a short-lived signed URL — bytes never traverse the API.
      </p>
    </div>
  );
}

function FileField({
  label,
  category,
  currentUrl,
  onUploaded,
}: {
  label: string;
  category: 'resident-photo' | 'resident-id';
  currentUrl: string | undefined;
  onUploaded: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setErr(null);
          try {
            const url = await uploadFile(file, category);
            onUploaded(url);
          } catch (er) {
            setErr(er instanceof Error ? er.message : 'Upload failed');
          } finally {
            setBusy(false);
          }
        }}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-deep hover:file:bg-primary-soft/80"
      />
      {busy && <span className="mt-1 block text-xs text-muted">Uploading…</span>}
      {currentUrl && !busy && (
        <span className="mt-1 block truncate text-xs text-success">✓ Uploaded</span>
      )}
      {err && <span className="mt-1 block text-xs text-danger">{err}</span>}
    </label>
  );
}

function StepBed({
  bedMap,
  selectedId,
  onPick,
  f,
  dueDayPreview,
}: {
  bedMap: Awaited<ReturnType<typeof getBedMap>>;
  selectedId: string | undefined;
  onPick: (bedId: string) => void;
  f: ReturnType<typeof useForm<FormValues>>;
  dueDayPreview: number | null;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Join date" error={f.formState.errors.joinedOn?.message}>
          <input type="date" {...f.register('joinedOn')} className={inp} />
        </Field>
        <Field label="With food">
          <select
            value={String(f.watch('withFood'))}
            onChange={(e) => f.setValue('withFood', e.target.value === 'true')}
            className={inp}
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </Field>
        {dueDayPreview && (
          <div className="self-end rounded-md border bg-primary-soft/40 px-3 py-2 text-xs text-primary-deep">
            Rent will be due by day <b>{dueDayPreview}</b> of each month.
          </div>
        )}
      </div>

      {f.formState.errors.bedId && (
        <p className="text-xs text-danger">{f.formState.errors.bedId.message}</p>
      )}

      {bedMap.map((fl) => (
        <div key={fl.id} className="rounded-md border bg-bg p-3">
          <div className="mb-2 text-sm font-medium">
            Floor {fl.number} <span className="text-xs text-muted">({fl.allowedGender})</span>
          </div>
          <div className="space-y-2">
            {fl.rooms.map((room) => (
              <div key={room.id} className="flex flex-wrap items-center gap-2">
                <span className="w-28 text-xs text-muted">
                  Room {room.number} · {room.sharingType.name}
                </span>
                {room.beds.map((b) => (
                  <BedTile
                    key={b.id}
                    label={b.label}
                    status={b.status}
                    selected={selectedId === b.id}
                    onClick={() => b.status === 'VACANT' && onPick(b.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BedTile({
  label,
  status,
  selected,
  onClick,
}: {
  label: string;
  status: BedStatus;
  selected: boolean;
  onClick: () => void;
}) {
  const disabled = status !== 'VACANT';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold ring-1 transition',
        status === 'VACANT' && 'bg-primary-soft text-primary-deep ring-primary/30 hover:bg-primary-soft hover:ring-primary',
        status === 'OCCUPIED' && 'bg-danger/15 text-danger/70 ring-danger/30 cursor-not-allowed',
        status === 'NOTICE_PERIOD' && 'bg-warn/20 text-warn ring-warn/40 cursor-not-allowed',
        status === 'BLOCKED' && 'bg-muted/20 text-muted ring-muted/30 cursor-not-allowed',
        selected && 'ring-2 ring-primary-deep bg-primary text-primary-foreground',
      )}
    >
      {label}
    </button>
  );
}

function StepPayment({
  f,
  pgSettings,
}: {
  f: ReturnType<typeof useForm<FormValues>>;
  pgSettings: { advanceMonths: number; dueDaysAfterJoin: number } | undefined;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {pgSettings && (
        <p className="text-xs text-muted md:col-span-2">
          PG advance is configured at <b>{pgSettings.advanceMonths}</b> months. Suggested values are pre-filled
          from the selected bed's rent — edit if needed.
        </p>
      )}
      <Field label="First month rent (₹)" error={f.formState.errors.firstMonthRentRupees?.message}>
        <input {...f.register('firstMonthRentRupees')} type="number" className={inp} />
      </Field>
      <Field label="Advance (₹)" error={f.formState.errors.advanceRupees?.message}>
        <input {...f.register('advanceRupees')} type="number" className={inp} />
      </Field>
      <Field label="Payment method" error={f.formState.errors.paymentMethod?.message}>
        <select {...f.register('paymentMethod')} className={inp}>
          <option value="UPI">UPI</option>
          <option value="CASH">Cash</option>
          <option value="BANK_TRANSFER">Bank transfer</option>
          <option value="CARD">Card</option>
          <option value="OTHER">Other</option>
        </select>
      </Field>
      <Field label="Reference (optional)" error={f.formState.errors.paymentReference?.message}>
        <input {...f.register('paymentReference')} className={inp} placeholder="UPI ref / cheque no" />
      </Field>
    </div>
  );
}

function StepReview({
  values,
  selectedBed,
  dueDayPreview,
}: {
  values: FormValues;
  selectedBed: { floor: { number: number }; room: { number: string }; bed: { label: string } } | null;
  dueDayPreview: number | null;
}) {
  return (
    <div className="space-y-4 text-sm">
      <Section title="Resident">
        <Row k="Name" v={values.fullName} />
        <Row k="Phone" v={values.phone} />
        <Row k="Gender" v={values.gender} />
        <Row k="Work / institution" v={values.workOrInstitution} />
      </Section>
      <Section title="Stay">
        <Row k="Join date" v={values.joinedOn} />
        <Row k="With food" v={values.withFood ? 'Yes' : 'No'} />
        <Row
          k="Bed"
          v={
            selectedBed
              ? `F${selectedBed.floor.number} · Room ${selectedBed.room.number} · Bed ${selectedBed.bed.label}`
              : '—'
          }
        />
        <Row k="Rent due day" v={dueDayPreview ?? '—'} />
      </Section>
      <Section title="Payment captured">
        <Row k="First month rent" v={paiseToRupees(rupeesToPaise(values.firstMonthRentRupees))} />
        <Row k="Advance" v={paiseToRupees(rupeesToPaise(values.advanceRupees))} />
        <Row k="Method" v={values.paymentMethod} />
        {values.paymentReference && <Row k="Reference" v={values.paymentReference} />}
      </Section>
    </div>
  );
}

// ── small helpers ──────────────────────────────────────────────────────

const inp = 'w-full rounded-md border bg-bg px-3 py-2 text-sm outline-none focus:border-primary';

function Field({
  label,
  error,
  children,
  full,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? 'md:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-bg p-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{title}</div>
      <dl className="space-y-1">{children}</dl>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
