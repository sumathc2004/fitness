'use client';

import { useEffect, useState } from 'react';
import { Activity, Calculator, Check, Gauge, Info, Save, Sparkles } from 'lucide-react';
import type { AssessmentDto, CalculationDto, Goal, RecommendationDto, TargetDto } from '@gym/types';
import type { NutritionSettings } from '@gym/config';
import { useApi } from '@/lib/use-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, Skeleton } from '@/components/ui/misc';
import { EmptyState, ErrorState, Section } from '@/components/dashboard/primitives';
import { fieldErrors, FormRow, fmtDate, PageHeader, post, put, Select, titleCase, useAction, WithClient, withQs, num } from '@/components/kit/kit';
import { TrendChart } from './progress';

const GOALS: Goal[] = ['FAT_LOSS', 'RECOMPOSITION', 'MUSCLE_BUILDING'];

function Stat({ label, value, sub, estimate }: { label: string; value: string; sub?: string; estimate?: boolean }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-2"><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>{estimate && <Badge variant="monitor">Estimated</Badge>}</div>
      <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function AssessmentCards({ a }: { a: AssessmentDto }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="BMI" value={a.bmi.toFixed(1)} sub={a.bmiCategory || undefined} />
        <Stat label="Body fat" estimate value={a.bodyFatPct == null ? 'Needs waist & neck' : `${a.bodyFatPct}%`} sub={a.method === 'US_NAVY' ? 'US Navy tape method' : undefined} />
        <Stat label="Fat mass" estimate value={a.fatMassKg == null ? '—' : `${a.fatMassKg} kg`} />
        <Stat label="Lean mass" estimate value={a.leanMassKg == null ? '—' : `${a.leanMassKg} kg`} />
        <Stat label="BMR" value={`${Math.round(a.bmr)} kcal`} sub="Mifflin–St Jeor" />
        <Stat label="Maintenance" value={`${Math.round(a.maintenanceKcal)} kcal`} sub={`${titleCase(a.activityLevel)} activity`} />
      </div>
      {a.notes.length > 0 && <ul className="space-y-1 text-sm text-muted-foreground">{a.notes.map((n) => <li key={n} className="flex gap-2"><Info className="mt-0.5 size-4 shrink-0" />{n}</li>)}</ul>}
      <p className="text-xs text-muted-foreground">Body-fat figures are estimates from tape measurements, not a medical measurement or diagnosis.</p>
    </div>
  );
}

