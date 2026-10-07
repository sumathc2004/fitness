'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, CreditCard, Download, FileText, IndianRupee, Layers, Plus, Ticket, Users } from 'lucide-react';
import type { Paginated } from '@gym/types';
import { useApi } from '@/lib/use-api';
import { useAuth } from '@/lib/auth-context';
import { inr } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, Skeleton } from '@/components/ui/misc';
import { EmptyState, ErrorState, Section, StatCard } from '@/components/dashboard/primitives';
import { Chip, ConfirmButton, FormRow, fmtDate, Modal, PageHeader, post, put, Select, Textarea, titleCase, useAction, today, num, ClientPicker } from '@/components/kit/kit';

const axis = { stroke: 'hsl(215 10% 40%)', fontSize: 12, tickLine: false, axisLine: false } as const;
const tip = { contentStyle: { background: 'hsl(var(--elevated))', border: '1px solid hsl(0 0% 100% / 0.1)', borderRadius: 8, fontSize: 12 } };
const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

// ───────────────────────── memberships
interface Plan { id: string; name: string; description: string | null; price: number; currency: string; durationDays: number; features: string[]; isActive: boolean; activeMembers: number }

export function MembershipsPage() {
  const { data, error, loading, reload } = useApi<{ items: Plan[] }>('/memberships');
  const [edit, setEdit] = useState<Plan | 'new' | null>(null);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  return (
    <div>
      <PageHeader description="Plans clients can be enrolled in." actions={<Button onClick={() => setEdit('new')}><Plus /> New plan</Button>} />
      {loading || !data ? <Skeleton className="h-56" /> : data.items.length === 0 ? <EmptyState icon={Ticket} title="No plans yet" action={<Button onClick={() => setEdit('new')}><Plus /> New plan</Button>} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((p) => (
            <div key={p.id} className={`surface-card flex flex-col gap-3 p-5 ${p.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between"><h3 className="font-display text-lg font-bold">{p.name}</h3>{!p.isActive && <Badge variant="muted">archived</Badge>}</div>
              <p className="font-display text-3xl font-bold">{inr(p.price)}<span className="text-sm font-medium text-muted-foreground"> / {p.durationDays} days</span></p>
              {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
              <ul className="flex-1 space-y-1 text-sm">{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
              <p className="text-xs text-muted-foreground">{p.activeMembers} active member{p.activeMembers === 1 ? '' : 's'}</p>
              <Button size="sm" variant="outline" onClick={() => setEdit(p)}>Edit</Button>
            </div>
          ))}
        </div>
      )}
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === 'new' ? 'New plan' : 'Edit plan'}>
        {edit && <PlanForm initial={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
      </Modal>
    </div>
  );
}

function PlanForm({ initial, onClose, onDone }: { initial?: Plan; onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const [f, setF] = useState({ name: initial?.name ?? '', description: initial?.description ?? '', price: initial ? String(initial.price) : '', durationDays: initial ? String(initial.durationDays) : '30', features: (initial?.features ?? []).join('\n'), isActive: initial?.isActive ?? true });
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const body = { name: f.name, description: f.description || null, price: Number(f.price), durationDays: Number(f.durationDays), features: f.features.split('\n').map((s) => s.trim()).filter(Boolean), isActive: f.isActive };
      if (await run(() => (initial ? put(`/memberships/${initial.id}`, body) : post('/memberships', body)), 'Plan saved')) onDone();
    }}>
      <FormRow label="Name">{(id) => <Input id={id} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</FormRow>
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Price (₹)">{(id) => <Input id={id} type="number" min={0} required value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />}</FormRow>
        <FormRow label="Duration (days)">{(id) => <Input id={id} type="number" min={1} required value={f.durationDays} onChange={(e) => setF({ ...f, durationDays: e.target.value })} />}</FormRow>
      </div>
      <FormRow label="Description">{(id) => <Input id={id} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</FormRow>
      <FormRow label="Features" hint="One per line">{(id) => <Textarea id={id} value={f.features} onChange={(e) => setF({ ...f, features: e.target.value })} />}</FormRow>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} className="size-4 accent-[hsl(var(--primary))]" /> Available for new subscriptions</label>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save plan</Button></div>
    </form>
  );
}

// ───────────────────────── subscriptions
interface Sub { id: string; clientId: string; clientName?: string; status: string; startDate: string; endDate: string; daysLeft: number; membership: { id: string; name: string; price: number } }

export function SubscriptionsPage() {
  const [filter, setFilter] = useState<'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'CANCELLED'>('ACTIVE');
  const path = filter === 'EXPIRING' ? '/subscriptions?expiringInDays=14' : `/subscriptions?status=${filter}`;
  const { data, error, loading, reload } = useApi<{ items: Sub[] }>(path);
  const plans = useApi<{ items: Plan[] }>('/memberships');
  const [open, setOpen] = useState(false);
  const { run } = useAction();
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  return (
    <div>
      <PageHeader description="Who is subscribed to what, and when it ends." actions={<Button onClick={() => setOpen(true)}><Plus /> Enrol client</Button>} />
      <div className="mb-4 flex gap-2">{(['ACTIVE', 'EXPIRING', 'EXPIRED', 'CANCELLED'] as const).map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f === 'EXPIRING' ? 'Expiring in 14 days' : titleCase(f)}</Chip>)}</div>
      {loading || !data ? <Skeleton className="h-56" /> : data.items.length === 0 ? <EmptyState icon={Layers} title="Nothing here" description="No subscriptions match this filter." /> : (
        <div className="surface-card overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="p-4 font-medium">Client</th><th className="p-4 font-medium">Plan</th><th className="p-4 font-medium">Period</th><th className="p-4 font-medium">Remaining</th><th /></tr></thead>
          <tbody className="divide-y divide-white/[0.05]">{data.items.map((s) => (
            <tr key={s.id}><td className="p-4 font-medium">{s.clientName}</td><td className="p-4">{s.membership.name}</td><td className="p-4 text-muted-foreground">{fmtDate(s.startDate)} → {fmtDate(s.endDate)}</td>
              <td className="p-4">{s.status === 'ACTIVE' ? <Badge variant={s.daysLeft <= 7 ? 'attention' : s.daysLeft <= 14 ? 'monitor' : 'good'}>{s.daysLeft} days</Badge> : <Badge variant="muted">{s.status.toLowerCase()}</Badge>}</td>
              <td className="p-4 text-right">{s.status === 'ACTIVE' && <ConfirmButton label="Cancel it?" onConfirm={async () => { if (await run(() => post(`/subscriptions/${s.id}/cancel`), 'Subscription cancelled')) reload(); }}>Cancel</ConfirmButton>}</td></tr>
          ))}</tbody></table></div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Enrol a client" description="Replaces their current subscription and creates an invoice.">
        <EnrolForm plans={(plans.data?.items ?? []).filter((p) => p.isActive)} onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload(); }} />
      </Modal>
    </div>
  );
}

function EnrolForm({ plans, onClose, onDone }: { plans: Plan[]; onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const [clientId, setClientId] = useState<string | null>(null);
  const [planId, setPlanId] = useState('');
  const [method, setMethod] = useState('CASH');
  const [paid, setPaid] = useState(true);
  const [start, setStart] = useState(today());
  const plan = plans.find((p) => p.id === (planId || plans[0]?.id));
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (!clientId || !plan) return; if (await run(() => post('/subscriptions', { clientId, membershipId: plan.id, method, markPaid: paid, startDate: start }), 'Client enrolled')) onDone(); }}>
      <FormRow label="Client">{() => <ClientPicker value={clientId} onChange={setClientId} />}</FormRow>
      <FormRow label="Plan">{(id) => <Select id={id} value={plan?.id ?? ''} onChange={(e) => setPlanId(e.target.value)}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {inr(p.price)} / {p.durationDays}d</option>)}</Select>}</FormRow>
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Start date">{(id) => <Input id={id} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}</FormRow>
        <FormRow label="Payment method">{(id) => <Select id={id} value={method} onChange={(e) => setMethod(e.target.value)}>{['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'OTHER'].map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</Select>}</FormRow>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="size-4 accent-[hsl(var(--primary))]" /> Payment received now</label>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy} disabled={!clientId || !plan}>Enrol</Button></div>
    </form>
  );
}

// ───────────────────────── payments
interface Pay { id: string; clientName?: string; invoiceNo: string | null; amount: number; currency: string; status: string; method: string; dueDate: string | null; paidAt: string | null; notes: string | null; createdAt: string }
interface PaySummary { revenueThisMonth: number; revenueLastMonth: number; pendingAmount: number; pendingCount: number; expiringIn14Days: number; activeMemberships: number }
const payTone = (s: string): 'good' | 'monitor' | 'attention' | 'muted' => (s === 'PAID' ? 'good' : s === 'PENDING' ? 'monitor' : s === 'FAILED' ? 'attention' : 'muted');

export function PaymentsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const sum = useApi<PaySummary>('/payments/summary');
  const { data, error, loading, reload } = useApi<Paginated<Pay>>(`/payments?page=${page}&pageSize=15${status ? `&status=${status}` : ''}`);
  const [open, setOpen] = useState(false);
  const { run } = useAction();
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const s = sum.data;
  return (
    <div className="space-y-6">
      <PageHeader description="Record and track payments. Online gateways can be plugged in later without changing this ledger." actions={<Button onClick={() => setOpen(true)}><Plus /> Record payment</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue this month" value={s ? inr(s.revenueThisMonth) : '…'} hint={s ? `Last month ${inr(s.revenueLastMonth)}` : undefined} icon={IndianRupee} tone="primary" />
        <StatCard label="Pending" value={s ? inr(s.pendingAmount) : '…'} hint={s ? `${s.pendingCount} payment${s.pendingCount === 1 ? '' : 's'}` : undefined} icon={CreditCard} tone={s && s.pendingCount > 0 ? 'attention' : 'default'} />
        <StatCard label="Active memberships" value={s?.activeMemberships ?? 0} icon={Users} />
        <StatCard label="Expiring in 14 days" value={s?.expiringIn14Days ?? 0} icon={Layers} />
      </div>
      <div className="flex gap-2">{['', 'PAID', 'PENDING', 'FAILED', 'REFUNDED'].map((x) => <Chip key={x} active={status === x} onClick={() => { setStatus(x); setPage(1); }}>{x ? titleCase(x) : 'All'}</Chip>)}</div>
      {loading || !data ? <Skeleton className="h-64" /> : data.items.length === 0 ? <EmptyState icon={CreditCard} title="No payments" /> : (
        <div className="surface-card overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="p-4 font-medium">Invoice</th><th className="p-4 font-medium">Client</th><th className="p-4 font-medium">Amount</th><th className="p-4 font-medium">Method</th><th className="p-4 font-medium">Status</th><th className="p-4 font-medium">Date</th><th /></tr></thead>
          <tbody className="divide-y divide-white/[0.05]">{data.items.map((p) => (
            <tr key={p.id}><td className="p-4 font-mono text-xs">{p.invoiceNo ?? '—'}</td><td className="p-4 font-medium">{p.clientName}</td><td className="p-4 tabular-nums">{inr(p.amount)}</td><td className="p-4 text-muted-foreground">{titleCase(p.method)}</td>
              <td className="p-4"><Badge variant={payTone(p.status)}>{p.status.toLowerCase()}</Badge></td><td className="p-4 text-muted-foreground">{fmtDate(p.paidAt ?? p.createdAt)}</td>
              <td className="p-4 text-right"><div className="flex justify-end gap-1.5">
                {p.status === 'PENDING' && <Button size="sm" variant="outline" onClick={async () => { if (await run(() => post(`/payments/${p.id}/status`, { status: 'PAID' }), 'Marked paid')) { reload(); sum.reload(); } }}>Mark paid</Button>}
                {p.status === 'PAID' && <ConfirmButton variant="ghost" label="Refund?" onConfirm={async () => { if (await run(() => post(`/payments/${p.id}/status`, { status: 'REFUNDED' }), 'Marked refunded')) { reload(); sum.reload(); } }}>Refund</ConfirmButton>}
              </div></td></tr>
          ))}</tbody></table>
          <div className="flex items-center justify-between border-t border-white/[0.05] p-4 text-sm text-muted-foreground"><span>{data.total} payments · page {page} of {pages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((x) => x + 1)}>Next</Button></div></div>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Record a payment"><PaymentForm onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload(); sum.reload(); }} /></Modal>
    </div>
  );
}

function PaymentForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { busy, run } = useAction();
  const [clientId, setClientId] = useState<string | null>(null);
  const [f, setF] = useState({ amount: '', method: 'CASH', status: 'PAID', notes: '' });
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); const a = num(f.amount); if (!clientId || !a) return; if (await run(() => post('/payments', { clientId, amount: a, method: f.method, status: f.status, notes: f.notes || null }), 'Payment recorded')) onDone(); }}>
      <FormRow label="Client">{() => <ClientPicker value={clientId} onChange={setClientId} />}</FormRow>
      <div className="grid grid-cols-3 gap-4">
        <FormRow label="Amount (₹)">{(id) => <Input id={id} type="number" min={1} required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />}</FormRow>
        <FormRow label="Method">{(id) => <Select id={id} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'OTHER'].map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</Select>}</FormRow>
        <FormRow label="Status">{(id) => <Select id={id} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="PAID">Paid</option><option value="PENDING">Pending</option></Select>}</FormRow>
      </div>
      <FormRow label="Notes">{(id) => <Input id={id} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={300} />}</FormRow>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy} disabled={!clientId}>Record</Button></div>
    </form>
  );
}

// ───────────────────────── analytics
interface AdminAnalytics {
  revenueByMonth: Array<{ month: string; revenue: number; newClients: number }>; clientStatus: Array<{ status: string; count: number }>; membershipMix: Array<{ plan: string; count: number }>;
  goalMix: Array<{ goal: string; count: number }>; attention: { good: number; monitor: number; attention: number }; weeklyAttendance: Array<{ week: string; checkIns: number }>;
  trainerPerformance: Array<{ trainerId: string; name: string; clients: number; workoutCompliance: number | null }>; workoutCompliance30d: { planned: number; done: number; rate: number | null };
}

function Donut({ data }: { data: Array<{ name: string; value: number }> }) {
  const rows = data.filter((d) => d.value > 0);
  if (rows.length === 0) return <EmptyState icon={BarChart3} title="No data yet" />;
  return (
    <div className="flex items-center gap-4"><ResponsiveContainer width={150} height={150}><PieChart><Pie data={rows} dataKey="value" innerRadius={42} outerRadius={68} paddingAngle={2} stroke="none">{rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip {...tip} /></PieChart></ResponsiveContainer>
      <ul className="space-y-1.5 text-sm">{rows.map((r, i) => <li key={r.name} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{titleCase(r.name)} <span className="text-muted-foreground">· {r.value}</span></li>)}</ul></div>
  );
}

export function AnalyticsPage() {
  const { data: a, error, loading, reload } = useApi<AdminAnalytics>('/analytics/admin');
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !a) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-6">
      <PageHeader description="Revenue, growth, attendance and training compliance across the gym." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Revenue · last 6 months"><ResponsiveContainer width="100%" height={220}><BarChart data={a.revenueByMonth} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}><CartesianGrid vertical={false} stroke="hsl(0 0% 100% / 0.05)" /><XAxis dataKey="month" {...axis} /><YAxis {...axis} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} /><Tooltip {...tip} formatter={(v: number) => [inr(v), 'Revenue']} cursor={{ fill: 'hsl(0 0% 100% / 0.04)' }} /><Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[6, 6, 2, 2]} maxBarSize={36} /></BarChart></ResponsiveContainer></Section>
        <Section title="New clients per month"><ResponsiveContainer width="100%" height={220}><BarChart data={a.revenueByMonth} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="hsl(0 0% 100% / 0.05)" /><XAxis dataKey="month" {...axis} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} cursor={{ fill: 'hsl(0 0% 100% / 0.04)' }} /><Bar dataKey="newClients" fill="hsl(var(--chart-2))" radius={[6, 6, 2, 2]} maxBarSize={36} /></BarChart></ResponsiveContainer></Section>
        <Section title="Check-ins per week"><ResponsiveContainer width="100%" height={220}><BarChart data={a.weeklyAttendance} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="hsl(0 0% 100% / 0.05)" /><XAxis dataKey="week" {...axis} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} cursor={{ fill: 'hsl(0 0% 100% / 0.04)' }} /><Bar dataKey="checkIns" fill="hsl(var(--chart-3))" radius={[6, 6, 2, 2]} maxBarSize={36} /></BarChart></ResponsiveContainer></Section>
        <Section title="Workout compliance · 30 days" description={`${a.workoutCompliance30d.done} of ${a.workoutCompliance30d.planned} assigned workouts completed`}><p className="font-display text-5xl font-bold">{a.workoutCompliance30d.rate == null ? '—' : `${a.workoutCompliance30d.rate}%`}</p>{a.workoutCompliance30d.rate == null && <p className="mt-1 text-sm text-muted-foreground">No workouts were scheduled in this window.</p>}</Section>
        <Section title="Client attention"><Donut data={[{ name: 'good', value: a.attention.good }, { name: 'monitor', value: a.attention.monitor }, { name: 'needs attention', value: a.attention.attention }]} /></Section>
        <Section title="Goals"><Donut data={a.goalMix.map((g) => ({ name: g.goal, value: g.count }))} /></Section>
        <Section title="Memberships"><Donut data={a.membershipMix.map((g) => ({ name: g.plan, value: g.count }))} /></Section>
        <Section title="Client status"><Donut data={a.clientStatus.map((g) => ({ name: g.status, value: g.count }))} /></Section>
      </div>
      <Section title="Trainer performance" description="Share of assigned workouts completed in the last 30 days.">
        {a.trainerPerformance.length === 0 ? <EmptyState icon={Users} title="No trainers" /> : <table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="pb-2 font-medium">Trainer</th><th className="pb-2 font-medium">Clients</th><th className="pb-2 font-medium">Compliance</th></tr></thead><tbody className="divide-y divide-white/[0.05]">{a.trainerPerformance.map((t) => <tr key={t.trainerId}><td className="py-2.5 font-medium">{t.name}</td><td className="py-2.5 text-muted-foreground">{t.clients}</td><td className="py-2.5">{t.workoutCompliance == null ? <span className="text-muted-foreground">No data</span> : <Badge variant={t.workoutCompliance >= 70 ? 'good' : t.workoutCompliance >= 40 ? 'monitor' : 'attention'}>{t.workoutCompliance}%</Badge>}</td></tr>)}</tbody></table>}
      </Section>
    </div>
  );
}

// ───────────────────────── reports
interface Report {
  month: string; clientName: string; goal: string | null;
  body: { weightChangeKg: number | null; waistChangeCm: number | null; estimatedBodyFatChangePct: number | null; leanMassChangeKg: number | null };
  training: { planned: number; completed: number; compliancePct: number | null }; nutrition: { mealsPlanned: number; mealsCompleted: number; compliancePct: number | null };
  attendance: { present: number; absent: number; leave: number }; habits: { avgWaterMl: number | null; avgSleepHours: number | null };
  strength: Array<{ exercise: string; estimatedOneRepMaxKg: number }>; trainerComment: string | null;
}

export function ReportsPage() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [month, setMonth] = useState(today().slice(0, 7));
  const { data, error, loading, reload } = useApi<Report>(clientId ? `/reports/monthly?clientId=${clientId}&month=${month}` : null);
  const [comment, setComment] = useState('');
  const { busy, run } = useAction();
  const dash = (v: number | null, u = '') => (v == null ? 'No data' : `${v > 0 && u !== '%' ? '+' : ''}${v}${u}`);
  return (
    <div className="space-y-6">
      <PageHeader description="Monthly client report. Download as PDF to share with the client." />
      <div className="flex flex-wrap items-center gap-3"><ClientPicker value={clientId} onChange={setClientId} /><input type="month" value={month} max={today().slice(0, 7)} onChange={(e) => setMonth(e.target.value || today().slice(0, 7))} className="h-11 rounded-md border border-input bg-white/[0.03] px-3 text-sm" aria-label="Month" />
        {clientId && <a href={`/api/reports/monthly.pdf?clientId=${clientId}&month=${month}`} className="inline-flex h-11 items-center gap-2 rounded-md border border-white/15 px-5 text-sm font-semibold hover:border-primary/60 hover:text-primary"><Download className="size-4" /> Download PDF</a>}</div>
      {error ? <ErrorState message={error.message} onRetry={reload} /> : !clientId || loading || !data ? (clientId ? <Skeleton className="h-72" /> : <EmptyState icon={FileText} title="Pick a client" />) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Section title={`${data.clientName} · ${data.month}`} description={data.goal ? `Goal: ${titleCase(data.goal)}` : undefined} className="md:col-span-2"><div className="grid gap-4 text-sm sm:grid-cols-4">
            {([['Weight change', dash(data.body.weightChangeKg, ' kg')], ['Waist change', dash(data.body.waistChangeCm, ' cm')], ['Est. body fat change', dash(data.body.estimatedBodyFatChangePct, ' pts')], ['Est. lean mass change', dash(data.body.leanMassChangeKg, ' kg')]] as const).map(([k, v]) => <div key={k}><p className="text-xs uppercase tracking-wider text-muted-foreground">{k}</p><p className="mt-1 font-display text-xl font-bold">{v}</p></div>)}</div></Section>
          <Section title="Training"><p className="font-display text-3xl font-bold">{data.training.compliancePct == null ? '—' : `${data.training.compliancePct}%`}</p><p className="text-sm text-muted-foreground">{data.training.completed} of {data.training.planned} workouts completed</p></Section>
          <Section title="Nutrition"><p className="font-display text-3xl font-bold">{data.nutrition.compliancePct == null ? '—' : `${data.nutrition.compliancePct}%`}</p><p className="text-sm text-muted-foreground">{data.nutrition.mealsCompleted} of {data.nutrition.mealsPlanned} meals completed</p></Section>
          <Section title="Attendance & habits"><ul className="space-y-1 text-sm"><li>{data.attendance.present} days attended · {data.attendance.absent} absent · {data.attendance.leave} leave</li><li>Avg water: {data.habits.avgWaterMl ?? 'no data'}{data.habits.avgWaterMl ? ' ml' : ''}</li><li>Avg sleep: {data.habits.avgSleepHours ?? 'no data'}{data.habits.avgSleepHours ? ' h' : ''}</li></ul></Section>
          <Section title="Strength (est. 1RM)">{data.strength.length === 0 ? <p className="text-sm text-muted-foreground">No logged sets this month.</p> : <ul className="space-y-1 text-sm">{data.strength.map((s) => <li key={s.exercise} className="flex justify-between"><span>{s.exercise}</span><span className="font-semibold">{s.estimatedOneRepMaxKg} kg</span></li>)}</ul>}</Section>
          <Section title="Trainer comment" className="md:col-span-2" description="Included in the PDF and sent to the client.">
            {data.trainerComment && <p className="mb-3 whitespace-pre-wrap text-sm">{data.trainerComment}</p>}
            {user?.role !== 'CLIENT' && <><Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={data.trainerComment ? 'Replace the comment…' : 'Write a summary for the client'} /><div className="mt-3 flex justify-end"><Button size="sm" loading={busy} disabled={!comment.trim()} onClick={async () => {
              const [y, m] = month.split('-').map(Number) as [number, number];
              const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
              if (await run(() => post('/progress/review', { clientId, period: 'MONTHLY', periodStart: `${month}-01`, periodEnd: end, trainerComment: comment.trim() }), 'Comment saved')) { setComment(''); reload(); }
            }}>Save comment</Button></div></>}
          </Section>
        </div>
      )}
    </div>
  );
}

export function TrainerAnalyticsPage() {
  const { data, error, loading, reload } = useApi<{ clients: number; attention: { good: number; monitor: number; attention: number }; goalMix: Array<{ goal: string; count: number }>; weeklyAttendance: Array<{ week: string; checkIns: number }>; workoutCompliance30d: { planned: number; done: number; rate: number | null }; perClient: Array<{ clientId: string; name: string; workoutCompliance: number | null; dietCompliance: number | null; attendance30d: number }> }>('/analytics/trainer');
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-72" />;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Check-ins per week"><ResponsiveContainer width="100%" height={200}><BarChart data={data.weeklyAttendance} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="hsl(0 0% 100% / 0.05)" /><XAxis dataKey="week" {...axis} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} cursor={{ fill: 'hsl(0 0% 100% / 0.04)' }} /><Bar dataKey="checkIns" fill="hsl(var(--chart-3))" radius={[6, 6, 2, 2]} maxBarSize={36} /></BarChart></ResponsiveContainer></Section>
        <Section title="Your clients"><Donut data={[{ name: 'good', value: data.attention.good }, { name: 'monitor', value: data.attention.monitor }, { name: 'needs attention', value: data.attention.attention }]} /></Section>
      </div>
      <Section title="Per-client compliance · 30 days" description="Lowest first, so you can see who needs a nudge.">
        <table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="pb-2 font-medium">Client</th><th className="pb-2 font-medium">Workouts</th><th className="pb-2 font-medium">Meals</th><th className="pb-2 font-medium">Check-ins</th></tr></thead><tbody className="divide-y divide-white/[0.05]">{data.perClient.map((c) => <tr key={c.clientId}><td className="py-2.5 font-medium">{c.name}</td><td className="py-2.5">{c.workoutCompliance == null ? <span className="text-muted-foreground">—</span> : `${c.workoutCompliance}%`}</td><td className="py-2.5">{c.dietCompliance == null ? <span className="text-muted-foreground">—</span> : `${c.dietCompliance}%`}</td><td className="py-2.5">{c.attendance30d}</td></tr>)}</tbody></table>
      </Section>
    </div>
  );
}

