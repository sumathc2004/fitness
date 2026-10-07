'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2, LinkIcon } from 'lucide-react';
import { AUTH } from '@gym/config';
import { resetPasswordSchema } from '@gym/types';
import { api, ApiError } from '@/lib/api';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (!token) {
    return (
      <AuthShell title="Link missing" subtitle="This page needs the link from your reset email.">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
          <LinkIcon className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Open the link from your email, or request a new one.</p>
          <Link href="/auth/forgot-password" className={cn(buttonVariants({ variant: 'outline' }))}>Request a new link</Link>
        </div>
      </AuthShell>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (password !== confirm) return setErrors({ confirm: ['Passwords do not match'] });
    const parsed = resetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) return setErrors(parsed.error.flatten().fieldErrors);
    setErrors({});
    setBusy(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: parsed.data, noAuthRedirect: true });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) { if (err.details) setErrors(err.details); setFormError(err.message); }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="You can now sign in with your new password.">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-good/25 bg-good/[0.06] px-6 py-8 text-center">
          <CheckCircle2 className="size-10 text-good" />
          <Link href="/auth/login" className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>Continue to sign in</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you don’t use anywhere else.">
      <form onSubmit={submit} className="space-y-5" noValidate>
        {formError && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">{formError} <Link href="/auth/forgot-password" className="underline">Request a new link</Link></div>}
        <Field id="password" label="New password" error={errors.password?.[0]} hint={`At least ${AUTH.passwordMinLength} characters with a letter and a number.`}>
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} autoFocus />
        </Field>
        <Field id="confirm" label="Confirm password" error={errors.confirm?.[0]}>
          <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!errors.confirm} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Update password</Button>
      </form>
    </AuthShell>
  );
}
