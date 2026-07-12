'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { BedDouble, Eye, EyeOff, Loader2, Receipt, Users } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Logo } from '@/components/logo';
import { toast } from '@/components/ui/toast-store';
import { errorMessage } from '@/lib/api';
import { login } from '@/lib/auth';
import { beginRouteLoading } from '@/lib/loading-store';

const FormSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});
type FormValues = z.infer<typeof FormSchema>;

const FEATURES = [
  { icon: BedDouble, text: 'Live bed map across every floor and room' },
  { icon: Users, text: 'Resident onboarding, notices, and renewals' },
  { icon: Receipt, text: 'Rent ledgers, food menus, and expenses in one place' },
];

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema), mode: 'onBlur' });

  const onSubmit = async (values: FormValues) => {
    try {
      await login(values.email, values.password);
      const next = search.get('next') ?? '/';
      beginRouteLoading();
      router.replace((next.startsWith('/') ? next : '/') as never);
    } catch (err) {
      toast({ variant: 'error', title: 'Sign-in failed', description: errorMessage(err) });
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Hero panel — gradient aurora, only on large screens */}
      <div className="relative hidden overflow-hidden bg-aurora bg-grain lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="absolute -left-24 -top-24 h-96 w-96 animate-float rounded-full bg-primary/40 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -right-16 top-1/3 h-80 w-80 animate-float-slow rounded-full bg-accent/30 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-[-6rem] left-1/4 h-96 w-96 animate-float rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative z-10 animate-fade-up">
          <Logo size={40} tone="light" />
        </div>

        <div className="relative z-10 max-w-md animate-fade-up [animation-delay:120ms]">
          <h1 className="font-display text-4xl font-medium leading-tight text-white">
            A calmer way to run your <em className="italic text-accent">PG</em>.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            One dashboard for residents, rooms, rent, and food — built for the way Indian PGs
            actually run.
          </p>

          <ul className="mt-8 space-y-3">
            {FEATURES.map(({ icon: Icon, text }, i) => (
              <li
                key={text}
                className="flex animate-fade-up items-center gap-3 text-sm text-white/85"
                style={{ animationDelay: `${180 + i * 90}ms` }}
              >
                <span className="glass flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                  <Icon className="h-4 w-4 text-white" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 animate-fade-up text-xs text-white/40 [animation-delay:400ms]">
          © {new Date().getFullYear()} PG Manager. Crafted for hostel &amp; PG owners.
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center overflow-hidden bg-bg p-6 sm:p-10">
        {/* Compact gradient wash for mobile, where the hero panel is hidden */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-56 bg-brand-gradient-soft lg:hidden"
        />

        {/* Desktop-only decoration behind the card: faint dot lattice + soft brand blobs */}
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-dot-grid opacity-60 [mask-image:radial-gradient(ellipse_60%_55%_at_50%_45%,transparent,black_80%)] lg:block"
        />
        <div
          aria-hidden="true"
          className="absolute -right-28 -top-28 hidden h-96 w-96 rounded-full bg-brand-gradient-soft opacity-70 blur-3xl lg:block"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 -left-16 hidden h-80 w-80 rounded-full bg-accent-soft opacity-60 blur-3xl lg:block"
        />

        <div className="relative w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo size={34} />
          </div>

          <div className="rounded-2xl bg-bg/80 p-8 shadow-elevated backdrop-blur-sm">
            <h2 className="font-display text-2xl font-medium">Welcome back</h2>
            <p className="mb-6 mt-1 text-sm text-muted">Sign in to manage your properties</p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <Field label="Email" error={errors.email?.message}>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...register('email')}
                  className={inp}
                />
              </Field>

              <Field label="Password" error={errors.password?.message}>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...register('password')}
                    className={cnInp}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition hover:text-text"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-gradient py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition hover:brightness-110 disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

const inp =
  'w-full rounded-md border bg-bg px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';
const cnInp = `${inp} pr-10`;

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
