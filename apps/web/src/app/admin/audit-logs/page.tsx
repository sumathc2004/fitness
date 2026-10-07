'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import type { AuditLogItem, Paginated } from '@gym/types';
import { useApi } from '@/lib/use-api';
import { timeAgo } from '@/lib/utils';
import { EmptyState, ErrorState, Section } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { Badge, Skeleton } from '@/components/ui/misc';

const FILTERS = ['ALL', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGED', 'PASSWORD_RESET', 'ACCOUNT_LOCKED', 'REFRESH_TOKEN_REUSE'];
const tone = (a: string): 'good' | 'attention' | 'monitor' | 'muted' =>
  a === 'LOGIN' ? 'good' : /FAILED|LOCKED|REUSE/.test(a) ? 'attention' : /PASSWORD/.test(a) ? 'monitor' : 'muted';

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('ALL');
  const { data, error, loading, reload } = useApi<Paginated<AuditLogItem>>(`/admin/audit-logs?page=${page}&pageSize=20${action === 'ALL' ? '' : `&action=${action}`}`);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Section title="Audit log" description="Sign-ins, security events and administrative actions — newest first.">
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => { setAction(f); setPage(1); }} className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${action === f ? 'border-primary/50 bg-primary/10 text-primary' : 'border-white/10 text-muted-foreground hover:text-foreground'}`}>
            {f === 'ALL' ? 'All events' : f.replaceAll('_', ' ').toLowerCase()}
          </button>
        ))}
      </div>
      {loading || !data ? (
        <Skeleton className="h-72" />
      ) : data.items.length === 0 ? (
        <EmptyState icon={ScrollText} title="No events" description="Nothing has been recorded for this filter yet." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="pb-2 font-medium">When</th><th className="pb-2 font-medium">Event</th><th className="pb-2 font-medium">Who</th><th className="pb-2 font-medium">IP</th></tr></thead>
              <tbody className="divide-y divide-white/[0.05]">
                {data.items.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap py-3 text-muted-foreground" title={new Date(l.at).toLocaleString()}>{timeAgo(l.at)}</td>
                    <td className="py-3"><Badge variant={tone(l.action)}>{l.action.replaceAll('_', ' ').toLowerCase()}</Badge></td>
                    <td className="py-3">{l.actorName ?? <span className="text-muted-foreground">anonymous</span>}{l.actorEmail && <span className="block text-xs text-muted-foreground">{l.actorEmail}</span>}</td>
                    <td className="py-3 font-mono text-xs text-muted-foreground">{l.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>{data.total.toLocaleString()} events · page {page} of {pages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft /> Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight /></Button>
            </div>
          </div>
        </>
      )}
    </Section>
  );
}
