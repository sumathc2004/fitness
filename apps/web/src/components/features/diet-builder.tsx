'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Copy, Plus, Salad, Send, Trash2 } from 'lucide-react';
import type { DietDto, DietSummary, Macros } from '@gym/types';
import { useApi } from '@/lib/use-api';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, Skeleton } from '@/components/ui/misc';
import { EmptyState, ErrorState, Section } from '@/components/dashboard/primitives';
import { ConfirmButton, del, FormRow, fmtDate, Modal, PageHeader, post, put, Select, Textarea, titleCase, today, useAction, num, useClients, fieldErrors } from '@/components/kit/kit';
import { cn } from '@/lib/utils';
import { FoodPicker, type PickedItem } from './diet-log';

const zero = (): Macros => ({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 });
const add = (a: Macros, b: Macros): Macros => ({ calories: a.calories + b.calories, proteinG: a.proteinG + b.proteinG, carbsG: a.carbsG + b.carbsG, fatG: a.fatG + b.fatG, fiberG: a.fiberG + b.fiberG });
const r = (n: number) => Math.round(n * 10) / 10;

interface Item { key: string; foodItemId?: string | null; foodServingId?: string | null; customName?: string; name: string; servingLabel: string | null; quantity: number; unit: Macros }
interface Meal { key: string; id?: string; mealType: string; name: string; timeOfDay: string; items: Item[] }
let seq = 0;
const k = () => `k${++seq}`;
const itemTotals = (i: Item): Macros => ({ calories: Math.round(i.unit.calories * i.quantity), proteinG: r(i.unit.proteinG * i.quantity), carbsG: r(i.unit.carbsG * i.quantity), fatG: r(i.unit.fatG * i.quantity), fiberG: r(i.unit.fiberG * i.quantity) });
const mealTotals = (m: Meal) => m.items.reduce((t, i) => add(t, itemTotals(i)), zero());

const MEAL_DEFAULTS: Array<[string, string, string]> = [['BREAKFAST', 'Breakfast', '08:00'], ['LUNCH', 'Lunch', '13:00'], ['SNACK', 'Snack', '17:00'], ['DINNER', 'Dinner', '20:00']];

function fromDto(d: DietDto): { meals: Meal[] } {
  return {
    meals: d.meals.map((m) => ({
      key: k(), id: m.id, mealType: m.mealType, name: m.name, timeOfDay: m.timeOfDay ?? '',
      items: m.items.map((i) => ({ key: k(), foodItemId: i.foodItemId, foodServingId: i.foodServingId, customName: i.foodServingId ? undefined : i.name, name: i.name, servingLabel: i.servingLabel, quantity: i.quantity, unit: { calories: i.calories / i.quantity, proteinG: i.proteinG / i.quantity, carbsG: i.carbsG / i.quantity, fatG: i.fatG / i.quantity, fiberG: i.fiberG / i.quantity } })),
    })),
  };
}

export function ClientMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { data, loading } = useClients();
  if (loading || !data) return <Skeleton className="h-24" />;
  if (data.items.length === 0) return <p className="text-sm text-muted-foreground">You have no clients yet.</p>;
  return (
    <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/[0.06] p-2">
      {data.items.map((c) => (
        <li key={c.id}><label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-white/[0.04]"><input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" checked={value.includes(c.id)} onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((x) => x !== c.id))} /><span className="text-sm">{c.name}</span></label></li>
      ))}
    </ul>
  );
}

