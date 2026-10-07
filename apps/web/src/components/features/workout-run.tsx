'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Dumbbell, Flame, History, Play, Plus, SkipForward, Timer, Trophy, X } from 'lucide-react';
import type { SessionDto, SessionSummary, WorkoutDto, WorkoutExerciseDto, WorkoutSection } from '@gym/types';
import { useApi } from '@/lib/use-api';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, Progress, Skeleton } from '@/components/ui/misc';
import { EmptyState, ErrorState, Section } from '@/components/dashboard/primitives';
import { fmtDate, fmtTime, PageHeader, post, put, Select, Textarea, titleCase, useAction, num } from '@/components/kit/kit';

const SECTION_LABEL: Record<WorkoutSection, string> = { WARMUP: 'Warm-up', MAIN: 'Main work', CARDIO: 'Cardio', COOLDOWN: 'Cool-down' };

// ───────────────────────── rest timer
function RestTimer({ seconds, label, onClose }: { seconds: number; label: string; onClose: () => void }) {
  const [left, setLeft] = useState(seconds);
  const [total, setTotal] = useState(seconds);
  useEffect(() => { setLeft(seconds); setTotal(seconds); }, [seconds, label]);
  useEffect(() => {
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (left === 0) { try { navigator.vibrate?.(200); } catch { /* unsupported */ } } }, [left]);
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div role="timer" aria-live="off" className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md rounded-2xl border border-primary/30 bg-elevated/95 p-4 shadow-2xl backdrop-blur sm:bottom-6">
      <div className="flex items-center gap-4">
        <span className="grid size-12 place-items-center rounded-full bg-primary/15 text-primary"><Timer className="size-6" /></span>
        <div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-wider text-muted-foreground">{left === 0 ? 'Rest over — go!' : 'Rest'}</p><p className="font-display text-3xl font-bold tabular-nums">{mm}:{ss}</p><p className="truncate text-xs text-muted-foreground">{label}</p></div>
        <div className="flex flex-col gap-1.5"><Button size="sm" variant="outline" onClick={() => { setLeft((l) => l + 15); setTotal((t) => t + 15); }}>+15s</Button><Button size="sm" variant="ghost" onClick={onClose}>Skip</Button></div>
      </div>
      <Progress className="mt-3" value={total - left} max={total} label="Rest progress" />
    </div>
  );
}

