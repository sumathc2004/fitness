'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, KeyRound, Plus, UserCog, Users } from 'lucide-react';
import type { ClientDetail, ClientListItem, Paginated, TrainerListItem } from '@gym/types';
import { useApi } from '@/lib/use-api';
import { useAuth } from '@/lib/auth-context';
import { timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, Badge, Progress, Skeleton } from '@/components/ui/misc';
import { ClientStatusBadge, EmptyState, ErrorState, Section } from '@/components/dashboard/primitives';
import { Chip, fieldErrors, FormRow, fmtDate, Modal, PageHeader, patch, post, put, SearchBox, Select, Tabs, Textarea, titleCase, useAction } from '@/components/kit/kit';
import { ApiError } from '@/lib/api';
import { AttendanceHistory } from './attendance';
import { HabitsOverview } from './habits';
import { NutritionDay } from './diet-log';
import { ProgressView } from './progress';
import { SessionHistory } from './workout-run';
import { WorkoutList } from './workouts';

// ───────────────────────── trainers (admin)
function TrainerForm({ initial, onDone, onClose }: { initial?: TrainerListItem; onDone: () => void; onClose: () => void }) {
  const { busy, run } = useAction();
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [f, setF] = useState({
    firstName: initial?.name.split(' ')[0] ?? '', lastName: initial?.name.split(' ').slice(1).join(' ') ?? '', email: initial?.email ?? '', username: initial?.username ?? '',
    password: '', phone: initial?.phone ?? '', maxClients: initial?.maxClients ? String(initial.maxClients) : '', specialties: (initial?.specialties ?? []).join(', '), bio: initial?.bio ?? '',
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrs({});
    const body = { firstName: f.firstName, lastName: f.lastName, email: f.email, username: f.username, phone: f.phone, bio: f.bio || undefined, maxClients: f.maxClients ? Number(f.maxClients) : undefined, specialties: f.specialties.split(',').map((s) => s.trim()).filter(Boolean), ...(initial ? {} : { password: f.password }) };
    try {
      await (initial ? patch(`/trainers/${initial.id}`, body) : post('/trainers', body));
      onDone();
    } catch (err) {
      setErrs(fieldErrors(err));
      if (!(err instanceof ApiError && err.details)) await run(async () => { throw err; });
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <FormRow label="First name" error={errs.firstName}>{(id) => <Input id={id} required value={f.firstName} onChange={set('firstName')} />}</FormRow>
      <FormRow label="Last name" error={errs.lastName}>{(id) => <Input id={id} required value={f.lastName} onChange={set('lastName')} />}</FormRow>
      <FormRow label="Email" error={errs.email}>{(id) => <Input id={id} type="email" required value={f.email} onChange={set('email')} />}</FormRow>
      <FormRow label="Username" hint="Optional, for sign-in" error={errs.username}>{(id) => <Input id={id} value={f.username} onChange={set('username')} />}</FormRow>
      {!initial && <FormRow label="Password" hint="8+ characters with a letter and a number" error={errs.password}>{(id) => <Input id={id} type="text" required value={f.password} onChange={set('password')} autoComplete="off" />}</FormRow>}
      <FormRow label="Phone" error={errs.phone}>{(id) => <Input id={id} value={f.phone} onChange={set('phone')} />}</FormRow>
      <FormRow label="Max clients" error={errs.maxClients}>{(id) => <Input id={id} type="number" min={1} value={f.maxClients} onChange={set('maxClients')} />}</FormRow>
      <FormRow label="Specialties" hint="Comma separated" error={errs.specialties}>{(id) => <Input id={id} value={f.specialties} onChange={set('specialties')} />}</FormRow>
      <FormRow label="Bio" className="sm:col-span-2" error={errs.bio}>{(id) => <Textarea id={id} value={f.bio} onChange={set('bio')} />}</FormRow>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>{initial ? 'Save changes' : 'Create trainer'}</Button></div>
    </form>
  );
}

export function PasswordModal({ userId, name, open, onClose }: { userId: string; name: string; open: boolean; onClose: () => void }) {
  const { busy, run } = useAction();
  const [pw, setPw] = useState('');
  return (
    <Modal open={open} onClose={onClose} title={`Reset password for ${name}`} description="They are signed out everywhere and must use the new password.">
      <form onSubmit={async (e) => { e.preventDefault(); if (await run(() => post(`/users/${userId}/password`, { password: pw }), 'Password updated')) { setPw(''); onClose(); } }} className="space-y-4">
        <FormRow label="New password" hint="8+ characters with a letter and a number">{(id) => <Input id={id} required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" />}</FormRow>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Set password</Button></div>
      </form>
    </Modal>
  );
}

export function TrainersPage() {
  const { data, error, loading, reload } = useApi<{ items: TrainerListItem[] }>('/trainers');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<TrainerListItem | 'new' | null>(null);
  const [pwFor, setPwFor] = useState<TrainerListItem | null>(null);
  const { run } = useAction();
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  const items = (data?.items ?? []).filter((t) => `${t.name} ${t.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader description="Invite trainers, set how many clients each can take, and suspend access instantly." actions={<><SearchBox value={q} onChange={setQ} placeholder="Search trainers" className="w-56" /><Button onClick={() => setEdit('new')}><Plus /> New trainer</Button></>} />
      {loading ? <Skeleton className="h-64" /> : items.length === 0 ? <EmptyState icon={UserCog} title="No trainers yet" description="Create the first trainer so clients can be assigned." action={<Button onClick={() => setEdit('new')}><Plus /> New trainer</Button>} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((t) => (
            <div key={t.id} className="surface-card space-y-4 p-5">
              <div className="flex items-start gap-3">
                <Avatar name={t.name} size={44} />
                <div className="min-w-0 flex-1"><p className="truncate font-display font-semibold">{t.name}</p><p className="truncate text-sm text-muted-foreground">{t.email}</p></div>
                <Badge variant={t.status === 'ACTIVE' ? 'good' : 'attention'}>{t.status.toLowerCase()}</Badge>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Clients</span><span className="tabular-nums">{t.clients}{t.maxClients ? ` / ${t.maxClients}` : ''}</span></div>
                <Progress value={t.clients} max={t.maxClients ?? Math.max(t.clients, 1)} />
              </div>
              {t.specialties.length > 0 && <div className="flex flex-wrap gap-1.5">{t.specialties.map((s) => <Badge key={s} variant="muted">{s}</Badge>)}</div>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEdit(t)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => setPwFor(t)}><KeyRound /> Password</Button>
                <Button size="sm" variant="ghost" onClick={async () => { if (await run(() => patch(`/trainers/${t.id}`, { status: t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }), t.status === 'ACTIVE' ? 'Trainer suspended' : 'Trainer reactivated')) reload(); }}>{t.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === 'new' ? 'New trainer' : 'Edit trainer'} wide>
        {edit && <TrainerForm initial={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
      </Modal>
      {pwFor && <PasswordModal userId={pwFor.userId} name={pwFor.name} open onClose={() => setPwFor(null)} />}
    </div>
  );
}

// ───────────────────────── clients
function ClientForm({ isAdmin, trainers, onDone, onClose }: { isAdmin: boolean; trainers: TrainerListItem[]; onDone: () => void; onClose: () => void }) {
  const { busy } = useAction();
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState('');
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', username: '', password: '', phone: '', dateOfBirth: '', sex: 'MALE', heightCm: '170', weightKg: '', goal: 'RECOMPOSITION', activityLevel: 'MODERATE', trainingExperience: 'BEGINNER', injuries: '', trainerId: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrs({}); setGeneral(''); setSaving(true);
    try {
      await post('/clients', { ...f, heightCm: Number(f.heightCm), weightKg: f.weightKg ? Number(f.weightKg) : undefined, trainerId: f.trainerId || undefined });
      onDone();
    } catch (err) {
      setErrs(fieldErrors(err));
      setGeneral(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <FormRow label="First name" error={errs.firstName}>{(id) => <Input id={id} required value={f.firstName} onChange={set('firstName')} />}</FormRow>
      <FormRow label="Last name" error={errs.lastName}>{(id) => <Input id={id} required value={f.lastName} onChange={set('lastName')} />}</FormRow>
      <FormRow label="Email" error={errs.email}>{(id) => <Input id={id} type="email" required value={f.email} onChange={set('email')} />}</FormRow>
      <FormRow label="Username" hint="Optional, for sign-in" error={errs.username}>{(id) => <Input id={id} value={f.username} onChange={set('username')} />}</FormRow>
      <FormRow label="Password" hint="8+ characters with a letter and a number" error={errs.password}>{(id) => <Input id={id} required value={f.password} onChange={set('password')} autoComplete="off" />}</FormRow>
      <FormRow label="Phone" error={errs.phone}>{(id) => <Input id={id} value={f.phone} onChange={set('phone')} />}</FormRow>
      <FormRow label="Date of birth" error={errs.dateOfBirth} hint="Needed for body analysis">{(id) => <Input id={id} type="date" value={f.dateOfBirth} onChange={set('dateOfBirth')} />}</FormRow>
      <FormRow label="Sex" error={errs.sex}>{(id) => <Select id={id} value={f.sex} onChange={set('sex')}><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></Select>}</FormRow>
      <FormRow label="Height (cm)" error={errs.heightCm}>{(id) => <Input id={id} type="number" value={f.heightCm} onChange={set('heightCm')} />}</FormRow>
      <FormRow label="Starting weight (kg)" error={errs.weightKg}>{(id) => <Input id={id} type="number" step="0.1" value={f.weightKg} onChange={set('weightKg')} />}</FormRow>
      <FormRow label="Goal">{(id) => <Select id={id} value={f.goal} onChange={set('goal')}><option value="FAT_LOSS">Fat loss</option><option value="RECOMPOSITION">Recomposition</option><option value="MUSCLE_BUILDING">Muscle building</option></Select>}</FormRow>
      <FormRow label="Activity level">{(id) => <Select id={id} value={f.activityLevel} onChange={set('activityLevel')}>{['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE'].map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}</Select>}</FormRow>
      <FormRow label="Experience">{(id) => <Select id={id} value={f.trainingExperience} onChange={set('trainingExperience')}>{['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}</Select>}</FormRow>
      {isAdmin && <FormRow label="Trainer" error={errs.trainerId}>{(id) => <Select id={id} value={f.trainerId} onChange={set('trainerId')}><option value="">Assign later</option>{trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</FormRow>}
      <FormRow label="Injuries / limitations" className="sm:col-span-2" error={errs.injuries}>{(id) => <Textarea id={id} value={f.injuries} onChange={set('injuries')} placeholder="Anything the trainer should plan around" />}</FormRow>
      {general && <p role="alert" className="text-sm text-destructive sm:col-span-2">{general}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={saving || busy}>Create client</Button></div>
    </form>
  );
}

export function ClientsPage({ base }: { base: '/admin' | '/trainer' }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN';
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const { data, error, loading, reload } = useApi<Paginated<ClientListItem>>(`/clients?page=${page}&pageSize=20${q ? `&q=${encodeURIComponent(q)}` : ''}${status ? `&status=${status}` : ''}`);
  const trainers = useApi<{ items: TrainerListItem[] }>(isAdmin ? '/trainers' : null);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div>
      <PageHeader description={isAdmin ? 'Every member, their trainer and how they are doing.' : 'Your roster, with who needs attention first.'} actions={<><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search clients" className="w-56" /><Button onClick={() => setOpen(true)}><Plus /> New client</Button></>} />
      <div className="mb-4 flex gap-2">{['', 'ACTIVE', 'PAUSED', 'INACTIVE'].map((s) => <Chip key={s} active={status === s} onClick={() => { setStatus(s); setPage(1); }}>{s ? titleCase(s) : 'All'}</Chip>)}</div>
      {loading || !data ? <Skeleton className="h-72" /> : data.items.length === 0 ? <EmptyState icon={Users} title="No clients found" description={q || status ? 'Try a different search or filter.' : 'Add your first client to get started.'} action={<Button onClick={() => setOpen(true)}><Plus /> New client</Button>} /> : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="p-4 font-medium">Client</th><th className="p-4 font-medium">Status</th><th className="p-4 font-medium">Goal</th>{isAdmin && <th className="p-4 font-medium">Trainer</th>}<th className="p-4 font-medium">Membership</th><th className="p-4 font-medium">Last active</th></tr></thead>
            <tbody className="divide-y divide-white/[0.05]">
              {data.items.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="p-4"><Link href={`${base}/clients/${c.id}`} className="flex items-center gap-3 font-medium hover:text-primary"><Avatar name={c.name} size={34} /><span>{c.name}<span className="block text-xs font-normal text-muted-foreground">{c.email}</span></span></Link></td>
                  <td className="p-4"><div className="flex flex-col items-start gap-1"><ClientStatusBadge level={c.level} />{c.status !== 'ACTIVE' && <Badge variant="muted">{c.status.toLowerCase()}</Badge>}</div></td>
                  <td className="p-4 text-muted-foreground">{c.goal ? titleCase(c.goal) : '—'}</td>
                  {isAdmin && <td className="p-4 text-muted-foreground">{c.trainerName ?? <span className="text-attention">Unassigned</span>}</td>}
                  <td className="p-4 text-muted-foreground">{c.membershipEnds ? `Ends ${fmtDate(c.membershipEnds)}` : 'None'}</td>
                  <td className="p-4 text-muted-foreground">{timeAgo(c.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-white/[0.05] p-4 text-sm text-muted-foreground">
            <span>{data.total} clients · page {page} of {pages}</span>
            <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button></div>
          </div>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New client" description="Creates their login and body profile." wide>
        <ClientForm isAdmin={isAdmin} trainers={trainers.data?.items ?? []} onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload(); }} />
      </Modal>
    </div>
  );
}

// ───────────────────────── client detail
type DetailTab = 'overview' | 'training' | 'nutrition' | 'progress' | 'attendance' | 'habits';

export function ClientDetailPage({ clientId, base }: { clientId: string; base: '/admin' | '/trainer' }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN';
  const { data: c, error, loading, reload } = useApi<ClientDetail>(`/clients/${clientId}`);
  const trainers = useApi<{ items: TrainerListItem[] }>(isAdmin ? '/trainers' : null);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [pw, setPw] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const { busy, run } = useAction();
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !c) return <Skeleton className="h-96" />;
  const name = `${c.firstName} ${c.lastName}`;
  return (
    <div className="space-y-6">
      <Link href={`${base}/clients`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> All clients</Link>
      <div className="surface-card flex flex-wrap items-center gap-4 p-5">
        <Avatar name={name} size={60} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-2xl font-bold tracking-tight">{name}</h2><ClientStatusBadge level={c.attention.level} />{c.status !== 'ACTIVE' && <Badge variant="muted">{c.status.toLowerCase()}</Badge>}</div>
          <p className="text-sm text-muted-foreground">{c.email}{c.phone ? ` · ${c.phone}` : ''} · joined {fmtDate(c.joinedAt)}</p>
          {c.attention.reasons.length > 0 && <ul className="mt-1.5 text-sm text-muted-foreground">{c.attention.reasons.map((r) => <li key={r}>• {r}</li>)}</ul>}
        </div>
        <Button variant="outline" size="sm" onClick={() => setPw(true)}><KeyRound /> Reset password</Button>
        <Select aria-label="Account status" className="h-9 w-36" value={c.status} onChange={async (e) => { if (await run(() => patch(`/clients/${c.id}`, { status: e.target.value }), 'Status updated')) reload(); }}>
          <option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="INACTIVE">Inactive</option>
        </Select>
      </div>
      <Tabs<DetailTab> value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'training', label: 'Training' }, { id: 'nutrition', label: 'Nutrition' }, { id: 'progress', label: 'Progress' }, { id: 'attendance', label: 'Attendance' }, { id: 'habits', label: 'Habits' }]} />

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Profile">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {([['Sex', c.profile ? titleCase(c.profile.sex) : '—'], ['Age', c.ageYears != null ? `${c.ageYears} years` : 'Add date of birth'], ['Height', c.profile ? `${c.profile.heightCm} cm` : '—'], ['Activity', c.profile ? titleCase(c.profile.activityLevel) : '—'], ['Experience', c.profile ? titleCase(c.profile.trainingExperience) : '—'], ['Goal', c.profile ? titleCase(c.profile.goal) : '—'], ['Check-in code', c.qrCode ?? '—'], ['Emergency contact', c.emergencyContact ?? '—']] as const).map(([k, v]) => <div key={k}><dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>)}
            </dl>
            {c.profile?.injuries && <p className="mt-4 rounded-md border border-monitor/30 bg-monitor/[0.06] p-3 text-sm"><span className="font-semibold text-monitor">Injuries / limits:</span> {c.profile.injuries}</p>}
            {!c.dateOfBirth && <p className="mt-4 text-sm text-monitor">Date of birth is missing — body analysis needs it.</p>}
          </Section>
          <Section title="Plan & targets">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Trainer</dt><dd className="font-medium">{c.trainerName ?? 'Unassigned'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Membership</dt><dd className="font-medium">{c.membership ? `${c.membership.name} · ends ${fmtDate(c.membership.endDate)}` : 'None'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Daily target</dt><dd className="font-medium">{c.target ? `${c.target.calories} kcal · P${c.target.proteinG} C${c.target.carbsG} F${c.target.fatG}` : 'Not set'}</dd></div>
            </dl>
            {isAdmin && (
              <div className="mt-5 flex items-end gap-2">
                <FormRow label="Reassign trainer" className="flex-1">{(id) => <Select id={id} value={c.trainerId ?? ''} onChange={async (e) => { if (e.target.value && await run(() => put(`/clients/${c.id}/trainer`, { trainerId: e.target.value }), 'Trainer reassigned')) reload(); }}><option value="" disabled>Choose a trainer</option>{(trainers.data?.items ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.clients} clients)</option>)}</Select>}</FormRow>
              </div>
            )}
          </Section>
          <Section title="Staff notes" description="Private — never shown to the client." className="lg:col-span-2">
            <Textarea value={notes ?? c.notes ?? ''} onChange={(e) => setNotes(e.target.value)} placeholder="Injuries, preferences, things to remember…" className="min-h-[120px]" />
            <div className="mt-3 flex justify-end"><Button size="sm" loading={busy} disabled={notes === null} onClick={async () => { if (await run(() => put(`/clients/${c.id}/notes`, { notes: notes ?? '' }), 'Notes saved')) reload(); }}>Save notes</Button></div>
          </Section>
        </div>
      )}
      {tab === 'training' && (
        <div className="grid gap-6">
          <Section title="Assigned workouts" action={<Link href={`${base === '/trainer' ? '/trainer' : '/admin'}/${base === '/trainer' ? 'workout-builder' : 'workout-templates'}`} className="text-sm text-primary hover:underline">{base === '/trainer' ? 'Open builder' : 'Open templates'}</Link>}><WorkoutList clientId={c.id} base={base} /></Section>
          <Section title="Completed sessions"><SessionHistory clientId={c.id} /></Section>
        </div>
      )}
      {tab === 'nutrition' && <NutritionDay clientId={c.id} />}
      {tab === 'progress' && <ProgressView clientId={c.id} canReview />}
      {tab === 'attendance' && <AttendanceHistory clientId={c.id} />}
      {tab === 'habits' && <HabitsOverview clientId={c.id} />}
      <PasswordModal userId={c.userId} name={name} open={pw} onClose={() => setPw(false)} />
    </div>
  );
}

