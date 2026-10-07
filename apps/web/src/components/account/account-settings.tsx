'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, UserRound } from 'lucide-react';
import { ROLE_LABEL } from '@gym/config';
import { AUTH } from '@gym/config';
import type { AuthResponse } from '@gym/types';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Avatar, Badge, Skeleton } from '@/components/ui/misc';

type FieldErrors = Record<string, string[] | undefined>;
const first = (e: FieldErrors, k: string) => e[k]?.[0];

function strength(pw: string): { score: number; label: string } {
  let s = 0;
  if (pw.length >= AUTH.passwordMinLength) s++;
  if (pw.length >= 14) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return { score: s, label: ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][s] ?? 'Strong' };
}

export function AccountSettings() {
  const { user, loading, setUser } = useAuth();
  const [profile, setProfile] = useState<{ firstName: string; lastName: string; phone: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [profileErrors, setProfileErrors] = useState<FieldErrors>({});

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwErrors, setPwErrors] = useState<FieldErrors>({});

  if (loading || !user) return <div className="space-y-6"><Skeleton className="h-40" /><Skeleton className="h-72" /></div>;
  const form = profile ?? { firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? '' };

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setProfileErrors({});
    try {
      const res = await api<AuthResponse>('/users/me', { method: 'PATCH', body: form });
      setUser(res.user);
      setProfile(null);
      toast.success('Profile updated');
    } catch (err) {
      if (err instanceof ApiError) { setProfileErrors(err.details ?? {}); toast.error(err.message); }
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwErrors({});
    if (pw.newPassword !== pw.confirm) return setPwErrors({ confirm: ['Passwords do not match'] });
    setPwSaving(true);
    try {
      const res = await api<AuthResponse>('/auth/change-password', { method: 'POST', body: { currentPassword: pw.currentPassword, newPassword: pw.newPassword } });
      setUser(res.user);
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed. Other devices have been signed out.');
    } catch (err) {
      if (err instanceof ApiError) { setPwErrors(err.details ?? {}); toast.error(err.message); }
    } finally {
      setPwSaving(false);
    }
  }

  const st = strength(pw.newPassword);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <Avatar name={`${user.firstName} ${user.lastName}`} size={64} />
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-bold">{user.firstName} {user.lastName}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <Badge variant="primary" className="mt-2">{ROLE_LABEL[user.role]}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="size-4 text-primary" /> Profile</CardTitle><CardDescription>Your name and phone number. Your email is your sign-in and can only be changed by an administrator.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Field id="firstName" label="First name" error={first(profileErrors, 'firstName')}>
              <Input id="firstName" value={form.firstName} onChange={(e) => setProfile({ ...form, firstName: e.target.value })} aria-invalid={!!first(profileErrors, 'firstName')} autoComplete="given-name" required />
            </Field>
            <Field id="lastName" label="Last name" error={first(profileErrors, 'lastName')}>
              <Input id="lastName" value={form.lastName} onChange={(e) => setProfile({ ...form, lastName: e.target.value })} aria-invalid={!!first(profileErrors, 'lastName')} autoComplete="family-name" required />
            </Field>
            <div className="sm:col-span-2">
              <Field id="phone" label="Phone" error={first(profileErrors, 'phone')}>
                <Input id="phone" type="tel" value={form.phone} onChange={(e) => setProfile({ ...form, phone: e.target.value })} aria-invalid={!!first(profileErrors, 'phone')} autoComplete="tel" placeholder="+91 98765 43210" />
              </Field>
            </div>
            <div className="sm:col-span-2"><Button type="submit" loading={saving} disabled={!profile}>Save changes</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /> Password</CardTitle><CardDescription>Changing your password signs you out everywhere else.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="grid gap-4" noValidate>
            <Field id="currentPassword" label="Current password" error={first(pwErrors, 'currentPassword')}>
              <Input id="currentPassword" type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} aria-invalid={!!first(pwErrors, 'currentPassword')} autoComplete="current-password" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="newPassword" label="New password" error={first(pwErrors, 'newPassword')} hint={`At least ${AUTH.passwordMinLength} characters with a letter and a number.`}>
                <Input id="newPassword" type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} aria-invalid={!!first(pwErrors, 'newPassword')} autoComplete="new-password" required />
              </Field>
              <Field id="confirm" label="Confirm new password" error={first(pwErrors, 'confirm')}>
                <Input id="confirm" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} aria-invalid={!!first(pwErrors, 'confirm')} autoComplete="new-password" required />
              </Field>
            </div>
            {pw.newPassword && (
              <div className="space-y-1.5" aria-live="polite">
                <div className="flex gap-1.5">{[1, 2, 3, 4].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= st.score ? (st.score <= 1 ? 'bg-attention' : st.score === 2 ? 'bg-monitor' : 'bg-good') : 'bg-white/[0.08]'}`} />)}</div>
                <p className="text-xs text-muted-foreground">Strength: {st.label}</p>
              </div>
            )}
            <div><Button type="submit" loading={pwSaving} disabled={!pw.currentPassword || !pw.newPassword}>Update password</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