// ───────────────────────── one exercise in a running session
function ExerciseCard({ ex, session, onSession, onRest, previous }: { ex: WorkoutExerciseDto; session: SessionDto; onSession: (s: SessionDto) => void; onRest: (sec: number, label: string) => void; previous?: SessionDto['previous'][number] }) {
  const { busy, run } = useAction();
  const logged = session.sets.filter((s) => s.workoutExerciseId === ex.id);
  const maxSet = Math.max(ex.sets, ...logged.map((s) => s.setNumber));
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState<Record<number, { reps: string; kg: string }>>({});
  const allSkipped = logged.length > 0 && logged.every((s) => s.skipped) && logged.length >= ex.sets;
  const doneCount = logged.filter((s) => s.completed && !s.skipped).length;
  const planned = Number.parseInt(ex.reps, 10);

  const log = async (setNumber: number) => {
    const d = draft[setNumber];
    const prev = previous?.sets.find((p) => p.setNumber === setNumber);
    const reps = num(d?.reps ?? '') ?? (Number.isNaN(planned) ? null : planned);
    const weightKg = num(d?.kg ?? '') ?? ex.weightKg ?? prev?.weightKg ?? null;
    const s = await run(() => put<SessionDto>('/workout-sets', { sessionId: session.id, workoutExerciseId: ex.id, setNumber, reps, weightKg, skipped: false }));
    if (s) { onSession(s); if (ex.restSec > 0) onRest(ex.restSec, `${ex.name} · set ${setNumber} done`); }
  };
  const undo = async (setNumber: number) => {
    const s = await run(() => put<SessionDto>('/workout-sets', { sessionId: session.id, workoutExerciseId: ex.id, setNumber, reps: null, weightKg: null, skipped: true }));
    if (s) onSession(s);
  };

  return (
    <div className={cn('rounded-xl border p-4 transition-colors', doneCount >= ex.sets ? 'border-good/30 bg-good/[0.04]' : allSkipped ? 'border-white/[0.04] opacity-60' : 'border-white/[0.06] bg-card')}>
      <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div><div className="flex flex-wrap items-center gap-2"><p className="font-display font-semibold">{ex.name}</p>{ex.technique !== 'NORMAL' && <Badge variant="primary">{titleCase(ex.technique)}{ex.supersetGroup ? ` ${ex.supersetGroup}` : ''}</Badge>}</div>
          <p className="mt-0.5 text-sm text-muted-foreground">{ex.sets} × {ex.reps}{ex.weightKg != null ? ` @ ${ex.weightKg} kg` : ''} · rest {ex.restSec}s{ex.tempo ? ` · tempo ${ex.tempo}` : ''}</p></div>
        <div className="flex items-center gap-2"><span className="text-xs tabular-nums text-muted-foreground">{doneCount}/{ex.sets}</span><ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} /></div>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {ex.notes && <p className="rounded-md bg-white/[0.04] p-2.5 text-sm text-muted-foreground">💬 {ex.notes}</p>}
          {previous && <p className="text-xs text-muted-foreground">Last time ({fmtDate(previous.date)}): {previous.sets.map((s) => `${s.reps ?? '—'}×${s.weightKg ?? '—'}kg`).join(' · ')}</p>}
          <ul className="space-y-2">
            {Array.from({ length: maxSet }, (_, i) => i + 1).map((n) => {
              const l = logged.find((s) => s.setNumber === n);
              const prev = previous?.sets.find((p) => p.setNumber === n);
              const done = !!l?.completed && !l.skipped;
              return (
                <li key={n} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Set {n}</span>
                  <Input type="number" inputMode="numeric" min={0} aria-label={`Set ${n} reps`} className="h-10 w-20" disabled={done} placeholder={Number.isNaN(planned) ? 'reps' : String(planned)} value={done ? String(l?.reps ?? '') : draft[n]?.reps ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [n]: { reps: e.target.value, kg: d[n]?.kg ?? '' } }))} />
                  <span className="text-muted-foreground">×</span>
                  <Input type="number" inputMode="decimal" min={0} step="0.5" aria-label={`Set ${n} weight in kg`} className="h-10 w-24" disabled={done} placeholder={String(ex.weightKg ?? prev?.weightKg ?? 'kg')} value={done ? String(l?.weightKg ?? '') : draft[n]?.kg ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [n]: { kg: e.target.value, reps: d[n]?.reps ?? '' } }))} />
                  <span className="text-xs text-muted-foreground">kg</span>
                  {done ? <Button size="sm" variant="ghost" className="ml-auto text-good" onClick={() => void undo(n)} aria-label={`Undo set ${n}`}><Check /> Done</Button> : <Button size="sm" loading={busy} className="ml-auto" onClick={() => void log(n)} aria-label={`Complete set ${n}`}><Check /> Log</Button>}
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setDraft((d) => ({ ...d, [maxSet + 1]: { reps: '', kg: '' } }))}><Plus /> Add set</Button><Button size="sm" variant="ghost" onClick={async () => { const s = await run(() => post<SessionDto>(`/workout-sessions/${session.id}/skip-exercise`, { workoutExerciseId: ex.id }), 'Exercise skipped'); if (s) onSession(s); }}><SkipForward /> Skip exercise</Button></div>
        </div>
      )}
    </div>
  );
}

