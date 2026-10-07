'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Activity, Eye, EyeOff, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';
import { ROLE_HOME, type RoleName } from '@gym/config';
import { loginSchema, type AuthResponse } from '@gym/types';
import { api, ApiError } from '@/lib/api';
import { cn, safeNext } from '@/lib/utils';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';

const ROLES: Array<{ role: RoleName; label: string; hint: string; icon: LucideIcon }> = [
  { role: 'CLIENT', label: 'Client', hint: 'My plan', icon: Sparkles },
  { role: 'TRAINER', label: 'Trainer', hint: 'My clients', icon: Activity },
  { role: 'SUPER_ADMIN', label: 'Admin', hint: 'Whole gym', icon: ShieldCheck },
];

export function LoginForm() {
  const params = useSearchParams();
  const [role, setRole] = useState<RoleName>('CLIENT');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Remember the last role used on this device.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gp_login_role') as RoleName | null;
      if (saved && ROLES.some((r) => r.role === saved)) setRole(saved);
    } catch { /* storage unavailable */ }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse({ identifier, password, role });
    if (!parsed.success) return setErrors(parsed.error.flatten().fieldErrors);
    setErrors({});
    setBusy(true);
    try {
      const { user } = await api<AuthResponse>('/auth/login', { method: 'POST', body: parsed.data, noAuthRedirect: true });
      try { localStorage.setItem('gp_login_role', role); } catch { /* ignore */ }
      // Full navigation so the middleware sees the fresh cookies; the account's role decides the landing page.
      const requested = safeNext(params.get('next'), ROLE_HOME[user.role]);
      window.location.assign(requested.startsWith(ROLE_HOME[user.role]) ? requested : ROLE_HOME[user.role]);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError) {
        if (err.details) setErrors(err.details);
        setFormError(err.message);
      } else setFormError('Something went wrong. Please try again.');
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Choose how you’re signing in."
      footer={<>Accounts are created by your gym. <Link href="/" className="text-primary hover:underline">Learn more</Link></>}
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div role="radiogroup" aria-label="Sign in as" className="grid grid-cols-3 gap-2">
          {ROLES.map((r) => {
            const active = role === r.role;
            return (
              <button
                key={r.role} type="button" role="radio" aria-checked={active} onClick={() => setRole(r.role)}
                className={cn('flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-all', active ? 'border-primary/60 bg-primary/[0.09] text-foreground shadow-glow' : 'border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/20 hover:text-foreground')}
              >
                <r.icon className={cn('size-5', active && 'text-primary')} />
                <span className="text-sm font-semibold">{r.label}</span>
                <span className="text-[11px] opacity-70">{r.hint}</span>
              </button>
            );
          })}
        </div>

        {formError && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">{formError}</div>}
        <Field id="identifier" label="Email or username" error={errors.identifier?.[0]}>
          <Input id="identifier" type="text" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={identifier} onChange={(e) => setIdentifier(e.target.value)} aria-invalid={!!errors.identifier} aria-describedby={errors.identifier ? 'identifier-error' : undefined} placeholder="you@example.com or username" autoFocus />
        </Field>
        <Field id="password" label="Password" error={errors.password?.[0]}>
          <div className="relative">
            <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} className="pr-11" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        {errors.role?.[0] && <p role="alert" className="text-xs text-destructive">{errors.role[0]}</p>}
        <div className="flex justify-end"><Link href="/auth/forgot-password" className="text-sm text-muted-foreground transition-colors hover:text-primary">Forgot password?</Link></div>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in</Button>
      </form>
    </AuthShell>
  );
}
