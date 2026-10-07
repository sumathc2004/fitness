'use client';

import { useEffect, useState } from 'react';
import { Check, Plus, SkipForward, Trash2, Undo2, Utensils } from 'lucide-react';
import type { DailyMealDto, DailyNutritionDto, FoodDto, Macros } from '@gym/types';
import { useApi } from '@/lib/use-api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, Progress, Skeleton } from '@/components/ui/misc';
import { EmptyState, ErrorState, Section } from '@/components/dashboard/primitives';
import { del, FormRow, Modal, PageHeader, post, put, SearchBox, Select, titleCase, today, useAction, num } from '@/components/kit/kit';

export interface PickedItem { foodItemId?: string; foodServingId?: string; customName?: string; quantity: number; name: string; servingLabel?: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number }

/** Search the food database, choose a serving and quantity — or enter a custom food by hand. */
export function FoodPicker({ onPick, onDone }: { onPick: (i: PickedItem) => void; onDone?: () => void }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [custom, setCustom] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 250); return () => clearTimeout(t); }, [q]);
  const { data, loading } = useApi<{ items: FoodDto[] }>(`/foods?limit=30${debounced ? `&q=${encodeURIComponent(debounced)}` : ''}`);
  const [sel, setSel] = useState<{ food: FoodDto; servingId: string; qty: string } | null>(null);
  const [c, setC] = useState({ name: '', calories: '', proteinG: '', carbsG: '', fatG: '' });

  const add = () => {
    if (!sel) return;
    const s = sel.food.servings.find((x) => x.id === sel.servingId) ?? sel.food.servings[0]!;
    const quantity = num(sel.qty) ?? 1;
    onPick({ foodItemId: sel.food.id, foodServingId: s.id, quantity, name: sel.food.name, servingLabel: s.label, calories: Math.round(s.calories * quantity), proteinG: Math.round(s.proteinG * quantity * 10) / 10, carbsG: Math.round(s.carbsG * quantity * 10) / 10, fatG: Math.round(s.fatG * quantity * 10) / 10, fiberG: Math.round(s.fiberG * quantity * 10) / 10 });
    setSel(null); onDone?.();
  };

  if (custom) {
    return (
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const cal = num(c.calories); if (!c.name.trim() || cal === null) return; onPick({ customName: c.name.trim(), quantity: 1, name: c.name.trim(), calories: cal, proteinG: num(c.proteinG) ?? 0, carbsG: num(c.carbsG) ?? 0, fatG: num(c.fatG) ?? 0, fiberG: 0 }); setC({ name: '', calories: '', proteinG: '', carbsG: '', fatG: '' }); onDone?.(); }}>
        <FormRow label="Food name">{(id) => <Input id={id} required value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />}</FormRow>
        <div className="grid grid-cols-4 gap-3">{(['calories', 'proteinG', 'carbsG', 'fatG'] as const).map((k) => <FormRow key={k} label={k === 'calories' ? 'kcal' : k.replace('G', ' g')}>{(id) => <Input id={id} type="number" min={0} step="0.1" required={k === 'calories'} value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} />}</FormRow>)}</div>
        <div className="flex justify-between"><Button type="button" variant="ghost" onClick={() => setCustom(false)}>← Back to search</Button><Button type="submit">Add food</Button></div>
      </form>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2"><SearchBox value={q} onChange={setQ} placeholder="Search foods (rice, chicken, banana…)" className="flex-1" /><Button variant="outline" onClick={() => setCustom(true)}>Custom food</Button></div>
      {sel ? (
        <div className="rounded-lg border border-primary/30 bg-primary/[0.05] p-4">
          <p className="font-medium">{sel.food.name}</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <FormRow label="Serving" className="min-w-[180px] flex-1">{(id) => <Select id={id} value={sel.servingId} onChange={(e) => setSel({ ...sel, servingId: e.target.value })}>{sel.food.servings.map((s) => <option key={s.id} value={s.id}>{s.label} · {s.calories} kcal</option>)}</Select>}</FormRow>
            <FormRow label="Quantity" className="w-28">{(id) => <Input id={id} type="number" min={0.1} step={0.25} value={sel.qty} onChange={(e) => setSel({ ...sel, qty: e.target.value })} />}</FormRow>
            <Button onClick={add}>Add</Button><Button variant="ghost" onClick={() => setSel(null)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-lg border border-white/[0.06]">
          {loading ? <Skeleton className="h-32" /> : !data || data.items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No foods match. Try a custom food.</p> : (
            <ul className="divide-y divide-white/[0.05]">{data.items.map((f) => { const d = f.servings.find((s) => s.isDefault) ?? f.servings[0]!; return (
              <li key={f.id}><button type="button" onClick={() => setSel({ food: f, servingId: d.id, qty: '1' })} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-white/[0.04]"><span><span className="font-medium">{f.name}</span><span className="block text-xs text-muted-foreground">{d.label}</span></span><span className="text-right text-xs text-muted-foreground"><span className="font-semibold text-foreground">{d.calories} kcal</span><br />P{d.proteinG} C{d.carbsG} F{d.fatG}</span></button></li>
            ); })}</ul>
          )}
        </div>
      )}
    </div>
  );
}

