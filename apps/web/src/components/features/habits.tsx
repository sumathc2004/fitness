'use client';

import { useState } from 'react';
import { Droplets, Footprints, Heart, Moon, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '@/lib/use-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress, Skeleton } from '@/components/ui/misc';
import { EmptyState, ErrorState, Section } from '@/components/dashboard/primitives';
import { del, FormRow, fmtTime, PageHeader, put, post, Select, Textarea, today, useAction, num, Chip } from '@/components/kit/kit';

interface DaySummary {
  date: string;
  water: { totalMl: number; targetMl: number; entries: Array<{ id: string; amountMl: number; at: string }> };
  sleep: { hours: number; quality: number | null; notes: string | null } | null;
  habits: Array<{ key: string; label: string; unit: string | null; target: number | null; completed: boolean; value: number | null }>;
}
interface HistoryRow { date: string; waterMl: number; sleepHours: number | null; steps: number | null }

function HistoryChart({ rows, field, unit, color }: { rows: HistoryRow[]; field: 'waterMl' | 'sleepHours' | 'steps'; unit: string; color: string }) {
  const data = rows.map((r) => ({ label: new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: r[field] ?? 0 }));
  if (data.every((d) => d.value === 0)) return <EmptyState icon={Heart} title="Nothing logged yet" description="The last 14 days will chart here." />;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="hsl(0 0% 100% / 0.05)" />
        <XAxis dataKey="label" stroke="hsl(215 10% 40%)" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis stroke="hsl(215 10% 40%)" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: 'hsl(0 0% 100% / 0.04)' }} contentStyle={{ background: 'hsl(var(--elevated))', border: '1px solid hsl(0 0% 100% / 0.1)', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} ${unit}`, '']} separator="" />
        <Bar dataKey="value" fill={color} radius={[5, 5, 2, 2]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function useDay(clientId?: string | null) {
  const qs = clientId ? `&clientId=${clientId}` : '';
  const day = useApi<DaySummary>(`/habits?date=${today()}${qs}`);
  const hist = useApi<{ items: HistoryRow[] }>(`/habits/history?days=14${qs}`);
  return { day, hist, reloadAll: () => { day.reload(); hist.reload(); } };
}

export function WaterPage() {
  const { day, hist, reloadAll } = useDay();
  const { busy, run } = useAction();
  const [custom, setCustom] = useState('');
  const add = async (ml: number) => { if (await run(() => post('/habits/water', { date: today(), amountMl: ml }))) { setCustom(''); reloadAll(); } };
  if (day.error) return <ErrorState message={day.error.message} onRetry={day.reload} />;
  const w = day.data?.water;
  return (
    <div className="space-y-6">
      <PageHeader description="Log water through the day against your target." />
      <Section title="Today">
        {!w ? <Skeleton className="h-40" /> : (
          <div className="space-y-5">
            <div><div className="mb-2 flex items-baseline justify-between"><span className="font-display text-4xl font-bold tabular-nums">{(w.totalMl / 1000).toFixed(2)} <span className="text-lg font-medium text-muted-foreground">/ {(w.targetMl / 1000).toFixed(1)} L</span></span><span className="text-sm text-muted-foreground">{Math.round((w.totalMl / w.targetMl) * 100)}%</span></div><Progress value={w.totalMl} max={w.targetMl} label="Water" barClassName="bg-chart-2" /></div>
            <div className="flex flex-wrap items-end gap-2">
              {[250, 500, 750].map((ml) => <Button key={ml} variant="outline" loading={busy} onClick={() => void add(ml)}><Droplets /> +{ml} ml</Button>)}
              <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); const v = num(custom); if (v) void add(v); }}>
                <FormRow label="Custom (ml)">{(id) => <Input id={id} type="number" inputMode="numeric" min={50} max={3000} value={custom} onChange={(e) => setCustom(e.target.value)} className="w-28" />}</FormRow>
                <Button type="submit" variant="secondary" disabled={!num(custom)}>Add</Button>
              </form>
            </div>
            {w.entries.length > 0 && <ul className="divide-y divide-white/[0.05] text-sm">{w.entries.map((e) => <li key={e.id} className="flex items-center justify-between py-2"><span>{e.amountMl} ml <span className="text-muted-foreground">· {fmtTime(e.at)}</span></span><button aria-label="Remove entry" className="text-muted-foreground hover:text-destructive" onClick={async () => { if (await run(() => del(`/habits/water/${e.id}`))) reloadAll(); }}><Trash2 className="size-4" /></button></li>)}</ul>}
          </div>
        )}
      </Section>
      <Section title="Last 14 days">{hist.data ? <HistoryChart rows={hist.data.items} field="waterMl" unit="ml" color="hsl(var(--chart-2))" /> : <Skeleton className="h-48" />}</Section>
    </div>
  );
}

export function SleepPage() {
  const { day, hist, reloadAll } = useDay();
  const { busy, run } = useAction();
  const [hours, setHours] = useState('');
  const [quality, setQuality] = useState('');
  const [notes, setNotes] = useState('');
  const s = day.data?.sleep;
  if (day.error) return <ErrorState message={day.error.message} onRetry={day.reload} />;
  return (
    <div className="space-y-6">
      <PageHeader description="Log last night’s sleep." />
      <Section title="Last night" description={s ? `Logged: ${s.hours} h${s.quality ? ` · quality ${s.quality}/5` : ''}` : 'Nothing logged yet today.'}>
        <form className="grid gap-4 sm:grid-cols-3" onSubmit={async (e) => { e.preventDefault(); const h = num(hours); if (h && await run(() => put('/habits/sleep', { date: today(), hours: h, quality: num(quality), notes: notes || null }), 'Sleep saved')) { setHours(''); setNotes(''); reloadAll(); } }}>
          <FormRow label="Hours slept">{(id) => <Input id={id} type="number" step="0.25" min={0.5} max={20} required value={hours} onChange={(e) => setHours(e.target.value)} placeholder={s ? String(s.hours) : '7.5'} />}</FormRow>
          <FormRow label="Quality">{(id) => <Select id={id} value={quality} onChange={(e) => setQuality(e.target.value)}><option value="">—</option>{[1, 2, 3, 4, 5].map((q) => <option key={q} value={q}>{q} / 5</option>)}</Select>}</FormRow>
          <FormRow label="Notes">{(id) => <Textarea id={id} className="min-h-[44px] h-11" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />}</FormRow>
          <Button type="submit" loading={busy} className="sm:col-span-3 sm:w-fit"><Moon /> Save sleep</Button>
        </form>
      </Section>
      <Section title="Last 14 days">{hist.data ? <HistoryChart rows={hist.data.items} field="sleepHours" unit="h" color="hsl(var(--chart-4))" /> : <Skeleton className="h-48" />}</Section>
    </div>
  );
}

export function HabitsPage() {
  const { day, hist, reloadAll } = useDay();
  const { run } = useAction();
  const [vals, setVals] = useState<Record<string, string>>({});
  if (day.error) return <ErrorState message={day.error.message} onRetry={day.reload} />;
  const save = async (key: string, body: { completed?: boolean; value?: number | null }) => { if (await run(() => put('/habits/habit', { date: today(), habitKey: key, ...body }))) reloadAll(); };
  return (
    <div className="space-y-6">
      <PageHeader description="Small daily habits compound. Tick them off or log the number." />
      <Section title="Today">
        {!day.data ? <Skeleton className="h-40" /> : (
          <ul className="divide-y divide-white/[0.05]">
            {day.data.habits.map((h) => (
              <li key={h.key} className="flex flex-wrap items-center gap-3 py-3.5">
                <span className={`grid size-9 place-items-center rounded-md ${h.completed ? 'bg-good/15 text-good' : 'bg-white/[0.05] text-muted-foreground'}`}><Footprints className="size-[18px]" /></span>
                <div className="min-w-0 flex-1"><p className="font-medium">{h.label}</p><p className="text-xs text-muted-foreground">{h.target ? `Target ${h.target.toLocaleString()} ${h.unit ?? ''}` : 'Done / not done'}{h.value != null ? ` · logged ${h.value.toLocaleString()}` : ''}</p></div>
                {h.target != null ? (
                  <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = num(vals[h.key] ?? ''); if (v !== null) { void save(h.key, { value: v }); setVals((s) => ({ ...s, [h.key]: '' })); } }}>
                    <Input type="number" inputMode="numeric" min={0} aria-label={`${h.label} value`} className="h-9 w-28" value={vals[h.key] ?? ''} onChange={(e) => setVals((s) => ({ ...s, [h.key]: e.target.value }))} placeholder={h.unit ?? ''} />
                    <Button type="submit" size="sm" variant="secondary">Log</Button>
                  </form>
                ) : (
                  <Chip active={h.completed} onClick={() => void save(h.key, { completed: !h.completed })}>{h.completed ? 'Done ✓' : 'Mark done'}</Chip>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Steps · last 14 days">{hist.data ? <HistoryChart rows={hist.data.items} field="steps" unit="steps" color="hsl(var(--chart-1))" /> : <Skeleton className="h-48" />}</Section>
    </div>
  );
}

export function HabitsOverview({ clientId }: { clientId: string }) {
  const { day, hist } = useDay(clientId);
  if (day.error) return <ErrorState message={day.error.message} onRetry={day.reload} />;
  const d = day.data;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Section title="Water">{hist.data ? <HistoryChart rows={hist.data.items} field="waterMl" unit="ml" color="hsl(var(--chart-2))" /> : <Skeleton className="h-48" />}<p className="mt-2 text-xs text-muted-foreground">Today: {d ? `${d.water.totalMl} / ${d.water.targetMl} ml` : '…'}</p></Section>
      <Section title="Sleep">{hist.data ? <HistoryChart rows={hist.data.items} field="sleepHours" unit="h" color="hsl(var(--chart-4))" /> : <Skeleton className="h-48" />}<p className="mt-2 text-xs text-muted-foreground">Last logged: {d?.sleep ? `${d.sleep.hours} h` : 'nothing today'}</p></Section>
      <Section title="Steps">{hist.data ? <HistoryChart rows={hist.data.items} field="steps" unit="steps" color="hsl(var(--chart-1))" /> : <Skeleton className="h-48" />}<p className="mt-2 text-xs text-muted-foreground">Today: {d?.habits.find((h) => h.key === 'steps')?.value?.toLocaleString() ?? 'not logged'}</p></Section>
    </div>
  );
}
