'use client';

import { useState } from 'react';
import { Dumbbell, Plus } from 'lucide-react';
import type { ExerciseDto } from '@gym/types';
import { useApi } from '@/lib/use-api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, Skeleton } from '@/components/ui/misc';
import { EmptyState, ErrorState } from '@/components/dashboard/primitives';
import { Chip, fieldErrors, FormRow, Modal, PageHeader, post, put, SearchBox, Select, Textarea, titleCase, useAction } from '@/components/kit/kit';

const CATS = ['STRENGTH', 'CARDIO', 'MOBILITY', 'STRETCH', 'PLYOMETRIC', 'CORE'];
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

function ExerciseForm({ initial, onDone, onClose }: { initial?: ExerciseDto; onDone: () => void; onClose: () => void }) {
  const { busy, run } = useAction();
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [f, setF] = useState({ name: initial?.name ?? '', description: initial?.description ?? '', category: initial?.category ?? 'STRENGTH', difficulty: initial?.difficulty ?? 'BEGINNER', equipment: (initial?.equipment ?? []).join(', '), primary: (initial?.primaryMuscles ?? []).join(', '), secondary: (initial?.secondaryMuscles ?? []).join(', '), instructions: (initial?.instructions ?? []).join('\n'), mistakes: (initial?.commonMistakes ?? []).join('\n') });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault(); setErrs({});
      const body = { name: f.name, description: f.description || undefined, category: f.category, difficulty: f.difficulty, equipment: csv(f.equipment), primaryMuscles: csv(f.primary), secondaryMuscles: csv(f.secondary), instructions: lines(f.instructions), commonMistakes: lines(f.mistakes) };
      const r = await run(async () => { try { return await (initial ? put(`/exercises/${initial.id}`, body) : post('/exercises', body)); } catch (err) { setErrs(fieldErrors(err)); throw err; } }, 'Exercise saved');
      if (r) onDone();
    }}>
      <FormRow label="Name" error={errs.name} className="sm:col-span-2">{(id) => <Input id={id} required value={f.name} onChange={set('name')} />}</FormRow>
      <FormRow label="Category">{(id) => <Select id={id} value={f.category} onChange={set('category')}>{CATS.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select>}</FormRow>
      <FormRow label="Difficulty">{(id) => <Select id={id} value={f.difficulty} onChange={set('difficulty')}>{['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select>}</FormRow>
      <FormRow label="Primary muscles" hint="Comma separated" error={errs.primaryMuscles}>{(id) => <Input id={id} value={f.primary} onChange={set('primary')} placeholder="Quadriceps, Glutes" />}</FormRow>
      <FormRow label="Secondary muscles" hint="Comma separated">{(id) => <Input id={id} value={f.secondary} onChange={set('secondary')} />}</FormRow>
      <FormRow label="Equipment" hint="Comma separated" className="sm:col-span-2">{(id) => <Input id={id} value={f.equipment} onChange={set('equipment')} placeholder="Barbell, Rack" />}</FormRow>
      <FormRow label="Description" className="sm:col-span-2">{(id) => <Textarea id={id} value={f.description} onChange={set('description')} />}</FormRow>
      <FormRow label="Instructions" hint="One step per line" error={errs.instructions} className="sm:col-span-2">{(id) => <Textarea id={id} value={f.instructions} onChange={set('instructions')} className="min-h-[120px]" />}</FormRow>
      <FormRow label="Common mistakes" hint="One per line" className="sm:col-span-2">{(id) => <Textarea id={id} value={f.mistakes} onChange={set('mistakes')} />}</FormRow>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save exercise</Button></div>
    </form>
  );
}

function Detail({ exercise, canEdit, onEdit }: { exercise: ExerciseDto; canEdit: boolean; onEdit: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2"><Badge variant="primary">{titleCase(exercise.category)}</Badge><Badge>{titleCase(exercise.difficulty)}</Badge>{exercise.primaryMuscles.map((m) => <Badge key={m} variant="good">{m}</Badge>)}{exercise.secondaryMuscles.map((m) => <Badge key={m} variant="muted">{m}</Badge>)}{exercise.equipment.map((m) => <Badge key={m} variant="muted">🏋 {m}</Badge>)}</div>
      {exercise.description && <p className="text-sm text-muted-foreground">{exercise.description}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <div><h4 className="mb-2 font-display font-semibold">How to do it</h4><ol className="list-decimal space-y-1.5 pl-5 text-sm">{exercise.instructions.map((s) => <li key={s}>{s}</li>)}</ol></div>
        <div><h4 className="mb-2 font-display font-semibold">Common mistakes</h4>{exercise.commonMistakes.length === 0 ? <p className="text-sm text-muted-foreground">None listed.</p> : <ul className="space-y-1.5 text-sm">{exercise.commonMistakes.map((s) => <li key={s} className="flex gap-2 text-monitor"><span>⚠</span><span className="text-foreground">{s}</span></li>)}</ul>}</div>
      </div>
      {canEdit && <Button size="sm" variant="outline" onClick={onEdit}>Edit details</Button>}
    </div>
  );
}

/** The exercise library: every role can browse; staff can create, edit and archive. */
export function ExercisesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN';
  const staff = user?.role !== 'CLIENT';
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const qs = [q && `q=${encodeURIComponent(q)}`, cat && `category=${cat}`, showArchived && staff && 'includeInactive=true'].filter(Boolean).join('&');
  const { data, error, loading, reload } = useApi<{ items: ExerciseDto[] }>(`/exercises${qs ? `?${qs}` : ''}`);
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<ExerciseDto | 'new' | null>(null);
  const { run } = useAction();
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  const current = data?.items.find((e) => e.id === open) ?? null;
  const items = data?.items ?? [];
  return (
    <div>
      <PageHeader description="The exercise library: instructions, muscles, equipment, difficulty and common mistakes." actions={<><SearchBox value={q} onChange={setQ} placeholder="Search exercises" className="w-56" />{staff && <Button onClick={() => setEdit('new')}><Plus /> New exercise</Button>}</>} />
      <div className="mb-5 flex flex-wrap gap-2"><Chip active={!cat} onClick={() => setCat('')}>All</Chip>{CATS.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{titleCase(c)}</Chip>)}{staff && <><span className="mx-1 w-px bg-white/10" /><Chip active={showArchived} onClick={() => setShowArchived((v) => !v)}>Show archived</Chip></>}</div>
      {loading || !data ? <Skeleton className="h-64" /> : items.length === 0 ? <EmptyState icon={Dumbbell} title="No exercises found" description="Try a different search or filter." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((e) => (
            <button key={e.id} onClick={() => setOpen(e.id)} className={cn('surface-card group flex flex-col gap-3 p-4 text-left transition-colors hover:border-primary/40', !e.isActive && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2"><span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Dumbbell className="size-5" /></span>{!e.isActive && <Badge variant="muted">archived</Badge>}</div>
              <div><p className="font-display font-semibold group-hover:text-primary">{e.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{e.primaryMuscles.join(', ')}</p></div>
              <div className="mt-auto flex flex-wrap gap-1.5"><Badge variant="muted">{titleCase(e.category)}</Badge><Badge variant="muted">{titleCase(e.difficulty)}</Badge></div>
            </button>
          ))}
        </div>
      )}
      <Modal open={!!current} onClose={() => setOpen(null)} title={current?.name ?? ''} wide>
        {current && <Detail exercise={current} canEdit={staff && (isAdmin || current.createdById === user?.id)} onEdit={() => { setEdit(current); setOpen(null); }} />}
        {current && staff && (isAdmin || current.createdById === user?.id) && <div className="mt-4 flex justify-end"><Button size="sm" variant="ghost" onClick={async () => { if (await run(() => post(`/exercises/${current.id}/${current.isActive ? 'archive' : 'restore'}`), current.isActive ? 'Exercise archived' : 'Exercise restored')) { setOpen(null); reload(); } }}>{current.isActive ? 'Archive exercise' : 'Restore exercise'}</Button></div>}
      </Modal>
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === 'new' ? 'New exercise' : 'Edit exercise'} wide>{edit && <ExerciseForm initial={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}</Modal>
    </div>
  );
}