export function MacroBars({ consumed, target }: { consumed: Macros; target: (Macros & { waterMl?: number | null }) | null }) {
  const rows: Array<[string, number, number | null, string, string]> = [
    ['Calories', consumed.calories, target?.calories ?? null, 'kcal', 'bg-primary'], ['Protein', consumed.proteinG, target?.proteinG ?? null, 'g', 'bg-chart-2'],
    ['Carbs', consumed.carbsG, target?.carbsG ?? null, 'g', 'bg-chart-3'], ['Fat', consumed.fatG, target?.fatG ?? null, 'g', 'bg-chart-4'], ['Fibre', consumed.fiberG, target?.fiberG ?? null, 'g', 'bg-chart-5'],
  ];
  return (
    <div className="space-y-3.5">
      {rows.map(([label, v, t, unit, cls]) => (
        <div key={label} className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm"><span className="font-medium">{label}</span><span className="tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{Math.round(v).toLocaleString('en-IN')}</span>{t != null && ` / ${Math.round(t).toLocaleString('en-IN')}`} {unit}</span></div>
          <Progress value={v} max={t ?? 0} label={label} barClassName={cls} />
        </div>
      ))}
      {!target && <p className="text-xs text-muted-foreground">No daily target is set yet — your trainer will set one from the nutrition calculator.</p>}
    </div>
  );
}

const statusBadge = (s: DailyMealDto['status']) => (s === 'COMPLETED' ? <Badge variant="good">Done</Badge> : s === 'SKIPPED' ? <Badge variant="monitor">Skipped</Badge> : <Badge variant="muted">To do</Badge>);

