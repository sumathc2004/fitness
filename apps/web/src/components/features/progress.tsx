'use client';

import { useMemo, useRef, useState } from 'react';
import { Camera, ImageIcon, LineChart as LineIcon, Ruler, Trash2, Trophy } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '@/lib/use-api';
import { timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, Skeleton } from '@/components/ui/misc';
import { EmptyState, ErrorState, RateRing, Section } from '@/components/dashboard/primitives';
import { ConfirmButton, FormRow, fmtDate, PageHeader, post, Select, Textarea, titleCase, useAction, WithClient, withQs, del, num, Chip } from '@/components/kit/kit';

interface Point { date: string; value: number }
interface Summary {
  weight: { series: Point[]; changeKg: number | null }; waist: Point[]; chest: Point[]; arm: Point[];
  bodyFat: { isEstimate: true; series: Point[]; changePct: number | null }; leanMass: Point[];
  records: Array<{ exercise: string; weightKg: number; reps: number; oneRepMax: number; at: string | null }>;
  compliance: { workout: number | null; diet: number | null; sessions90d: number };
}

export function TrendChart({ data, unit, color = 'hsl(var(--chart-1))' }: { data: Point[]; unit: string; color?: string }) {
  const rows = data.map((d) => ({ label: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: d.value }));
  const vals = rows.map((r) => r.value);
  const min = Math.floor(Math.min(...vals) - 1);
  const max = Math.ceil(Math.max(...vals) + 1);
  return (
    <ResponsiveContainer width="100%" height={190}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="hsl(0 0% 100% / 0.05)" />
        <XAxis dataKey="label" stroke="hsl(215 10% 40%)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="hsl(215 10% 40%)" fontSize={12} tickLine={false} axisLine={false} domain={[min, max]} />
        <Tooltip contentStyle={{ background: 'hsl(var(--elevated))', border: '1px solid hsl(0 0% 100% / 0.1)', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} ${unit}`, '']} separator="" />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} isAnimationActive={false} dot={{ r: 3, fill: 'hsl(var(--background))', stroke: color, strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChartCard({ title, data, unit, note, delta, color }: { title: string; data: Point[]; unit: string; note?: string; delta?: number | null; color?: string }) {
  return (
    <Section title={title} description={note} action={delta != null ? <Badge variant={delta === 0 ? 'muted' : 'primary'}>{delta > 0 ? '+' : ''}{delta} {unit}</Badge> : undefined}>
      {data.length < 2 ? <EmptyState icon={LineIcon} title="Not enough data" description={data.length === 1 ? 'One more entry will draw the trend.' : 'Entries will appear here as they are logged.'} /> : <TrendChart data={data} unit={unit} color={color} />}
    </Section>
  );
}

const monday = () => { const d = new Date(); const day = (d.getUTCDay() + 6) % 7; return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)); };
const iso = (d: Date) => d.toISOString().slice(0, 10);

function ReviewBox({ clientId, canReview }: { clientId?: string; canReview: boolean }) {
  const [period, setPeriod] = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const range = useMemo(() => {
    if (period === 'WEEKLY') { const s = monday(); return { start: iso(s), end: iso(new Date(s.getTime() + 6 * 86400000)) }; }
    const n = new Date();
    return { start: iso(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1))), end: iso(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 0))) };
  }, [period]);
  const qs = `period=${period}&start=${range.start}${clientId ? `&clientId=${clientId}` : ''}`;
  const { data, reload } = useApi<{ review: { trainerComment: string | null; reviewedAt: string | null } | null }>(`/progress/review?${qs}`);
  const [text, setText] = useState('');
  const { busy, run } = useAction();
  const existing = data?.review?.trainerComment;
  return (
    <Section title="Trainer review" description={`${titleCase(period)} · ${fmtDate(range.start)} – ${fmtDate(range.end)}`} action={<div className="flex gap-2"><Chip active={period === 'WEEKLY'} onClick={() => setPeriod('WEEKLY')}>This week</Chip><Chip active={period === 'MONTHLY'} onClick={() => setPeriod('MONTHLY')}>This month</Chip></div>}>
      {existing ? <p className="whitespace-pre-wrap text-sm">{existing}<span className="mt-2 block text-xs text-muted-foreground">Reviewed {timeAgo(data?.review?.reviewedAt)}</span></p> : !canReview && <p className="text-sm text-muted-foreground">Your trainer hasn’t reviewed this period yet.</p>}
      {canReview && clientId && (
        <div className="mt-3 space-y-3">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={existing ? 'Update your comment…' : 'Write feedback for the client — they will be notified.'} />
          <div className="flex justify-end"><Button size="sm" loading={busy} disabled={!text.trim()} onClick={async () => { if (await run(() => post('/progress/review', { clientId, period, periodStart: range.start, periodEnd: range.end, trainerComment: text.trim() }), 'Review sent')) { setText(''); reload(); } }}>Send review</Button></div>
        </div>
      )}
    </Section>
  );
}

export function ProgressView({ clientId, canReview = false }: { clientId?: string | null; canReview?: boolean }) {
  const qs = clientId ? `?clientId=${clientId}` : '';
  const { data: s, error, loading, reload } = useApi<Summary>(`/progress/summary${qs}`);
  const feed = useApi<{ items: Array<{ id: string; type: string; at: string }> }>(`/progress/activity${qs}`);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !s) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Compliance · last 90 days" className="lg:col-span-1">
          <div className="flex justify-around"><RateRing value={s.compliance.workout} label="Workouts" /><RateRing value={s.compliance.diet} label="Meals" /></div>
          <p className="mt-4 text-center text-xs text-muted-foreground">{s.compliance.sessions90d} sessions completed</p>
        </Section>
        <div className="grid gap-6 lg:col-span-2"><ChartCard title="Body weight" data={s.weight.series} unit="kg" delta={s.weight.changeKg} /></div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <ChartCard title="Waist" data={s.waist} unit="cm" color="hsl(var(--chart-2))" />
        <ChartCard title="Body fat (estimated)" note="US Navy estimate from tape measurements — not a medical measurement." data={s.bodyFat.series} unit="%" delta={s.bodyFat.changePct} color="hsl(var(--chart-3))" />
        <ChartCard title="Lean mass (estimated)" data={s.leanMass} unit="kg" color="hsl(var(--chart-4))" />
        <ChartCard title="Chest" data={s.chest} unit="cm" color="hsl(var(--chart-5))" />
      </div>
      <Section title="Personal records" description="Best estimated one-rep max per exercise (Epley).">
        {s.records.length === 0 ? <EmptyState icon={Trophy} title="No records yet" description="Log sets in a workout and your best lifts will show up here." /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="pb-2 font-medium">Exercise</th><th className="pb-2 font-medium">Best set</th><th className="pb-2 font-medium">Est. 1RM</th><th className="pb-2 font-medium">When</th></tr></thead>
            <tbody className="divide-y divide-white/[0.05]">{s.records.map((r) => <tr key={r.exercise}><td className="py-2.5 font-medium">{r.exercise}</td><td className="py-2.5 text-muted-foreground">{r.weightKg} kg × {r.reps}</td><td className="py-2.5 font-semibold text-primary">{r.oneRepMax} kg</td><td className="py-2.5 text-muted-foreground">{fmtDate(r.at)}</td></tr>)}</tbody></table></div>
        )}
      </Section>
      <ReviewBox clientId={clientId ?? undefined} canReview={canReview} />
      <Section title="Recent activity">
        {!feed.data || feed.data.items.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : <ul className="space-y-2 text-sm">{feed.data.items.slice(0, 12).map((a) => <li key={a.id} className="flex justify-between"><span>{titleCase(a.type)}</span><span className="text-muted-foreground">{timeAgo(a.at)}</span></li>)}</ul>}
      </Section>
    </div>
  );
}

export function ProgressPage({ isClient }: { isClient: boolean }) {
  return (
    <div>
      <PageHeader description="Trends, personal records and trainer feedback." />
      <WithClient isClient={isClient}>{(id) => <ProgressView clientId={id} canReview={!isClient} />}</WithClient>
    </div>
  );
}

// ───────────────────────── measurements
interface Measurement { id: string; measuredAt: string; weightKg: number | null; waistCm: number | null; neckCm: number | null; hipCm: number | null; chestCm: number | null; shoulderCm: number | null; armCm: number | null; thighCm: number | null; notes: string | null }
const FIELDS: Array<[keyof Measurement, string]> = [['weightKg', 'Weight (kg)'], ['waistCm', 'Waist (cm)'], ['neckCm', 'Neck (cm)'], ['hipCm', 'Hip (cm)'], ['chestCm', 'Chest (cm)'], ['shoulderCm', 'Shoulders (cm)'], ['armCm', 'Arm (cm)'], ['thighCm', 'Thigh (cm)']];

function MeasurementsView({ qs }: { qs: string }) {
  const { data, error, loading, reload } = useApi<{ items: Measurement[] }>(withQs('/progress/measurements', qs));
  const { busy, run } = useAction();
  const [f, setF] = useState<Record<string, string>>({});
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, number | string> = {};
    for (const [k] of FIELDS) { const v = num(f[k as string] ?? ''); if (v !== null) body[k as string] = v; }
    if (f.notes) body.notes = f.notes;
    if (await run(() => post(withQs('/progress/measurements', qs), body), 'Measurement saved')) { setF({}); reload(); }
  };
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Section title="Log measurements" description="Fill in only what you measured.">
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          {FIELDS.map(([k, label]) => <FormRow key={k} label={label}>{(id) => <Input id={id} type="number" step="0.1" inputMode="decimal" value={f[k as string] ?? ''} onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))} />}</FormRow>)}
          <FormRow label="Notes" className="col-span-2">{(id) => <Input id={id} value={f.notes ?? ''} onChange={(e) => setF((s) => ({ ...s, notes: e.target.value }))} maxLength={500} />}</FormRow>
          <Button type="submit" className="col-span-2" loading={busy}>Save measurement</Button>
        </form>
      </Section>
      <Section title="History">
        {loading || !data ? <Skeleton className="h-48" /> : data.items.length === 0 ? <EmptyState icon={Ruler} title="No measurements yet" description="Your first entry starts the trend lines." /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="pb-2 font-medium">Date</th>{FIELDS.map(([k, l]) => <th key={k} className="pb-2 font-medium">{l.split(' ')[0]}</th>)}<th /></tr></thead>
            <tbody className="divide-y divide-white/[0.05]">{data.items.map((m) => (
              <tr key={m.id}><td className="py-2.5 text-muted-foreground">{fmtDate(m.measuredAt)}</td>{FIELDS.map(([k]) => <td key={k} className="py-2.5 tabular-nums">{(m[k] as number | null) ?? '—'}</td>)}
                <td className="py-2.5 text-right"><ConfirmButton variant="ghost" label="Delete?" onConfirm={async () => { if (await run(() => del(`/progress/measurements/${m.id}`), 'Deleted')) reload(); }}><Trash2 className="size-4" /></ConfirmButton></td></tr>
            ))}</tbody></table></div>
        )}
      </Section>
    </div>
  );
}

export function MeasurementsPage({ isClient }: { isClient: boolean }) {
  return (<div><PageHeader description="Weight and tape measurements feed your body analysis and progress charts." /><WithClient isClient={isClient}>{(_id, qs) => <MeasurementsView qs={qs} />}</WithClient></div>);
}

// ───────────────────────── photos
interface Photo { id: string; takenAt: string; angle: string; url: string; weightKg: number | null; notes: string | null }

function PhotosView({ qs }: { qs: string }) {
  const { data, error, loading, reload } = useApi<{ items: Photo[] }>(withQs('/progress/photos', qs));
  const { busy, run } = useAction();
  const [angle, setAngle] = useState('FRONT');
  const [compare, setCompare] = useState<[string | null, string | null]>([null, null]);
  const input = useRef<HTMLInputElement>(null);
  const upload = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file); fd.append('angle', angle);
    const r = await run(async () => {
      const res = await fetch(withQs('/api/progress/photos', qs), { method: 'POST', body: fd, credentials: 'same-origin' });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw Object.assign(new Error(), { message: j?.error?.message ?? 'Upload failed' });
      return j;
    }, 'Photo added');
    if (r) reload();
  };
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  const items = data?.items ?? [];
  const a = items.find((p) => p.id === compare[0]);
  const b = items.find((p) => p.id === compare[1]);
  const pick = (id: string) => setCompare(([x, y]) => (x === id ? [null, y] : y === id ? [x, null] : !x ? [id, y] : !y ? [x, id] : [id, null]));
  return (
    <div className="space-y-6">
      <Section title="Add a photo" description="Photos are private — only you, your trainer and the gym admin can see them. JPG, PNG or WebP up to 8 MB.">
        <div className="flex flex-wrap items-end gap-3">
          <FormRow label="Angle">{(id) => <Select id={id} value={angle} onChange={(e) => setAngle(e.target.value)} className="w-40">{['FRONT', 'SIDE', 'BACK', 'OTHER'].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</Select>}</FormRow>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
          <Button loading={busy} onClick={() => input.current?.click()}><Camera /> Choose photo</Button>
        </div>
      </Section>
      {(a || b) && (
        <Section title="Compare" description="Pick two photos below.">
          <div className="grid grid-cols-2 gap-3">{[a, b].map((p, i) => <div key={i} className="overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]">{p ? <><img src={p.url} alt={`${p.angle} ${fmtDate(p.takenAt)}`} className="aspect-[3/4] w-full object-cover" /><p className="p-2 text-center text-xs text-muted-foreground">{fmtDate(p.takenAt)}{p.weightKg ? ` · ${p.weightKg} kg` : ''}</p></> : <div className="grid aspect-[3/4] place-items-center text-sm text-muted-foreground">Pick a photo</div>}</div>)}</div>
        </Section>
      )}
      <Section title="Gallery">
        {loading ? <Skeleton className="h-48" /> : items.length === 0 ? <EmptyState icon={ImageIcon} title="No photos yet" description="Front, side and back photos taken monthly make the best comparison." /> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((p) => (
              <figure key={p.id} className={`group relative overflow-hidden rounded-lg border ${compare.includes(p.id) ? 'border-primary' : 'border-white/[0.06]'}`}>
                <button onClick={() => pick(p.id)} className="block w-full" aria-label={`Select ${p.angle} photo from ${fmtDate(p.takenAt)}`}><img src={p.url} alt={`${p.angle} ${fmtDate(p.takenAt)}`} loading="lazy" className="aspect-[3/4] w-full object-cover" /></button>
                <figcaption className="flex items-center justify-between p-2 text-xs text-muted-foreground"><span>{titleCase(p.angle)} · {fmtDate(p.takenAt)}</span>
                  <ConfirmButton variant="ghost" label="Delete?" onConfirm={async () => { if (await run(() => del(`/progress/photos/${p.id}`), 'Photo deleted')) { setCompare([null, null]); reload(); } }}><Trash2 className="size-3.5" /></ConfirmButton></figcaption>
              </figure>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

export function PhotosPage({ isClient }: { isClient: boolean }) {
  return (<div><PageHeader /><WithClient isClient={isClient}>{(_id, qs) => <PhotosView qs={qs} />}</WithClient></div>);
}