// ───────────────────────── recommendation
function RecommendationCard({ qs, isClient }: { qs: string; isClient: boolean }) {
  const { data, error, loading, reload } = useApi<{ recommendation: RecommendationDto | null }>(withQs('/nutrition/recommendation', qs));
  const { busy, run } = useAction();
  const clientId = new URLSearchParams(qs).get('clientId');
  const generate = async () => { if (await run(() => post('/nutrition/recommendation', clientId ? { clientId } : {}))) reload(); };
  const decide = async (decision: 'ACCEPT' | 'TRAINER_REVIEW' | 'DISMISS', id: string) => { if (await run(() => post(`/nutrition/recommendation/${id}/decision`, { decision }), decision === 'ACCEPT' ? 'Goal updated' : decision === 'TRAINER_REVIEW' ? 'Your trainer has been asked to review' : 'Dismissed')) reload(); };
  const rec = data?.recommendation;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  return (
    <Section title="Goal recommendation" description="Suggested from body-fat estimate, weight trend and strength trend. A suggestion — not a medical diagnosis."
      action={<Button size="sm" variant="outline" loading={busy} onClick={() => void generate()}><Sparkles /> {rec ? 'Refresh' : 'Get recommendation'}</Button>}>
      {loading ? <Skeleton className="h-32" /> : !rec ? <EmptyState icon={Sparkles} title="No recommendation yet" description="Add a body assessment first, then ask for a recommendation." /> : rec.needsData ? (
        <div className="rounded-lg border border-monitor/30 bg-monitor/[0.06] p-4 text-sm"><p className="font-semibold text-monitor">More data needed</p><ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">{rec.reasons.map((r) => <li key={r}>{r}</li>)}</ul></div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2"><Badge variant="primary">Suggested: {rec.goal ? titleCase(rec.goal) : '—'}</Badge><Badge variant="muted">Confidence {rec.confidence.toLowerCase()}</Badge>{rec.currentGoal && <Badge>Current: {titleCase(rec.currentGoal)}</Badge>}{rec.status && rec.status !== 'PENDING' && <Badge variant={rec.status === 'ACCEPTED' ? 'good' : 'monitor'}>{titleCase(rec.status)}</Badge>}</div>
          <ul className="space-y-1.5 text-sm">{rec.reasons.map((r) => <li key={r} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{r}</li>)}</ul>
          <p className="text-xs text-muted-foreground">{rec.disclaimer}</p>
          {rec.id && (rec.status === 'PENDING' || rec.status === 'TRAINER_REVIEW') && (
            <div className="flex flex-wrap gap-2">
              {(!isClient || rec.status === 'PENDING') && <Button size="sm" loading={busy} onClick={() => void decide('ACCEPT', rec.id!)}>Accept</Button>}
              {rec.status === 'PENDING' && <Button size="sm" variant="outline" onClick={() => void decide('TRAINER_REVIEW', rec.id!)}>{isClient ? 'Ask my trainer to review' : 'Flag for review'}</Button>}
              <Button size="sm" variant="ghost" onClick={() => void decide('DISMISS', rec.id!)}>Dismiss</Button>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

// ───────────────────────── body analysis
function BodyAnalysisPanel({ qs, isClient }: { qs: string; isClient: boolean }) {
  const clientId = new URLSearchParams(qs).get('clientId');
  const hist = useApi<{ items: AssessmentDto[] }>(withQs('/body-analysis/assessments', qs));
  const profile = useApi<{ profile: { sex: string; heightCm: number; activityLevel: string; goal: Goal; trainingExperience: string; injuries: string | null } | null }>(withQs('/body-analysis/profile', qs));
  const { busy, run } = useAction();
  const [f, setF] = useState({ weightKg: '', waistCm: '', neckCm: '', hipCm: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AssessmentDto | null>(null);
  const [message, setMessage] = useState('');
  const latest = hist.data?.items[0] ?? null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrs({}); setMessage('');
    const r = await run(async () => {
      try { return await post<AssessmentDto>('/body-analysis/assess', { clientId: clientId ?? undefined, weightKg: num(f.weightKg), waistCm: num(f.waistCm), neckCm: num(f.neckCm), hipCm: num(f.hipCm), saveMeasurement: true }); }
      catch (err) { setErrs(fieldErrors(err)); setMessage(err instanceof Error ? err.message : ''); throw err; }
    }, 'Assessment saved');
    if (r) { setResult(r); hist.reload(); }
  };
  const series = [...(hist.data?.items ?? [])].reverse().filter((a) => a.bodyFatPct != null).map((a) => ({ date: a.assessedAt, value: a.bodyFatPct! }));
  const p = profile.data?.profile;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <Section title="New assessment" description="Enter today’s measurements. Height, age and sex come from the profile.">
            <form onSubmit={submit} className="grid grid-cols-2 gap-3">
              <FormRow label="Weight (kg)" error={errs.weightKg} className="col-span-2">{(id) => <Input id={id} type="number" step="0.1" required inputMode="decimal" value={f.weightKg} onChange={(e) => setF({ ...f, weightKg: e.target.value })} placeholder={latest ? String(latest.weightKg) : ''} />}</FormRow>
              <FormRow label="Waist (cm)" error={errs.waistCm}>{(id) => <Input id={id} type="number" step="0.1" inputMode="decimal" value={f.waistCm} onChange={(e) => setF({ ...f, waistCm: e.target.value })} />}</FormRow>
              <FormRow label="Neck (cm)" error={errs.neckCm}>{(id) => <Input id={id} type="number" step="0.1" inputMode="decimal" value={f.neckCm} onChange={(e) => setF({ ...f, neckCm: e.target.value })} />}</FormRow>
              <FormRow label="Hip (cm)" error={errs.hipCm} hint="Needed for females" className="col-span-2">{(id) => <Input id={id} type="number" step="0.1" inputMode="decimal" value={f.hipCm} onChange={(e) => setF({ ...f, hipCm: e.target.value })} />}</FormRow>
              {message && <p role="alert" className="col-span-2 text-sm text-destructive">{message}</p>}
              <Button type="submit" loading={busy} className="col-span-2"><Gauge /> Run assessment</Button>
            </form>
          </Section>
          <ProfileCard qs={qs} profile={p ?? null} canEdit={!isClient} reload={profile.reload} loading={profile.loading} />
        </div>
        <div className="space-y-6">
          <Section title={result ? 'Result' : 'Latest assessment'} description={(result ?? latest) ? fmtDate((result ?? latest)!.assessedAt) : undefined}>
            {(result ?? latest) ? <AssessmentCards a={(result ?? latest)!} /> : <EmptyState icon={Activity} title="No assessments yet" description="Run your first assessment to see BMI, estimated body fat, lean mass and calorie needs." />}
          </Section>
          <Section title="Estimated body fat over time">{series.length < 2 ? <EmptyState icon={Activity} title="Not enough data" description="Two assessments with waist and neck measurements draw the trend." /> : <TrendChart data={series} unit="%" color="hsl(var(--chart-3))" />}</Section>
        </div>
      </div>
      <RecommendationCard qs={qs} isClient={isClient} />
    </div>
  );
}

function ProfileCard({ qs, profile, canEdit, reload, loading }: { qs: string; profile: { sex: string; heightCm: number; activityLevel: string; goal: Goal; trainingExperience: string; injuries: string | null } | null; canEdit: boolean; reload: () => void; loading: boolean }) {
  const clientId = new URLSearchParams(qs).get('clientId');
  const [f, setF] = useState({ sex: 'MALE', heightCm: '170', activityLevel: 'MODERATE', trainingExperience: 'BEGINNER', goal: 'RECOMPOSITION', injuries: '' });
  const { busy, run } = useAction();
  useEffect(() => { if (profile) setF({ sex: profile.sex, heightCm: String(profile.heightCm), activityLevel: profile.activityLevel, trainingExperience: profile.trainingExperience, goal: profile.goal, injuries: profile.injuries ?? '' }); }, [profile]);
  if (loading) return <Skeleton className="h-48" />;
  if (!canEdit) return (
    <Section title="Your profile"><dl className="grid grid-cols-2 gap-3 text-sm">{profile ? ([['Sex', titleCase(profile.sex)], ['Height', `${profile.heightCm} cm`], ['Activity', titleCase(profile.activityLevel)], ['Goal', titleCase(profile.goal)]] as const).map(([a, b]) => <div key={a}><dt className="text-xs uppercase tracking-wider text-muted-foreground">{a}</dt><dd className="mt-0.5 font-medium">{b}</dd></div>) : <p className="col-span-2 text-muted-foreground">Your trainer hasn’t set your profile yet.</p>}</dl><p className="mt-3 text-xs text-muted-foreground">Ask your trainer to change these.</p></Section>
  );
  return (
    <Section title="Client profile" description="Used by every calculation.">
      <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => { e.preventDefault(); if (clientId && await run(() => put(`/body-analysis/profile?clientId=${clientId}`, { ...f, heightCm: Number(f.heightCm), injuries: f.injuries || undefined }), 'Profile saved')) reload(); }}>
        <FormRow label="Sex">{(id) => <Select id={id} value={f.sex} onChange={(e) => setF({ ...f, sex: e.target.value })}><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></Select>}</FormRow>
        <FormRow label="Height (cm)">{(id) => <Input id={id} type="number" value={f.heightCm} onChange={(e) => setF({ ...f, heightCm: e.target.value })} />}</FormRow>
        <FormRow label="Activity">{(id) => <Select id={id} value={f.activityLevel} onChange={(e) => setF({ ...f, activityLevel: e.target.value })}>{['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE'].map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}</Select>}</FormRow>
        <FormRow label="Experience">{(id) => <Select id={id} value={f.trainingExperience} onChange={(e) => setF({ ...f, trainingExperience: e.target.value })}>{['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}</Select>}</FormRow>
        <FormRow label="Goal" className="col-span-2">{(id) => <Select id={id} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })}>{GOALS.map((g) => <option key={g} value={g}>{titleCase(g)}</option>)}</Select>}</FormRow>
        <Button type="submit" variant="secondary" loading={busy} className="col-span-2"><Save /> Save profile</Button>
      </form>
    </Section>
  );
}

export function BodyAnalysisPage({ isClient }: { isClient: boolean }) {
  return (<div><PageHeader description="BMI, estimated body fat, lean mass and calorie needs — with a goal recommendation you can accept or send to your trainer." /><WithClient isClient={isClient}>{(_id, qs) => <BodyAnalysisPanel qs={qs} isClient={isClient} />}</WithClient></div>);
}

// ───────────────────────── nutrition calculator & targets
function TargetsPanel({ qs, isClient }: { qs: string; isClient: boolean }) {
  const clientId = new URLSearchParams(qs).get('clientId');
  const settings = useApi<NutritionSettings>('/nutrition/settings');
  const targets = useApi<{ active: TargetDto | null; history: TargetDto[] }>(withQs('/nutrition/targets', qs));
  const { busy, run } = useAction();
  const [goal, setGoal] = useState<Goal | ''>('');
  const [ov, setOv] = useState({ cal: '', protein: '', fat: '', fiber: '' });
  const [calc, setCalc] = useState<CalculationDto | null>(null);
  const [edit, setEdit] = useState({ calories: '', proteinG: '', carbsG: '', fatG: '', fiberG: '', waterMl: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => { if (calc) { const t = calc.targets; setEdit({ calories: String(t.calories), proteinG: String(t.proteinG), carbsG: String(t.carbsG), fatG: String(t.fatG), fiberG: String(t.fiberG), waterMl: String(t.waterMl) }); } }, [calc]);

  const calculate = async () => {
    setMsg('');
    const overrides: Record<string, number> = {};
    const c = num(ov.cal); if (c !== null) overrides.calorieAdjustPct = c / 100;
    const p = num(ov.protein); if (p !== null) overrides.proteinPerKg = p;
    const fa = num(ov.fat); if (fa !== null) overrides.fatPct = fa / 100;
    const fi = num(ov.fiber); if (fi !== null) overrides.fiberPer1000Kcal = fi;
    const r = await run(async () => { try { return await post<CalculationDto>('/nutrition/calculate', { clientId: clientId ?? undefined, goal: goal || undefined, overrides }); } catch (e) { setMsg(e instanceof Error ? e.message : ''); throw e; } });
    if (r) setCalc(r);
  };
  const save = async () => {
    if (!clientId) return;
    const body = { clientId, calories: num(edit.calories), proteinG: num(edit.proteinG), carbsG: num(edit.carbsG), fatG: num(edit.fatG), fiberG: num(edit.fiberG), waterMl: num(edit.waterMl) ?? undefined, source: 'TRAINER' };
    if (await run(() => post('/nutrition/targets', body), 'Targets saved and the client was notified')) { setCalc(null); targets.reload(); }
  };

  const s = settings.data;
  const active = targets.data?.active;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Section title={isClient ? 'Estimate my needs' : 'Calculate targets'} description="Calories and macros from the body profile, latest assessment and goal.">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow label="Goal" hint="Leave on profile goal unless you want to compare">{(id) => <Select id={id} value={goal} onChange={(e) => setGoal(e.target.value as Goal | '')}><option value="">Use profile goal</option>{GOALS.map((g) => <option key={g} value={g}>{titleCase(g)}</option>)}</Select>}</FormRow>
            {!isClient && <>
              <FormRow label="Calorie adjustment (%)" hint={s ? `Allowed ${Math.round(s.calorieAdjustRange[0] * 100)}% to +${Math.round(s.calorieAdjustRange[1] * 100)}%` : undefined}>{(id) => <Input id={id} type="number" step="1" value={ov.cal} onChange={(e) => setOv({ ...ov, cal: e.target.value })} placeholder="goal default" />}</FormRow>
              <FormRow label="Protein (g per kg)" hint={s ? `Allowed ${s.proteinPerKgRange[0]}–${s.proteinPerKgRange[1]}` : undefined}>{(id) => <Input id={id} type="number" step="0.1" value={ov.protein} onChange={(e) => setOv({ ...ov, protein: e.target.value })} placeholder="goal default" />}</FormRow>
              <FormRow label="Fat (% of calories)" hint={s ? `Allowed ${Math.round(s.fatPctRange[0] * 100)}–${Math.round(s.fatPctRange[1] * 100)}%` : undefined}>{(id) => <Input id={id} type="number" step="1" value={ov.fat} onChange={(e) => setOv({ ...ov, fat: e.target.value })} placeholder="goal default" />}</FormRow>
              <FormRow label="Fibre (g per 1000 kcal)">{(id) => <Input id={id} type="number" step="0.5" value={ov.fiber} onChange={(e) => setOv({ ...ov, fiber: e.target.value })} placeholder="default" />}</FormRow>
            </>}
          </div>
          {msg && <p role="alert" className="mt-3 text-sm text-destructive">{msg}</p>}
          <Button className="mt-5" loading={busy} onClick={() => void calculate()}><Calculator /> Calculate</Button>
        </Section>

        {calc && (
          <Section title="Result" description={`Goal: ${titleCase(calc.goal)}`}>
            <AssessmentCards a={calc.assessment} />
            <div className="mt-6 border-t border-white/[0.06] pt-5">
              <p className="mb-3 font-display font-semibold">Daily targets</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {([['calories', 'Calories (kcal)'], ['proteinG', 'Protein (g)'], ['carbsG', 'Carbs (g)'], ['fatG', 'Fat (g)'], ['fiberG', 'Fibre (g)'], ['waterMl', 'Water (ml)']] as const).map(([key, label]) => (
                  <FormRow key={key} label={label}>{(id) => <Input id={id} type="number" readOnly={isClient} value={edit[key]} onChange={(e) => setEdit({ ...edit, [key]: e.target.value })} />}</FormRow>
                ))}
              </div>
              {calc.targets.warnings.length > 0 && <ul className="mt-3 space-y-1 text-sm text-monitor">{calc.targets.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul>}
              <p className="mt-3 text-xs text-muted-foreground">Applied: {Math.round(calc.targets.applied.calorieAdjustPct * 100)}% calories, {calc.targets.applied.proteinPerKg} g/kg protein, {Math.round(calc.targets.applied.fatPct * 100)}% fat.</p>
              {!isClient && <Button className="mt-4" loading={busy} onClick={() => void save()}><Save /> Save as the client’s target</Button>}
              {isClient && <p className="mt-4 text-sm text-muted-foreground">This is an estimate. Your trainer sets your official daily target.</p>}
            </div>
          </Section>
        )}
      </div>
      <div className="space-y-6">
        <Section title={isClient ? 'My daily target' : 'Current target'}>
          {targets.loading ? <Skeleton className="h-32" /> : !active ? <EmptyState icon={Calculator} title="No target set" description={isClient ? 'Your trainer will set this for you.' : 'Calculate and save one on the left.'} /> : (
            <div><p className="font-display text-4xl font-bold tabular-nums">{active.calories}<span className="ml-1 text-base font-medium text-muted-foreground">kcal</span></p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">{([['Protein', `${active.proteinG} g`], ['Carbs', `${active.carbsG} g`], ['Fat', `${active.fatG} g`], ['Fibre', `${active.fiberG} g`], ['Water', active.waterMl ? `${active.waterMl} ml` : '—']] as const).map(([a, b]) => <div key={a} className="rounded-md bg-white/[0.04] p-3"><dt className="text-xs text-muted-foreground">{a}</dt><dd className="font-display text-lg font-semibold">{b}</dd></div>)}</dl>
              <p className="mt-3 text-xs text-muted-foreground">Set {fmtDate(active.effectiveFrom)} · {active.source === 'TRAINER' ? 'by your trainer' : 'calculated'}</p></div>
          )}
        </Section>
        {(targets.data?.history.length ?? 0) > 1 && <Section title="Previous targets"><ul className="space-y-2 text-sm">{targets.data!.history.filter((t) => !t.isActive).slice(0, 6).map((t) => <li key={t.id} className="flex justify-between"><span className="text-muted-foreground">{fmtDate(t.effectiveFrom)}</span><span>{t.calories} kcal · P{t.proteinG}</span></li>)}</ul></Section>}
      </div>
    </div>
  );
}

export function NutritionCalculatorPage({ isClient }: { isClient: boolean }) {
  return (<div><PageHeader description="Transparent calorie and macro targets — every number comes from your body profile, goal and the gym’s configured ranges." /><WithClient isClient={isClient}>{(_id, qs) => <TargetsPanel qs={qs} isClient={isClient} />}</WithClient></div>);
}

// ───────────────────────── admin: nutrition settings
export function NutritionSettingsPage() {
  const { data, error, loading, reload } = useApi<NutritionSettings>('/nutrition/settings');
  const [s, setS] = useState<NutritionSettings | null>(null);
  const { busy, run } = useAction();
  const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => { if (data) setS(structuredClone(data)); }, [data]);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !s) return <Skeleton className="h-96" />;

  const setGoalVal = (group: 'calorieAdjustPct' | 'proteinPerKg' | 'fatPct', g: Goal, v: number, scale = 1) => setS({ ...s, [group]: { ...s[group], [g]: v / scale } });
  const save = async () => {
    setErrs({});
    const r = await run(async () => { try { return await put<NutritionSettings>('/nutrition/settings', s); } catch (e) { setErrs(fieldErrors(e)); throw e; } }, 'Nutrition settings saved');
    if (r) reload();
  };
  const range = (key: 'calorieAdjustRange' | 'proteinPerKgRange' | 'fatPctRange', i: 0 | 1, v: number, scale = 1) => setS({ ...s, [key]: i === 0 ? [v / scale, s[key][1]] : [s[key][0], v / scale] } as NutritionSettings);

  return (
    <div className="space-y-6">
      <PageHeader description="These ranges drive the nutrition calculator for every trainer. Trainers can tune a client’s numbers only inside the allowed ranges." actions={<Button loading={busy} onClick={() => void save()}><Save /> Save settings</Button>} />
      {Object.keys(errs).length > 0 && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/[0.06] p-3 text-sm text-destructive">Some values are outside the permitted limits: {Object.keys(errs).join(', ')}</p>}
      <Section title="Goal defaults" description="What each goal starts from.">
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="pb-2 font-medium">Goal</th><th className="pb-2 font-medium">Calories vs maintenance (%)</th><th className="pb-2 font-medium">Protein (g/kg)</th><th className="pb-2 font-medium">Fat (% kcal)</th></tr></thead>
          <tbody className="divide-y divide-white/[0.05]">{GOALS.map((g) => (
            <tr key={g}><td className="py-3 font-medium">{titleCase(g)}</td>
              <td className="py-3 pr-3"><Input type="number" step="1" aria-label={`${g} calories`} className="h-9 w-28" value={Math.round(s.calorieAdjustPct[g] * 100)} onChange={(e) => setGoalVal('calorieAdjustPct', g, Number(e.target.value), 100)} /></td>
              <td className="py-3 pr-3"><Input type="number" step="0.1" aria-label={`${g} protein`} className="h-9 w-28" value={s.proteinPerKg[g]} onChange={(e) => setGoalVal('proteinPerKg', g, Number(e.target.value))} /></td>
              <td className="py-3"><Input type="number" step="1" aria-label={`${g} fat`} className="h-9 w-28" value={Math.round(s.fatPct[g] * 100)} onChange={(e) => setGoalVal('fatPct', g, Number(e.target.value), 100)} /></td></tr>
          ))}</tbody></table></div>
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Trainer-adjustable ranges" description="Hard limits when a trainer overrides a calculation.">
          <div className="grid grid-cols-2 gap-4">
            <FormRow label="Calorie adj. min (%)">{(id) => <Input id={id} type="number" value={Math.round(s.calorieAdjustRange[0] * 100)} onChange={(e) => range('calorieAdjustRange', 0, Number(e.target.value), 100)} />}</FormRow>
            <FormRow label="Calorie adj. max (%)">{(id) => <Input id={id} type="number" value={Math.round(s.calorieAdjustRange[1] * 100)} onChange={(e) => range('calorieAdjustRange', 1, Number(e.target.value), 100)} />}</FormRow>
            <FormRow label="Protein min (g/kg)">{(id) => <Input id={id} type="number" step="0.1" value={s.proteinPerKgRange[0]} onChange={(e) => range('proteinPerKgRange', 0, Number(e.target.value))} />}</FormRow>
            <FormRow label="Protein max (g/kg)">{(id) => <Input id={id} type="number" step="0.1" value={s.proteinPerKgRange[1]} onChange={(e) => range('proteinPerKgRange', 1, Number(e.target.value))} />}</FormRow>
            <FormRow label="Fat min (% kcal)">{(id) => <Input id={id} type="number" value={Math.round(s.fatPctRange[0] * 100)} onChange={(e) => range('fatPctRange', 0, Number(e.target.value), 100)} />}</FormRow>
            <FormRow label="Fat max (% kcal)">{(id) => <Input id={id} type="number" value={Math.round(s.fatPctRange[1] * 100)} onChange={(e) => range('fatPctRange', 1, Number(e.target.value), 100)} />}</FormRow>
          </div>
        </Section>
        <Section title="Fibre, water & activity">
          <div className="grid grid-cols-2 gap-4">
            <FormRow label="Fibre (g per 1000 kcal)">{(id) => <Input id={id} type="number" step="0.5" value={s.fiberPer1000Kcal} onChange={(e) => setS({ ...s, fiberPer1000Kcal: Number(e.target.value) })} />}</FormRow>
            <FormRow label="Water (ml per kg)">{(id) => <Input id={id} type="number" value={s.waterMlPerKg} onChange={(e) => setS({ ...s, waterMlPerKg: Number(e.target.value) })} />}</FormRow>
            {(Object.keys(s.activityMultiplier) as Array<keyof NutritionSettings['activityMultiplier']>).map((a) => (
              <FormRow key={a} label={`${titleCase(a)} multiplier`}>{(id) => <Input id={id} type="number" step="0.025" value={s.activityMultiplier[a]} onChange={(e) => setS({ ...s, activityMultiplier: { ...s.activityMultiplier, [a]: Number(e.target.value) } })} />}</FormRow>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
