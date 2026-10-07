'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { forgotPasswordSchema } from '@gym/types';
import { api, ApiError } from '@/lib/api';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) return setError(parsed.error.flatten().fieldErrors.email?.[0] ?? 'Enter a valid email');
    setError(null);
    setBusy(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: parsed.data, noAuthRedirect: true });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Reset your password" subtitle="We’ll email you a link to choose a new one." footer={<Link href="/auth/login" className="inline-flex items-center gap-1.5 text-primary hover:underline"><ArrowLeft className="size-4" /> Back to sign in</Link>}>
      {sent ? (
        <div role="status" className="flex flex-col items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] px-6 py-8 text-center">
          <MailCheck className="size-9 text-primary" />
          <p className="font-display font-semibold">Check your inbox</p>
          <p className="text-sm text-muted-foreground">If an account exists for <span className="text-foreground">{email}</span>, a reset link is on its way. It expires in 30 minutes.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <Field id="email" label="Email" error={error ?? undefined}>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error} placeholder="you@example.com" autoFocus />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}
