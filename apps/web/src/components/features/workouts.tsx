'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Copy, GripVertical, Link2, Plus, Send, Trash2 } from 'lucide-react';
import type { ExerciseDto, Technique, WorkoutDto, WorkoutSection, WorkoutSummary } from '@gym/types';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, Skeleton } from '@/components/ui/misc';
import { EmptyState, ErrorState, Section } from '@/components/dashboard/primitives';
import { Chip, ConfirmButton, del, fieldErrors, FormRow, fmtDate, Modal, PageHeader, post, put, SearchBox, Select, Textarea, titleCase, today, useAction, num, useClients } from '@/components/kit/kit';
import { ClientMultiSelect } from './diet-builder';

const SECTIONS: Array<[WorkoutSection, string]> = [['WARMUP', 'Warm-up'], ['MAIN', 'Main work'], ['CARDIO', 'Cardio'], ['COOLDOWN', 'Cool-down']];
const statusVariant = (s: string): 'good' | 'monitor' | 'attention' | 'muted' | 'primary' => (s === 'COMPLETED' ? 'good' : s === 'IN_PROGRESS' ? 'primary' : s === 'SKIPPED' ? 'attention' : s === 'ASSIGNED' ? 'monitor' : 'muted');

// ───────────────────────── list of workouts (client detail, templates)
export function WorkoutList({ clientId, base }: { clientId: string; base: string }) {
  const { data, error, loading, reload } = useApi<{ items: WorkoutSummary[] }>(`/workouts?clientId=${clientId}`);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-32" />;
  if (data.items.length === 0) return <EmptyState icon={ClipboardList} title="No workouts assigned" description="Build one in the workout builder and assign it to this client." />;
  const builder = base === '/trainer' ? '/trainer/workout-builder' : null;
  return (
    <ul className="divide-y divide-white/[0.05]">
      {data.items.slice(0, 20).map((w) => (
        <li key={w.id} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1"><p className="truncate font-medium">{w.name}</p><p className="text-xs text-muted-foreground">{w.exerciseCount} exercises{w.estimatedMin ? ` · ~${w.estimatedMin} min` : ''} · {fmtDate(w.scheduledDate)}</p></div>
          <Badge variant={statusVariant(w.status)}>{titleCase(w.status)}</Badge>
          {builder && <Link href={`${builder}/${w.id}`} className="text-sm text-primary hover:underline">Open</Link>}
        </li>
      ))}
    </ul>
  );
}

// ───────────────────────── builder
interface Row {
  key: string; exerciseId?: string; customName?: string; name: string; section: WorkoutSection; sets: string; reps: string; weightKg: string; restSec: string; tempo: string; technique: Technique; supersetGroup: string; notes: string; muscles: string[];
}
let seq = 0;
const nk = () => `r${++seq}`;

function rowFromExercise(e: ExerciseDto, section: WorkoutSection): Row {
  const cardio = section === 'CARDIO';
  return { key: nk(), exerciseId: e.id, name: e.name, section, sets: cardio ? '1' : section === 'MAIN' ? '3' : '2', reps: cardio ? '10 min' : section === 'MAIN' ? '10' : '30 sec', weightKg: '', restSec: section === 'MAIN' ? '60' : '30', tempo: '', technique: 'NORMAL', supersetGroup: '', notes: '', muscles: e.primaryMuscles };
}

