'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { signup } from '@/lib/auth';

const FormSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});
type FormValues = z.infer<typeof FormSchema>;

export default function SignupPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema), mode: 'onBlur' });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await signup(values.email, values.password, values.name);
      setSent(true);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Sign-up failed');
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary-soft/40 p-4">
        <div className="w-full max-w-sm rounded-lg border bg-bg p-6 shadow-card text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success" />
          <h1 className="text-lg font-semibold">Check your inbox</h1>
          <p className="mt-2 text-sm text-muted">
            We sent a confirmation link to <b>{getValues('email')}</b>. Click it to activate your account, then sign in.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-deep"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-soft/40 p-4">
      <div className="w-full max-w-sm rounded-lg border bg-bg p-6 shadow-card">
        <div className="mb-6 flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary-deep" />
          <span className="text-lg font-semibold">PG Manager</span>
        </div>
        <h1 className="mb-1 text-xl font-semibold">Create your account</h1>
        <p className="mb-6 text-sm text-muted">
          Manage your PG residents, rent, and expenses in one place.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Field label="Your name" error={errors.name?.message}>
            <input {...register('name')} className={inp} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <input type="email" autoComplete="email" {...register('email')} className={inp} />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <input type="password" autoComplete="new-password" {...register('password')} className={inp} />
          </Field>

          {serverError && (
            <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary-deep disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create account
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-primary-deep hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

const inp = 'w-full rounded-md border bg-bg px-3 py-2 text-sm outline-none transition focus:border-primary';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