export function AssignDietModal({ dietId, open, onClose, onDone }: { dietId: string; open: boolean; onClose: () => void; onDone?: () => void }) {
  const [ids, setIds] = useState<string[]>([]);
  const [start, setStart] = useState(today());
  const { busy, run } = useAction();
  return (
    <Modal open={open} onClose={onClose} title="Assign to clients" description="Each client gets their own copy, activated from the start date. Any plan they have now is archived.">
      <div className="space-y-4">
        <ClientMultiSelect value={ids} onChange={setIds} />
        <FormRow label="Start date">{(id) => <Input id={id} type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-48" />}</FormRow>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={ids.length === 0} onClick={async () => { if (await run(() => post(`/diets/${dietId}/assign`, { clientIds: ids, startDate: start }), `Assigned to ${ids.length} client${ids.length === 1 ? '' : 's'}`)) { onClose(); onDone?.(); } }}><Send /> Assign</Button></div>
      </div>
    </Modal>
  );
}

export function DietBuilderPage({ id, listHref, forceTemplate }: { id?: string; listHref: string; forceTemplate: boolean }) {
  const router = useRouter();
  const existing = useApi<DietDto>(id ? `/diets/${id}` : null);
  const clients = useClients();
  const { busy, run } = useAction();
  const [name, setName] = useState('');
  const [isTemplate, setIsTemplate] = useState(forceTemplate);
  const [clientId, setClientId] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [meals, setMeals] = useState<Meal[]>(() => MEAL_DEFAULTS.map(([t, n, tm]) => ({ key: k(), mealType: t, name: n, timeOfDay: tm, items: [] })));
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [assign, setAssign] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(!id);

  useEffect(() => {
    const d = existing.data;
    if (!d || loaded) return;
    setName(d.name); setIsTemplate(d.isTemplate); setClientId(d.clientId ?? ''); setStartDate(d.startDate ?? today()); setNotes(d.notes ?? ''); setMeals(fromDto(d).meals); setLoaded(true);
  }, [existing.data, loaded]);

  if (existing.error) return <ErrorState message={existing.error.message} onRetry={existing.reload} />;
  if (!loaded) return <Skeleton className="h-96" />;

  const total = meals.reduce((t, m) => add(t, mealTotals(m)), zero());
  const patchMeal = (key: string, p: Partial<Meal>) => setMeals((ms) => ms.map((m) => (m.key === key ? { ...m, ...p } : m)));
  const patchItem = (mk: string, ik: string, p: Partial<Item>) => setMeals((ms) => ms.map((m) => (m.key === mk ? { ...m, items: m.items.map((i) => (i.key === ik ? { ...i, ...p } : i)) } : m)));
  const onPick = (mk: string, p: PickedItem) => setMeals((ms) => ms.map((m) => (m.key === mk ? { ...m, items: [...m.items, { key: k(), foodItemId: p.foodItemId, foodServingId: p.foodServingId, customName: p.customName, name: p.name, servingLabel: p.servingLabel ?? null, quantity: p.quantity, unit: { calories: p.calories / p.quantity, proteinG: p.proteinG / p.quantity, carbsG: p.carbsG / p.quantity, fatG: p.fatG / p.quantity, fiberG: p.fiberG / p.quantity } }] } : m)));

  const payload = () => ({
    name, isTemplate, clientId: isTemplate ? undefined : clientId || undefined, startDate: isTemplate ? undefined : startDate, notes: notes || undefined,
    meals: meals.filter((m) => m.items.length > 0).map((m) => ({ id: m.id, mealType: m.mealType, name: m.name, timeOfDay: m.timeOfDay || null, items: m.items.map((i) => (i.foodServingId ? { foodItemId: i.foodItemId ?? undefined, foodServingId: i.foodServingId, quantity: i.quantity } : { customName: i.customName ?? i.name, quantity: i.quantity, calories: Math.round(i.unit.calories), proteinG: r(i.unit.proteinG), carbsG: r(i.unit.carbsG), fatG: r(i.unit.fatG), fiberG: r(i.unit.fiberG) })) })),
  });

  const save = async (activate: boolean) => {
    setErrs({});
    if (!isTemplate && !clientId) { setErrs({ clientId: 'Pick a client, or save as a template' }); return; }
    const saved = await run(async () => {
      try { return id ? await put<DietDto>(`/diets/${id}`, payload()) : await post<DietDto>('/diets', payload()); }
      catch (e) { setErrs(fieldErrors(e)); throw e; }
    }, 'Diet plan saved');
    if (!saved) return;
    if (activate && !isTemplate) await run(() => post(`/diets/${saved.id}/activate`), 'Plan is now active for the client');
    if (!id) router.replace(`${listHref}/${saved.id}`);
    else existing.reload();
  };

  return (
    <div className="space-y-6">
      <Link href={listHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back</Link>
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Section title="Plan details">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow label="Plan name" error={errs.name} className="sm:col-span-2">{(i) => <Input id={i} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2,200 kcal cut" />}</FormRow>
              {!forceTemplate && <FormRow label="Type">{(i) => <Select id={i} value={isTemplate ? 'T' : 'C'} onChange={(e) => setIsTemplate(e.target.value === 'T')}><option value="C">For a client</option><option value="T">Reusable template</option></Select>}</FormRow>}
              {!isTemplate && <FormRow label="Client" error={errs.clientId}>{(i) => <Select id={i} value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Choose…</option>{(clients.data?.items ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</FormRow>}
              {!isTemplate && <FormRow label="Start date">{(i) => <Input id={i} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}</FormRow>}
              <FormRow label="Notes" className="sm:col-span-2">{(i) => <Textarea id={i} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Hydration, supplements, swaps…" />}</FormRow>
            </div>
          </Section>

          {meals.map((m) => {
            const t = mealTotals(m);
            return (
              <Section key={m.key} title={m.name || 'Meal'} description={`${Math.round(t.calories)} kcal · P${Math.round(t.proteinG)} C${Math.round(t.carbsG)} F${Math.round(t.fatG)}`}
                action={<ConfirmButton variant="ghost" label="Remove meal?" onConfirm={() => setMeals((ms) => ms.filter((x) => x.key !== m.key))}><Trash2 className="size-4" /></ConfirmButton>}>
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <FormRow label="Meal name">{(i) => <Input id={i} value={m.name} onChange={(e) => patchMeal(m.key, { name: e.target.value })} />}</FormRow>
                  <FormRow label="Type">{(i) => <Select id={i} value={m.mealType} onChange={(e) => patchMeal(m.key, { mealType: e.target.value })}>{['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'PRE_WORKOUT', 'POST_WORKOUT', 'CUSTOM'].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</Select>}</FormRow>
                  <FormRow label="Time">{(i) => <Input id={i} type="time" value={m.timeOfDay} onChange={(e) => patchMeal(m.key, { timeOfDay: e.target.value })} />}</FormRow>
                </div>
                {m.items.length === 0 ? <p className="mb-3 text-sm text-muted-foreground">No foods yet — meals without foods are not saved.</p> : (
                  <ul className="mb-3 divide-y divide-white/[0.05]">{m.items.map((i) => { const it = itemTotals(i); return (
                    <li key={i.key} className="flex flex-wrap items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{i.servingLabel ?? 'custom'} · P{it.proteinG} C{it.carbsG} F{it.fatG}</p></div>
                      <Input type="number" min={0.1} step={0.25} aria-label={`Quantity of ${i.name}`} className="h-9 w-20" value={i.quantity} onChange={(e) => patchItem(m.key, i.key, { quantity: num(e.target.value) ?? 1 })} />
                      <span className="w-20 text-right text-sm font-semibold tabular-nums">{it.calories} kcal</span>
                      <button aria-label={`Remove ${i.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => setMeals((ms) => ms.map((x) => (x.key === m.key ? { ...x, items: x.items.filter((y) => y.key !== i.key) } : x)))}><Trash2 className="size-4" /></button>
                    </li>
                  ); })}</ul>
                )}
                <Button size="sm" variant="outline" onClick={() => setPickFor(m.key)}><Plus /> Add food</Button>
              </Section>
            );
          })}
          <Button variant="secondary" onClick={() => setMeals((ms) => [...ms, { key: k(), mealType: 'SNACK', name: 'Snack', timeOfDay: '', items: [] }])}><Plus /> Add meal</Button>
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <Section title="Daily totals">
            <p className="font-display text-4xl font-bold tabular-nums">{Math.round(total.calories)}<span className="ml-1 text-base font-medium text-muted-foreground">kcal</span></p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">{([['Protein', total.proteinG], ['Carbs', total.carbsG], ['Fat', total.fatG], ['Fibre', total.fiberG]] as const).map(([l, v]) => <div key={l} className="rounded-md bg-white/[0.04] p-3"><dt className="text-xs text-muted-foreground">{l}</dt><dd className="font-display text-lg font-semibold">{Math.round(v)} g</dd></div>)}</dl>
            <div className="mt-5 flex flex-col gap-2">
              <Button loading={busy} onClick={() => void save(false)}>Save {isTemplate ? 'template' : 'plan'}</Button>
              {!isTemplate && <Button variant="secondary" loading={busy} onClick={() => void save(true)}>Save & activate</Button>}
              {id && isTemplate && <Button variant="outline" onClick={() => setAssign(true)}><Send /> Assign to clients</Button>}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Macros are calculated from the food database when you save.</p>
          </Section>
        </aside>
      </div>
      <Modal open={pickFor !== null} onClose={() => setPickFor(null)} title="Add food" wide>{pickFor && <FoodPicker onPick={(p) => onPick(pickFor, p)} onDone={() => setPickFor(null)} />}</Modal>
      {id && <AssignDietModal dietId={id} open={assign} onClose={() => setAssign(false)} />}
    </div>
  );
}

export function DietListPage({ templates, builderBase }: { templates: boolean; builderBase: string }) {
  const { data, error, loading, reload } = useApi<{ items: DietSummary[] }>(`/diets?template=${templates}`);
  const [assignId, setAssignId] = useState<string | null>(null);
  const { run } = useAction();
  const router = useRouter();
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  return (
    <div>
      <PageHeader description={templates ? 'Reusable meal plans you can assign to any client in one click.' : 'Every diet plan you have built for your clients.'} actions={<Link href={`${builderBase}/new`} className={cn(buttonVariants())}><Plus /> New {templates ? 'template' : 'plan'}</Link>} />
      {loading || !data ? <Skeleton className="h-56" /> : data.items.length === 0 ? <EmptyState icon={Salad} title={templates ? 'No templates yet' : 'No plans yet'} description="Build a plan from the food database with live macro totals." action={<Link href={`${builderBase}/new`} className={cn(buttonVariants())}><Plus /> New {templates ? 'template' : 'plan'}</Link>} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((d) => (
            <div key={d.id} className="surface-card flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2"><Link href={`${builderBase}/${d.id}`} className="font-display font-semibold hover:text-primary">{d.name}</Link>{!templates && <Badge variant={d.status === 'ACTIVE' ? 'good' : d.status === 'DRAFT' ? 'monitor' : 'muted'}>{d.status.toLowerCase()}</Badge>}</div>
              {!templates && <p className="text-sm text-muted-foreground">{d.clientName ?? 'No client'}{d.startDate ? ` · from ${fmtDate(d.startDate)}` : ''}</p>}
              <p className="text-sm text-muted-foreground">{d.mealCount} meals · {Math.round(d.calories)} kcal/day</p>
              <div className="mt-auto flex flex-wrap gap-2">
                <Link href={`${builderBase}/${d.id}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>Edit</Link>
                {templates && <Button size="sm" variant="ghost" onClick={() => setAssignId(d.id)}><Send /> Assign</Button>}
                {!templates && d.status !== 'ACTIVE' && d.clientId && <Button size="sm" variant="ghost" onClick={async () => { if (await run(() => post(`/diets/${d.id}/activate`), 'Plan activated')) reload(); }}>Activate</Button>}
                <Button size="sm" variant="ghost" aria-label="Duplicate as template" onClick={async () => {
                  const full = await run(() => import('@/lib/api').then(({ api }) => api<DietDto>(`/diets/${d.id}`)));
                  if (!full) return;
                  const copy = await run(() => post<DietDto>('/diets', { name: `${full.name} (copy)`, isTemplate: true, notes: full.notes ?? undefined, meals: full.meals.map((m) => ({ mealType: m.mealType, name: m.name, timeOfDay: m.timeOfDay, items: m.items.map((i) => (i.foodServingId ? { foodItemId: i.foodItemId ?? undefined, foodServingId: i.foodServingId, quantity: i.quantity } : { customName: i.name, quantity: i.quantity, calories: i.calories, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG, fiberG: i.fiberG })) })) }), 'Saved as a template');
                  if (copy) router.push(`${builderBase}/${copy.id}`);
                }}><Copy /></Button>
                <ConfirmButton variant="ghost" label="Delete?" onConfirm={async () => { if (await run(() => del(`/diets/${d.id}`), 'Removed')) reload(); }}><Trash2 className="size-4" /></ConfirmButton>
              </div>
            </div>
          ))}
        </div>
      )}
      {assignId && <AssignDietModal dietId={assignId} open onClose={() => setAssignId(null)} onDone={reload} />}
    </div>
  );
}