function SortableRow({ row, onChange, onRemove, errors }: { row: Row; onChange: (p: Partial<Row>) => void; onRemove: () => void; errors?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.key });
  const field = 'h-9 px-2.5';
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('rounded-lg border bg-card p-3', isDragging ? 'z-10 border-primary/50 shadow-xl' : 'border-white/[0.06]')}>
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners} aria-label={`Drag to reorder ${row.name}`} className="mt-1.5 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"><GripVertical className="size-5" /></button>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{row.name}</p>{row.muscles.slice(0, 2).map((m) => <Badge key={m} variant="muted">{m}</Badge>)}{row.technique !== 'NORMAL' && <Badge variant="primary">{titleCase(row.technique)}{row.supersetGroup ? ` ${row.supersetGroup}` : ''}</Badge>}</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <FormRow label="Sets">{(id) => <Input id={id} type="number" min={1} max={20} className={field} value={row.sets} onChange={(e) => onChange({ sets: e.target.value })} />}</FormRow>
            <FormRow label="Reps">{(id) => <Input id={id} className={field} value={row.reps} onChange={(e) => onChange({ reps: e.target.value })} />}</FormRow>
            <FormRow label="Kg">{(id) => <Input id={id} type="number" min={0} step="0.5" className={field} value={row.weightKg} onChange={(e) => onChange({ weightKg: e.target.value })} />}</FormRow>
            <FormRow label="Rest (s)">{(id) => <Input id={id} type="number" min={0} className={field} value={row.restSec} onChange={(e) => onChange({ restSec: e.target.value })} />}</FormRow>
            <FormRow label="Tempo">{(id) => <Input id={id} className={field} placeholder="3-1-1" value={row.tempo} onChange={(e) => onChange({ tempo: e.target.value })} />}</FormRow>
            <FormRow label="Technique">{(id) => <Select id={id} className="h-9 px-2" value={row.technique} onChange={(e) => onChange({ technique: e.target.value as Technique })}><option value="NORMAL">Normal</option><option value="SUPERSET">Superset</option><option value="DROPSET">Dropset</option></Select>}</FormRow>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_130px]">
            <Input aria-label="Notes" placeholder="Coaching notes (optional)" className={field} value={row.notes} onChange={(e) => onChange({ notes: e.target.value })} />
            {row.technique === 'SUPERSET' && <Input aria-label="Superset group" type="number" min={1} placeholder="Group #" className={field} value={row.supersetGroup} onChange={(e) => onChange({ supersetGroup: e.target.value })} />}
          </div>
          {errors && <p role="alert" className="text-xs text-destructive">{errors}</p>}
        </div>
        <button onClick={onRemove} aria-label={`Remove ${row.name}`} className="mt-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
      </div>
    </li>
  );
}