/** One day of nutrition. Clients can log; staff (clientId given) see it read-only. */
export function NutritionDay({ clientId }: { clientId?: string | null }) {
  const [date, setDate] = useState(today());
  const qs = `date=${date}${clientId ? `&clientId=${clientId}` : ''}`;
  const { data, error, loading, reload } = useApi<DailyNutritionDto>(`/nutrition/daily?${qs}`);
  const [state, setState] = useState<DailyNutritionDto | null>(null);
  const [extra, setExtra] = useState(false);
  const [mealType, setMealType] = useState('SNACK');
  const { busy, run } = useAction();
  useEffect(() => { if (data) setState(data); }, [data]);
  const readOnly = !!clientId;
  const d = state ?? data;

  const setLog = async (m: DailyMealDto, status: 'COMPLETED' | 'SKIPPED' | 'PENDING') => {
    const r = await run(() => put<DailyNutritionDto>('/diet-logs', { dietMealId: m.dietMealId, date, status }));
    if (r) setState(r);
  };
  const addExtra = async (i: PickedItem) => {
    const r = await run(() => post<DailyNutritionDto>('/meals', { date, mealType, items: [i.foodServingId ? { foodItemId: i.foodItemId, foodServingId: i.foodServingId, quantity: i.quantity } : { customName: i.customName, quantity: 1, calories: i.calories, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG }] }), 'Meal added');
    if (r) { setState(r); setExtra(false); }
  };

  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Section title={d?.planName ?? 'Meals'} description={d ? (d.planName ? 'Planned meals for the day' : 'No active diet plan yet') : undefined}
        action={<div className="flex items-center gap-2"><input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} className="h-9 rounded-md border border-input bg-white/[0.03] px-3 text-sm" aria-label="Date" />{!readOnly && <Button size="sm" onClick={() => setExtra(true)}><Plus /> Extra meal</Button>}</div>}>
        {loading && !d ? <Skeleton className="h-64" /> : !d || d.meals.length === 0 ? <EmptyState icon={Utensils} title="No meals for this day" description={readOnly ? 'No plan is active and nothing was logged.' : 'Your trainer hasn’t assigned a plan yet. You can still log what you eat with “Extra meal”.'} /> : (
          <ul className="space-y-3">
            {d.meals.map((m) => (
              <li key={m.key} className={cn('rounded-lg border p-4', m.status === 'COMPLETED' ? 'border-good/25 bg-good/[0.04]' : 'border-white/[0.06]')}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="flex flex-wrap items-center gap-2"><p className="font-display font-semibold">{m.name}</p>{statusBadge(m.status)}{m.custom && <Badge variant="muted">extra</Badge>}</div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{titleCase(m.mealType)}{m.timeOfDay ? ` · ${m.timeOfDay}` : ''}</p></div>
                  <div className="text-right text-xs text-muted-foreground"><p className="text-sm font-semibold text-foreground">{Math.round((m.planned ?? m.consumed).calories)} kcal</p>P{Math.round((m.planned ?? m.consumed).proteinG)} · C{Math.round((m.planned ?? m.consumed).carbsG)} · F{Math.round((m.planned ?? m.consumed).fatG)}</div>
                </div>
                {!readOnly && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.custom ? <Button size="sm" variant="ghost" loading={busy} onClick={async () => { const r = await run(() => del<DailyNutritionDto>(`/meals/${m.mealLogId}`)); if (r) setState(r); }}><Trash2 /> Remove</Button> : m.status === 'PENDING' ? (
                      <><Button size="sm" loading={busy} onClick={() => void setLog(m, 'COMPLETED')}><Check /> Ate it</Button><Button size="sm" variant="outline" onClick={() => void setLog(m, 'SKIPPED')}><SkipForward /> Skip</Button></>
                    ) : <Button size="sm" variant="ghost" onClick={() => void setLog(m, 'PENDING')}><Undo2 /> Undo</Button>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Today’s nutrition" description="Counts meals you’ve marked as eaten.">{d ? <MacroBars consumed={d.consumed} target={d.target} /> : <Skeleton className="h-48" />}</Section>
      <Modal open={extra} onClose={() => setExtra(false)} title="Add an extra meal" description="For anything that isn’t on your plan." wide>
        <FormRow label="Meal type" className="mb-4">{(id) => <Select id={id} value={mealType} onChange={(e) => setMealType(e.target.value)} className="w-48">{['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'PRE_WORKOUT', 'POST_WORKOUT'].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select>}</FormRow>
        <FoodPicker onPick={(i) => void addExtra(i)} />
      </Modal>
    </div>
  );
}

export function MyDietPage() {
  const { user } = useAuth();
  return (<div><PageHeader description="Tick off meals as you eat them and watch the day’s macros fill up." /><NutritionDay clientId={user?.role === 'CLIENT' ? null : undefined} /></div>);
}
