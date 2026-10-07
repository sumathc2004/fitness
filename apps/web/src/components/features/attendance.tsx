'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { CalendarCheck, QrCode, ScanLine } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, Skeleton } from '@/components/ui/misc';
import { EmptyState, ErrorState, Section, StatCard } from '@/components/dashboard/primitives';
import { fmtDate, fmtTime, PageHeader, post, Select, titleCase, today, useAction, WithClient, Chip } from '@/components/kit/kit';

interface Rec { id: string; date: string; status: string; method: string; checkInAt: string | null; checkOutAt: string | null; notes: string | null }
interface History { items: Rec[]; summary: { days: number; attended: number; absent: number; leave: number } }
const tone = (s: string): 'good' | 'monitor' | 'attention' | 'muted' => (s === 'PRESENT' ? 'good' : s === 'LATE' ? 'monitor' : s === 'ABSENT' ? 'attention' : 'muted');

export function AttendanceHistory({ clientId }: { clientId?: string | null }) {
  const { data, error, loading, reload } = useApi<History>(`/attendance/history${clientId ? `?clientId=${clientId}` : ''}`);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Days attended" value={data.summary.attended} hint={`last ${data.summary.days} days`} icon={CalendarCheck} tone="primary" />
        <StatCard label="Absent" value={data.summary.absent} icon={CalendarCheck} />
        <StatCard label="On leave" value={data.summary.leave} icon={CalendarCheck} />
      </div>
      <Section title="History">
        {data.items.length === 0 ? <EmptyState icon={CalendarCheck} title="No attendance yet" description="Check-ins appear here once the QR code is scanned or the trainer marks the day." /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="pb-2 font-medium">Date</th><th className="pb-2 font-medium">Status</th><th className="pb-2 font-medium">In</th><th className="pb-2 font-medium">Out</th><th className="pb-2 font-medium">Method</th></tr></thead>
            <tbody className="divide-y divide-white/[0.05]">{data.items.map((r) => <tr key={r.id}><td className="py-2.5">{fmtDate(r.date)}</td><td className="py-2.5"><Badge variant={tone(r.status)}>{r.status.toLowerCase()}</Badge></td><td className="py-2.5 text-muted-foreground">{fmtTime(r.checkInAt)}</td><td className="py-2.5 text-muted-foreground">{fmtTime(r.checkOutAt)}</td><td className="py-2.5 text-muted-foreground">{titleCase(r.method)}</td></tr>)}</tbody></table></div>
        )}
      </Section>
    </div>
  );
}

function MyQr() {
  const { data } = useApi<{ code: string | null }>('/attendance/my-qr');
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => { if (data?.code) void QRCode.toDataURL(data.code, { margin: 1, width: 260, color: { dark: '#0b0f0c', light: '#ffffff' } }).then(setImg); }, [data?.code]);
  return (
    <Section title="Your check-in code" description="Show this at the front desk or scan it at the door. First scan checks you in, the next checks you out.">
      {!data ? <Skeleton className="size-64" /> : !data.code ? <EmptyState icon={QrCode} title="No code yet" description="Ask your trainer to generate your check-in code." /> : (
        <div className="flex flex-wrap items-center gap-6">
          {img && <img src={img} alt={`Check-in QR code ${data.code}`} className="size-56 rounded-xl bg-white p-2" />}
          <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Code</p><p className="font-mono text-2xl font-bold tracking-wider">{data.code}</p></div>
        </div>
      )}
    </Section>
  );
}

interface Day { date: string; rows: Array<{ clientId: string; name: string; qrCode: string | null; record: Rec | null }>; totals: { present: number; late: number; leave: number; absent: number; unmarked: number } }