function SessionRunner({ initial, onExit }: { initial: SessionDto; onExit: () => void }) {
  const [session, setSession] = useState(initial);
  const [rest, setRest] = useState<{ sec: number; label: string; n: number } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [rpe, setRpe] = useState('7');
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState<SessionDto | null>(null);
  const { busy, run } = useAction();
  const completedSets = session.sets.filter((s) => s.completed && !s.skipped).length;
  const totalSets = session.exercises.reduce((t, e) => t + e.sets, 0);
  const volume = Math.round(session.sets.filter((s) => s.completed && !s.skipped).reduce((v, s) => v + (s.reps ?? 0) * (s.weightKg ?? 0), 0));
  const startRest = useCallback((sec: number, label: string) => setRest((r) => ({ sec, label, n: (r?.n ?? 0) + 1 })), []);

  if (summary) {
    const vol = Math.round(summary.sets.filter((s) => s.completed && !s.skipped).reduce((v, s) => v + (s.reps ?? 0) * (s.weightKg ?? 0), 0));
    return (
      <div className="surface-card mx-auto max-w-lg p-8 text-center"><span className="mx-auto grid size-16 place-items-center rounded-full bg-good/15 text-good"><Trophy className="size-8" /></span>
        <h2 className="mt-4 font-display text-2xl font-bold">Workout complete!</h2><p className="mt-1 text-muted-foreground">{summary.workoutName}</p>
        <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-lg bg-white/[0.04] p-4"><p className="font-display text-2xl font-bold">{summary.sets.filter((s) => s.completed && !s.skipped).length}</p><p className="text-xs text-muted-foreground">sets logged</p></div><div className="rounded-lg bg-white/[0.04] p-4"><p className="font-display text-2xl font-bold">{vol.toLocaleString()}</p><p className="text-xs text-muted-foreground">kg total volume</p></div></div>
        <Button className="mt-6" onClick={onExit}>Back to today</Button></div>
    );
  }

  const sections = (['WARMUP', 'MAIN', 'CARDIO', 'COOLDOWN'] as WorkoutSection[]).map((s) => [s, session.exercises.filter((e) => e.section === s)] as const).filter(([, e]) => e.length > 0);
  return (
    <div className="space-y-6 pb-32">
      <div className="surface-card sticky top-[4.5rem] z-10 p-4">
        <div className="flex items-center justify-between gap-3"><div><p className="font-display text-lg font-bold">{session.workoutName}</p><p className="text-sm text-muted-foreground">{completedSets}/{totalSets} sets · {volume.toLocaleString()} kg volume</p></div><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={onExit}><X /> Leave</Button><Button size="sm" onClick={() => setFinishing(true)}><Check /> Finish</Button></div></div>
        <Progress className="mt-3" value={completedSets} max={totalSets} label="Workout progress" />
      </div>
      {sections.map(([s, list]) => (
        <section key={s} aria-label={SECTION_LABEL[s]} className="space-y-3"><h3 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">{SECTION_LABEL[s]}</h3>
          {list.map((ex) => <ExerciseCard key={ex.id} ex={ex} session={session} onSession={setSession} onRest={startRest} previous={session.previous.find((p) => p.workoutExerciseId === ex.id)} />)}</section>
      ))}
      {rest && <RestTimer key={rest.n} seconds={rest.sec} label={rest.label} onClose={() => setRest(null)} />}
      {finishing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Finish workout">
          <div className="surface-card w-full max-w-md space-y-4 p-6"><h3 className="font-display text-lg font-bold">Finish workout?</h3>
            <p className="text-sm text-muted-foreground">{completedSets} of {totalSets} sets logged. Anything not logged counts as not done.</p>
            <div className="space-y-1.5"><label htmlFor="rpe" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">How hard was it? (1 easy – 10 max)</label><Select id="rpe" value={rpe} onChange={(e) => setRpe(e.target.value)}>{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</Select></div>
            <Textarea aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for your trainer (optional)" />
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setFinishing(false)}>Keep going</Button><Button loading={busy} onClick={async () => { const r = await run(() => post<SessionDto>(`/workout-sessions/${session.id}/finish`, { perceivedExertion: Number(rpe), notes: notes || undefined })); if (r) { setFinishing(false); setSummary(r); } }}>Finish</Button></div></div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── client: today's workout
export function TodaysWorkoutPage() {
  const { data, error, loading, reload } = useApi<{ items: WorkoutDto[] }>('/workouts/today');
  const [session, setSession] = useState<SessionDto | null>(null);
  const { busy, run } = useAction();
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (session) return <SessionRunner initial={session} onExit={() => { setSession(null); reload(); }} />;
  return (
    <div>
      <PageHeader description="Start the session, log every set, and let the rest timer keep you honest." />
      {loading || !data ? <Skeleton className="h-48" /> : data.items.length === 0 ? (
        <EmptyState icon={Dumbbell} title="No workout scheduled today" description="Enjoy the rest day, or check your history. Your trainer will schedule your next session." action={<Link href="/client/workout-history" className="text-sm text-primary hover:underline">View workout history</Link>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.items.map((w) => (
            <div key={w.id} className="surface-card flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-xl font-bold">{w.name}</h3><p className="text-sm text-muted-foreground">{w.exercises.length} exercises{w.estimatedMin ? ` · ~${w.estimatedMin} min` : ''}</p></div><Badge variant={w.status === 'COMPLETED' ? 'good' : w.status === 'IN_PROGRESS' ? 'primary' : 'monitor'}>{titleCase(w.status)}</Badge></div>
              {w.notes && <p className="rounded-md bg-white/[0.04] p-3 text-sm text-muted-foreground">💬 {w.notes}</p>}
              <ul className="space-y-1.5 text-sm">{w.exercises.slice(0, 6).map((e) => <li key={e.id} className="flex justify-between gap-3"><span>{e.name}</span><span className="text-muted-foreground">{e.sets} × {e.reps}</span></li>)}{w.exercises.length > 6 && <li className="text-muted-foreground">+{w.exercises.length - 6} more</li>}</ul>
              {w.status !== 'COMPLETED' && <Button loading={busy} onClick={async () => { const s = await run(() => post<SessionDto>('/workout-sessions', { workoutId: w.id })); if (s) setSession(s); }} className="mt-auto"><Play /> {w.status === 'IN_PROGRESS' ? 'Resume workout' : 'Start workout'}</Button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── history
export function SessionHistory({ clientId }: { clientId?: string | null }) {
  const { data, error, loading, reload } = useApi<{ items: SessionSummary[] }>(`/workout-sessions${clientId ? `?clientId=${clientId}` : ''}`);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDto | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  useEffect(() => { setDetail(null); if (open) api<SessionDto>(`/workout-sessions/${open}`).then((d) => mounted.current && setDetail(d)).catch(() => undefined); }, [open]);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-40" />;
  if (data.items.length === 0) return <EmptyState icon={History} title="No sessions yet" description="Completed and in-progress workouts will be listed here." />;
  return (
    <ul className="divide-y divide-white/[0.05]">
      {data.items.map((s) => (
        <li key={s.id}>
          <button onClick={() => setOpen(open === s.id ? null : s.id)} className="flex w-full items-center gap-3 py-3 text-left" aria-expanded={open === s.id}>
            <span className={cn('grid size-9 place-items-center rounded-md', s.status === 'COMPLETED' ? 'bg-good/15 text-good' : 'bg-white/[0.06] text-muted-foreground')}><Flame className="size-[18px]" /></span>
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{s.workoutName}</p><p className="text-xs text-muted-foreground">{fmtDate(s.startedAt)} · {fmtTime(s.startedAt)}</p></div>
            <div className="text-right text-xs text-muted-foreground"><p>{s.setsDone} sets</p><p>{s.volumeKg.toLocaleString()} kg</p></div>
            <Badge variant={s.status === 'COMPLETED' ? 'good' : 'muted'}>{titleCase(s.status)}</Badge>
          </button>
          {open === s.id && (
            <div className="mb-3 rounded-lg bg-white/[0.03] p-4">
              {!detail ? <Skeleton className="h-16" /> : (
                <div className="space-y-3 text-sm">{detail.exercises.map((e) => { const sets = detail.sets.filter((x) => x.workoutExerciseId === e.id && x.completed && !x.skipped); return (
                  <div key={e.id}><p className="font-medium">{e.name}</p><p className="text-muted-foreground">{sets.length ? sets.map((x) => `${x.reps ?? '—'}×${x.weightKg ?? '—'}kg`).join(' · ') : 'Not done'}</p></div>
                ); })}{detail.perceivedExertion && <p className="text-xs text-muted-foreground">Effort: {detail.perceivedExertion}/10</p>}</div>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function WorkoutHistoryPage() {
  return (<div><PageHeader description="Every session, with the sets you logged." /><Section title="Sessions"><SessionHistory /></Section></div>);
}