function ExercisePicker({ onPick }: { onPick: (e: ExerciseDto) => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const { data, loading } = useApi<{ items: ExerciseDto[] }>(`/exercises?${q ? `q=${encodeURIComponent(q)}&` : ''}${cat ? `category=${cat}` : ''}`);
  return (
    <div className="space-y-3">
      <SearchBox value={q} onChange={setQ} placeholder="Search exercises" />
      <div className="flex flex-wrap gap-2"><Chip active={!cat} onClick={() => setCat('')}>All</Chip>{['STRENGTH', 'CARDIO', 'MOBILITY', 'STRETCH', 'CORE', 'PLYOMETRIC'].map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{titleCase(c)}</Chip>)}</div>
      <div className="max-h-80 overflow-y-auto rounded-lg border border-white/[0.06]">
        {loading ? <Skeleton className="h-40" /> : !data || data.items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No exercises match.</p> : (
          <ul className="divide-y divide-white/[0.05]">{data.items.map((e) => <li key={e.id}><button onClick={() => onPick(e)} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-white/[0.04]"><span><span className="font-medium">{e.name}</span><span className="block text-xs text-muted-foreground">{e.primaryMuscles.join(', ')} · {titleCase(e.category)}</span></span><Plus className="size-4 text-primary" /></button></li>)}</ul>
        )}
      </div>
    </div>
  );
}

export function AssignWorkoutModal({ workoutId, open, onClose, onDone }: { workoutId: string; open: boolean; onClose: () => void; onDone?: () => void }) {
  const [ids, setIds] = useState<string[]>([]);
  const [date, setDate] = useState(today());
  const { busy, run } = useAction();
  return (
    <Modal open={open} onClose={onClose} title="Assign workout" description="Each client gets their own copy on the chosen date and is notified.">
      <div className="space-y-4">
        <ClientMultiSelect value={ids} onChange={setIds} />
        <FormRow label="Date">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />}</FormRow>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={ids.length === 0} onClick={async () => { if (await run(() => post(`/workouts/${workoutId}/assign`, { clientIds: ids, scheduledDate: date }), `Assigned to ${ids.length} client${ids.length === 1 ? '' : 's'}`)) { onClose(); onDone?.(); } }}><Send /> Assign</Button></div>
      </div>
    </Modal>
  );
}

export function WorkoutBuilderPage({ id, listHref, forceTemplate }: { id?: string; listHref: string; forceTemplate: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  const existing = useApi<WorkoutDto>(id ? `/workouts/${id}` : null);
  const clients = useClients();
  const { busy, run } = useAction();
  const [name, setName] = useState('');
  const [isTemplate, setIsTemplate] = useState(forceTemplate || sp.get('template') === '1');
  const [clientId, setClientId] = useState(sp.get('clientId') ?? '');
  const [date, setDate] = useState(sp.get('date') ?? today());
  const [estMin, setEstMin] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [pick, setPick] = useState<WorkoutSection | null>(null);
  const [assign, setAssign] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(!id);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    const w = existing.data;
    if (!w || loaded) return;
    setName(w.name); setIsTemplate(w.isTemplate); setClientId(w.clientId ?? ''); setDate(w.scheduledDate ?? today()); setEstMin(w.estimatedMin ? String(w.estimatedMin) : ''); setNotes(w.notes ?? '');
    setRows(w.exercises.map((e) => ({ key: nk(), exerciseId: e.exerciseId ?? undefined, customName: e.exerciseId ? undefined : e.name, name: e.name, section: e.section, sets: String(e.sets), reps: e.reps, weightKg: e.weightKg != null ? String(e.weightKg) : '', restSec: String(e.restSec), tempo: e.tempo ?? '', technique: e.technique, supersetGroup: e.supersetGroup ? String(e.supersetGroup) : '', notes: e.notes ?? '', muscles: e.primaryMuscles })));
    setLoaded(true);
  }, [existing.data, loaded]);

  const bySection = useMemo(() => Object.fromEntries(SECTIONS.map(([s]) => [s, rows.filter((r) => r.section === s)])) as Record<WorkoutSection, Row[]>, [rows]);
  if (existing.error) return <ErrorState message={existing.error.message} onRetry={existing.reload} />;
  if (!loaded) return <Skeleton className="h-96" />;

  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const onDragEnd = (section: WorkoutSection) => (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = bySection[section].map((r) => r.key);
    const moved = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    const ordered = moved.map((k) => rows.find((r) => r.key === k)!);
    let i = 0;
    setRows((rs) => rs.map((r) => (r.section === section ? ordered[i++]! : r)));
  };

  const payload = () => ({
    name, isTemplate, clientId: isTemplate ? undefined : clientId || undefined, scheduledDate: isTemplate ? undefined : date || undefined, estimatedMin: num(estMin) ?? undefined, notes: notes || undefined,
    exercises: SECTIONS.flatMap(([s]) => bySection[s]).map((r) => ({ exerciseId: r.exerciseId, customName: r.exerciseId ? undefined : r.customName ?? r.name, section: r.section, sets: Number(r.sets) || 1, reps: r.reps || '10', weightKg: num(r.weightKg), restSec: Number(r.restSec) || 0, tempo: r.tempo || null, technique: r.technique, supersetGroup: r.technique === 'SUPERSET' ? num(r.supersetGroup) : null, notes: r.notes || null })),
  });

  const save = async () => {
    setErrs({});
    if (!isTemplate && !clientId) { setErrs({ clientId: 'Pick a client, or save as a template' }); return; }
    const saved = await run(async () => { try { return id ? await put<WorkoutDto>(`/workouts/${id}`, payload()) : await post<WorkoutDto>('/workouts', payload()); } catch (e) { setErrs(fieldErrors(e)); throw e; } }, isTemplate ? 'Template saved' : 'Workout saved');
    if (!saved) return;
    if (!id) router.replace(`${listHref}/${saved.id}`); else existing.reload();
  };

  const total = rows.length;
  return (
    <div className="space-y-6">
      <Link href={listHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back</Link>
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Section title="Workout">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow label="Name" error={errs.name} className="sm:col-span-2">{(i) => <Input id={i} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push day A" />}</FormRow>
              {!forceTemplate && <FormRow label="Type">{(i) => <Select id={i} value={isTemplate ? 'T' : 'C'} onChange={(e) => setIsTemplate(e.target.value === 'T')}><option value="C">For a client</option><option value="T">Reusable template</option></Select>}</FormRow>}
              {!isTemplate && <FormRow label="Client" error={errs.clientId}>{(i) => <Select id={i} value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Choose…</option>{(clients.data?.items ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</FormRow>}
              {!isTemplate && <FormRow label="Date">{(i) => <Input id={i} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</FormRow>}
              <FormRow label="Estimated minutes">{(i) => <Input id={i} type="number" min={5} max={300} value={estMin} onChange={(e) => setEstMin(e.target.value)} />}</FormRow>
              <FormRow label="Notes" className="sm:col-span-2">{(i) => <Textarea id={i} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Goals for the session, injury cautions…" />}</FormRow>
            </div>
            {errs.exercises && <p role="alert" className="mt-3 text-sm text-destructive">{errs.exercises}</p>}
          </Section>

          {SECTIONS.map(([section, label]) => (
            <Section key={section} title={label} description={`${bySection[section].length} exercise${bySection[section].length === 1 ? '' : 's'}`} action={<Button size="sm" variant="outline" onClick={() => setPick(section)}><Plus /> Add</Button>}>
              {bySection[section].length === 0 ? <p className="text-sm text-muted-foreground">Nothing here yet.</p> : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd(section)}>
                  <SortableContext items={bySection[section].map((r) => r.key)} strategy={verticalListSortingStrategy}>
                    <ul className="space-y-2.5">{bySection[section].map((r) => <SortableRow key={r.key} row={r} onChange={(p) => patch(r.key, p)} onRemove={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} errors={undefined} />)}</ul>
                  </SortableContext>
                </DndContext>
              )}
            </Section>
          ))}
        </div>
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <Section title="Summary">
            <p className="font-display text-4xl font-bold">{total}<span className="ml-1 text-base font-medium text-muted-foreground">exercises</span></p>
            <p className="mt-1 text-sm text-muted-foreground">{rows.reduce((t, r) => t + (Number(r.sets) || 0), 0)} total sets</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button loading={busy} onClick={() => void save()}>Save {isTemplate ? 'template' : 'workout'}</Button>
              {id && isTemplate && <Button variant="outline" onClick={() => setAssign(true)}><Send /> Assign to clients</Button>}
            </div>
            {id && !isTemplate && existing.data?.status === 'DRAFT' && <p className="mt-3 text-xs text-muted-foreground">Draft workouts are hidden from the client. Assigning from a template makes them visible.</p>}
            <p className="mt-3 text-xs text-muted-foreground">Drag the handle to reorder inside a section. Workouts that already have logged sets can’t be edited — duplicate them instead.</p>
          </Section>
        </aside>
      </div>
      <Modal open={pick !== null} onClose={() => setPick(null)} title="Add exercise" wide>{pick && <ExercisePicker onPick={(e) => { setRows((rs) => [...rs, rowFromExercise(e, pick)]); setPick(null); }} />}</Modal>
      {id && <AssignWorkoutModal workoutId={id} open={assign} onClose={() => setAssign(false)} />}
    </div>
  );
}

// ───────────────────────── templates + per-client list
export function WorkoutTemplatesPage({ builderBase }: { builderBase: string }) {
  const { data, error, loading, reload } = useApi<{ items: WorkoutSummary[] }>('/workouts?template=true');
  const [assignId, setAssignId] = useState<string | null>(null);
  const { run } = useAction();
  const router = useRouter();
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  return (
    <div>
      <PageHeader description="Save a workout once, assign it to anyone." actions={<Link href={`${builderBase}/new?template=1`} className={cn(buttonVariants())}><Plus /> New template</Link>} />
      {loading || !data ? <Skeleton className="h-56" /> : data.items.length === 0 ? <EmptyState icon={ClipboardList} title="No templates yet" action={<Link href={`${builderBase}/new?template=1`} className={cn(buttonVariants())}><Plus /> New template</Link>} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((w) => (
            <div key={w.id} className="surface-card flex flex-col gap-3 p-5">
              <Link href={`${builderBase}/${w.id}`} className="font-display font-semibold hover:text-primary">{w.name}</Link>
              <p className="text-sm text-muted-foreground">{w.exerciseCount} exercises{w.estimatedMin ? ` · ~${w.estimatedMin} min` : ''}</p>
              <div className="mt-auto flex flex-wrap gap-2">
                <Link href={`${builderBase}/${w.id}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>Edit</Link>
                <Button size="sm" variant="ghost" onClick={() => setAssignId(w.id)}><Send /> Assign</Button>
                <Button size="sm" variant="ghost" aria-label="Duplicate" onClick={async () => { const c = await run(() => post<WorkoutDto>(`/workouts/${w.id}/duplicate`), 'Duplicated'); if (c) router.push(`${builderBase}/${c.id}`); }}><Copy /></Button>
                <ConfirmButton variant="ghost" label="Delete?" onConfirm={async () => { if (await run(() => del(`/workouts/${w.id}`), 'Template deleted')) reload(); }}><Trash2 className="size-4" /></ConfirmButton>
              </div>
            </div>
          ))}
        </div>
      )}
      {assignId && <AssignWorkoutModal workoutId={assignId} open onClose={() => setAssignId(null)} />}
    </div>
  );
}

/** Trainer "Workout Builder" landing page: all the client workouts, newest first, plus a new-workout button. */
export function WorkoutsIndexPage({ builderBase }: { builderBase: string }) {
  const [clientId, setClientId] = useState('');
  const clients = useClients();
  const { data, error, loading, reload } = useApi<{ items: WorkoutSummary[] }>(`/workouts?template=false${clientId ? `&clientId=${clientId}` : ''}`);
  const { run } = useAction();
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  return (
    <div>
      <PageHeader description="Drag-and-drop workouts with sets, reps, weight, rest, tempo, supersets and dropsets." actions={<><Select aria-label="Client" className="h-10 w-52" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">All clients</option>{(clients.data?.items ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select><Link href={`${builderBase}/new${clientId ? `?clientId=${clientId}` : ''}`} className={cn(buttonVariants())}><Plus /> New workout</Link></>} />
      {loading || !data ? <Skeleton className="h-56" /> : data.items.length === 0 ? <EmptyState icon={ClipboardList} title="No workouts yet" description="Build your first workout for a client." action={<Link href={`${builderBase}/new`} className={cn(buttonVariants())}><Plus /> New workout</Link>} /> : (
        <div className="surface-card overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="p-4 font-medium">Workout</th><th className="p-4 font-medium">Client</th><th className="p-4 font-medium">Date</th><th className="p-4 font-medium">Status</th><th /></tr></thead>
          <tbody className="divide-y divide-white/[0.05]">{data.items.map((w) => (
            <tr key={w.id}><td className="p-4"><Link href={`${builderBase}/${w.id}`} className="font-medium hover:text-primary">{w.name}</Link><span className="block text-xs text-muted-foreground">{w.exerciseCount} exercises</span></td><td className="p-4 text-muted-foreground">{w.clientName ?? '—'}</td><td className="p-4 text-muted-foreground">{fmtDate(w.scheduledDate)}</td><td className="p-4"><Badge variant={statusVariant(w.status)}>{titleCase(w.status)}</Badge></td>
              <td className="p-4 text-right"><ConfirmButton variant="ghost" label="Delete?" onConfirm={async () => { if (await run(() => del(`/workouts/${w.id}`), 'Workout deleted')) reload(); }}><Trash2 className="size-4" /></ConfirmButton></td></tr>
          ))}</tbody></table></div>
      )}
    </div>
  );
}

// ───────────────────────── calendar
export function WorkoutCalendarPage({ builderBase }: { builderBase: string }) {
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)); });
  const [clientId, setClientId] = useState('');
  const [selected, setSelected] = useState<string | null>(today());
  const clients = useClients();
  const from = cursor.toISOString().slice(0, 10);
  const to = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  const { data, error, loading, reload } = useApi<{ items: WorkoutSummary[] }>(`/workouts?template=false&from=${from}&to=${to}${clientId ? `&clientId=${clientId}` : ''}`);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [moveDate, setMoveDate] = useState(today());
  const { busy, run } = useAction();
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const first = (cursor.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => { const d = i - first + 1; return d >= 1 && d <= days ? new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), d)).toISOString().slice(0, 10) : null; });
  const byDay = new Map<string, WorkoutSummary[]>();
  (data?.items ?? []).forEach((w) => { if (w.scheduledDate) byDay.set(w.scheduledDate, [...(byDay.get(w.scheduledDate) ?? []), w]); });
  const dayItems = selected ? byDay.get(selected) ?? [] : [];

  const reschedule = async () => {
    if (!moveId) return;
    const full = await run(() => api<WorkoutDto>(`/workouts/${moveId}`));
    if (!full) return;
    const r = await run(() => put(`/workouts/${moveId}`, { name: full.name, clientId: full.clientId ?? undefined, isTemplate: false, scheduledDate: moveDate, estimatedMin: full.estimatedMin ?? undefined, notes: full.notes ?? undefined, exercises: full.exercises.map((e) => ({ exerciseId: e.exerciseId ?? undefined, customName: e.exerciseId ? undefined : e.name, section: e.section, sets: e.sets, reps: e.reps, weightKg: e.weightKg, restSec: e.restSec, tempo: e.tempo, technique: e.technique, supersetGroup: e.supersetGroup, notes: e.notes })) }), 'Workout moved');
    if (r !== null) { setMoveId(null); reload(); }
  };

  return (
    <div>
      <PageHeader description="See what’s scheduled across your clients and move sessions around." actions={<Select aria-label="Client" className="h-10 w-52" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">All clients</option>{(clients.data?.items ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Section title={cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })} action={<div className="flex gap-1"><Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1)))}><ChevronLeft /></Button><Button size="icon" variant="ghost" aria-label="Next month" onClick={() => setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)))}><ChevronRight /></Button></div>}>
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs uppercase tracking-wider text-muted-foreground">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="pb-1">{d}</div>)}</div>
          <div className={cn('grid grid-cols-7 gap-1.5', loading && 'opacity-60')}>
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const items = byDay.get(d) ?? [];
              return (
                <button key={d} onClick={() => setSelected(d)} aria-label={`${fmtDate(d)}, ${items.length} workouts`} className={cn('flex min-h-[72px] flex-col rounded-lg border p-1.5 text-left transition-colors hover:border-primary/40', selected === d ? 'border-primary bg-primary/[0.08]' : 'border-white/[0.06]', d === today() && 'ring-1 ring-primary/40')}>
                  <span className="text-xs font-semibold">{Number(d.slice(8))}</span>
                  <span className="mt-auto flex flex-wrap gap-0.5">{items.slice(0, 4).map((w) => <span key={w.id} className={cn('size-2 rounded-full', w.status === 'COMPLETED' ? 'bg-good' : w.status === 'SKIPPED' ? 'bg-attention' : w.status === 'IN_PROGRESS' ? 'bg-primary' : 'bg-monitor')} />)}{items.length > 4 && <span className="text-[10px] text-muted-foreground">+{items.length - 4}</span>}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground"><span><span className="mr-1 inline-block size-2 rounded-full bg-monitor" />scheduled</span><span><span className="mr-1 inline-block size-2 rounded-full bg-good" />completed</span><span><span className="mr-1 inline-block size-2 rounded-full bg-attention" />skipped</span></p>
        </Section>
        <Section title={selected ? fmtDate(selected) : 'Pick a day'} action={selected && <Link href={`${builderBase}/new?date=${selected}${clientId ? `&clientId=${clientId}` : ''}`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}><Plus /> Add</Link>}>
          {dayItems.length === 0 ? <EmptyState icon={CalendarDays} title="Nothing scheduled" /> : (
            <ul className="space-y-3">{dayItems.map((w) => (
              <li key={w.id} className="rounded-lg border border-white/[0.06] p-3"><div className="flex items-start justify-between gap-2"><div><Link href={`${builderBase}/${w.id}`} className="font-medium hover:text-primary">{w.name}</Link><p className="text-xs text-muted-foreground">{w.clientName}</p></div><Badge variant={statusVariant(w.status)}>{titleCase(w.status)}</Badge></div>
                {w.status === 'ASSIGNED' && <Button size="sm" variant="ghost" className="mt-2" onClick={() => { setMoveId(w.id); setMoveDate(w.scheduledDate ?? today()); }}><Link2 /> Reschedule</Button>}</li>
            ))}</ul>
          )}
        </Section>
      </div>
      <Modal open={moveId !== null} onClose={() => setMoveId(null)} title="Reschedule workout"><div className="space-y-4"><FormRow label="New date">{(id) => <Input id={id} type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />}</FormRow><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setMoveId(null)}>Cancel</Button><Button loading={busy} onClick={() => void reschedule()}>Move</Button></div></div></Modal>
    </div>
  );
}