function DayView() {
  const [date, setDate] = useState(today());
  const { data, error, loading, reload } = useApi<Day>(`/attendance/day?date=${date}`);
  const { busy, run } = useAction();
  const [code, setCode] = useState('');
  const [last, setLast] = useState<string | null>(null);
  const scan = useRef<HTMLInputElement>(null);
  useEffect(() => { scan.current?.focus(); }, []);
  const mark = async (clientId: string, status: string) => { if (await run(() => post('/attendance/mark', { clientId, date, status }))) reload(); };
  const submitScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await run(() => post<{ action: string; client: { name: string } }>('/attendance/scan', { code: code.trim() }));
    setCode('');
    if (r) { setLast(`${r.client.name} — ${r.action === 'CHECK_IN' ? 'checked in' : 'checked out'}`); reload(); }
    scan.current?.focus();
  };
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  return (
    <div className="space-y-6">
      <Section title="Scan a check-in code" description="Point a USB/Bluetooth barcode scanner at the client’s QR code (it types the code and presses Enter), or type it in.">
        <form onSubmit={submitScan} className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1"><ScanLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input ref={scan} value={code} onChange={(e) => setCode(e.target.value)} placeholder="GYM-XXXXXX" className="pl-9 font-mono uppercase" aria-label="Check-in code" /></div>
          <Button type="submit" loading={busy} disabled={!code.trim()}>Check in / out</Button>
        </form>
        {last && <p role="status" className="mt-3 text-sm font-medium text-good">{last}</p>}
      </Section>
      <Section title="Daily register" action={<input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} className="h-9 rounded-md border border-input bg-white/[0.03] px-3 text-sm" aria-label="Date" />}>
        {loading || !data ? <Skeleton className="h-48" /> : (
          <>
            <div className="mb-4 flex flex-wrap gap-2"><Badge variant="good">{data.totals.present} present</Badge><Badge variant="monitor">{data.totals.late} late</Badge><Badge variant="muted">{data.totals.leave} leave</Badge><Badge variant="attention">{data.totals.absent} absent</Badge><Badge>{data.totals.unmarked} unmarked</Badge></div>
            {data.rows.length === 0 ? <EmptyState icon={CalendarCheck} title="No active clients" /> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="pb-2 font-medium">Client</th><th className="pb-2 font-medium">Status</th><th className="pb-2 font-medium">In / out</th><th className="pb-2 font-medium">Mark</th></tr></thead>
                <tbody className="divide-y divide-white/[0.05]">{data.rows.map((r) => (
                  <tr key={r.clientId}><td className="py-2.5 font-medium">{r.name}</td>
                    <td className="py-2.5">{r.record ? <Badge variant={tone(r.record.status)}>{r.record.status.toLowerCase()}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-2.5 text-muted-foreground">{r.record?.checkInAt ? `${fmtTime(r.record.checkInAt)} → ${fmtTime(r.record.checkOutAt)}` : '—'}</td>
                    <td className="py-2.5"><div className="flex flex-wrap gap-1.5">{['PRESENT', 'LATE', 'ABSENT', 'LEAVE'].map((s) => <Chip key={s} active={r.record?.status === s} onClick={() => void mark(r.clientId, s)}>{titleCase(s)}</Chip>)}</div></td></tr>
                ))}</tbody></table></div>
            )}
          </>
        )}
      </Section>
    </div>
  );
}

export function AttendancePage({ isClient }: { isClient: boolean }) {
  const [view, setView] = useState<'day' | 'client'>('day');
  if (isClient) return (<div className="space-y-6"><PageHeader description="Your check-ins and streaks." /><MyQr /><AttendanceHistory /></div>);
  return (
    <div>
      <PageHeader description="Mark the register, scan check-in codes and review a client’s history." actions={<Select aria-label="View" value={view} onChange={(e) => setView(e.target.value as 'day' | 'client')} className="h-10 w-44"><option value="day">Daily register</option><option value="client">Client history</option></Select>} />
      {view === 'day' ? <DayView /> : <WithClient isClient={false}>{(id) => <AttendanceHistory clientId={id} />}</WithClient>}
    </div>
  );
}
