'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { login } from '@/lib/auth';

const FormSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});
type FormValues = z.infer<typeof FormSchema>;

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema), mode: 'onBlur' });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      const next = search.get('next') ?? '/';
      router.replace((next.startsWith('/') ? next : '/') as never);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-soft/40 p-4">
      <div className="w-full max-w-sm rounded-lg border bg-bg p-6 shadow-card">
        <div className="mb-6 flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary-deep" />
          <span className="text-lg font-semibold">PG Manager</span>
        </div>

        <h1 className="mb-1 text-xl font-semibold">Welcome back</h1>
        <p className="mb-6 text-sm text-muted">Sign in to continue</p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Field label="Email" error={errors.email?.message}>
            <input
              type="email"
              autoComplete="email"
              {...register('email')}
              className={inp}
            />
          </Field>

          <Field label="Password" error={errors.password?.message}>
            <input
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className={inp}
            />
          </Field>

          {serverError && (
            <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-deep disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          New here?{' '}
          <Link href="/signup" className="text-primary-deep hover:underline">
            Create an account
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
