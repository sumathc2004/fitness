'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useAuth } from '@/lib/auth-context';
import { useSocketEvent } from '@/lib/realtime';
import { cn, timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, Badge, Skeleton } from '@/components/ui/misc';
import { EmptyState, ErrorState } from '@/components/dashboard/primitives';
import { fmtTime, PageHeader, post, titleCase, useAction } from '@/components/kit/kit';

interface Contact { userId: string; name: string; role: string }
interface Convo { userId: string; name: string; role: string | null; lastMessage: string; lastAt: string; unread: number }
interface Msg { id: string; senderId: string; recipientId: string; body: string; readAt: string | null; at: string }

export function MessagesPage() {
  const { user } = useAuth();
  const contacts = useApi<{ items: Contact[] }>('/messages/contacts');
  const convos = useApi<{ items: Convo[] }>('/messages/conversations');
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [loadingThread, setLoadingThread] = useState(false);
  const { busy, run } = useAction();
  const bottom = useRef<HTMLDivElement>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = active;

  const loadThread = useCallback(async (id: string, quiet = false) => {
    if (!quiet) setLoadingThread(true);
    try { const r = await api<{ items: Msg[] }>(`/messages/with/${id}`); if (activeRef.current === id) setMsgs(r.items); }
    catch { /* shown by empty state */ } finally { setLoadingThread(false); }
  }, []);

  useEffect(() => { if (active) void loadThread(active); else setMsgs([]); }, [active, loadThread]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);

  // live updates + a slow poll as a fallback when websockets are blocked
  useSocketEvent<Msg>('message:new', (m) => {
    const other = m.senderId === user?.id ? m.recipientId : m.senderId;
    if (other === activeRef.current) void loadThread(other, true); else convos.reload();
    convos.reload();
  });
  useEffect(() => { const t = setInterval(() => { convos.reload(); if (activeRef.current) void loadThread(activeRef.current, true); }, 20_000); return () => clearInterval(t); }, [convos, loadThread]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !active) return;
    const r = await run(() => post<Msg>('/messages', { recipientId: active, body }));
    if (r) { setText(''); await loadThread(active, true); convos.reload(); }
  };

  if (contacts.error) return <ErrorState message={contacts.error.message} onRetry={contacts.reload} />;
  const people = contacts.data?.items ?? [];
  const list = convos.data?.items ?? [];
  const known = new Set(list.map((c) => c.userId));
  const rows: Array<{ userId: string; name: string; sub: string; unread: number; role: string | null }> = [
    ...list.map((c) => ({ userId: c.userId, name: c.name, sub: c.lastMessage, unread: c.unread, role: c.role })),
    ...people.filter((p) => !known.has(p.userId)).map((p) => ({ userId: p.userId, name: p.name, sub: 'Start a conversation', unread: 0, role: p.role })),
  ];
  const current = rows.find((r) => r.userId === active);

  return (
    <div>
      <PageHeader description="Messages arrive instantly. You can message your trainer, your clients and the gym admin." />
      <div className="surface-card grid h-[calc(100vh-14rem)] min-h-[460px] overflow-hidden lg:grid-cols-[320px_1fr]">
        <aside className={cn('overflow-y-auto border-white/[0.06] lg:border-r', active && 'hidden lg:block')} aria-label="Conversations">
          {contacts.loading ? <div className="space-y-2 p-3"><Skeleton className="h-14" /><Skeleton className="h-14" /></div> : rows.length === 0 ? <div className="p-4"><EmptyState icon={MessageSquare} title="No contacts yet" description="Once a trainer and client are linked you can chat here." /></div> : (
            <ul>{rows.map((r) => (
              <li key={r.userId}><button onClick={() => setActive(r.userId)} className={cn('flex w-full items-center gap-3 border-b border-white/[0.04] p-3.5 text-left transition-colors hover:bg-white/[0.03]', active === r.userId && 'bg-white/[0.06]')}>
                <Avatar name={r.name} size={40} /><div className="min-w-0 flex-1"><p className="truncate font-medium">{r.name}</p><p className="truncate text-xs text-muted-foreground">{r.sub}</p></div>
                {r.unread > 0 && <Badge variant="primary">{r.unread}</Badge>}
              </button></li>
            ))}</ul>
          )}
        </aside>
        <section className={cn('flex min-h-0 flex-col', !active && 'hidden lg:flex')} aria-label="Conversation">
          {!current ? <div className="grid flex-1 place-items-center p-6"><EmptyState icon={MessageSquare} title="Select a conversation" /></div> : (
            <>
              <header className="flex items-center gap-3 border-b border-white/[0.06] p-3.5">
                <button className="text-sm text-muted-foreground lg:hidden" onClick={() => setActive(null)}>← Back</button>
                <Avatar name={current.name} size={36} /><div><p className="font-medium leading-tight">{current.name}</p><p className="text-xs text-muted-foreground">{current.role ? titleCase(current.role) : ''}</p></div>
              </header>
              <div className="flex-1 space-y-2.5 overflow-y-auto p-4" aria-live="polite">
                {loadingThread ? <Skeleton className="h-16 w-2/3" /> : msgs.length === 0 ? <p className="mt-10 text-center text-sm text-muted-foreground">No messages yet — say hello.</p> : msgs.map((m) => {
                  const mine = m.senderId === user?.id;
                  return (
                    <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[78%] rounded-2xl px-3.5 py-2 text-sm', mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-white/[0.07]')}>
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{fmtTime(m.at)}{mine && m.readAt && <CheckCheck className="size-3" aria-label="Read" />}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottom} />
              </div>
              <form onSubmit={send} className="flex gap-2 border-t border-white/[0.06] p-3">
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" maxLength={2000} aria-label="Message" autoFocus />
                <Button type="submit" loading={busy} disabled={!text.trim()} aria-label="Send"><Send /></Button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// ───────────────────────── notifications
interface Notif { id: string; type: string; title: string; body: string | null; read: boolean; at: string }
interface NotifList { unread: number; items: Notif[] }

export function NotificationsPage() {
  const { data, error, loading, reload } = useApi<NotifList>('/notifications?limit=100');
  const { run } = useAction();
  useSocketEvent('notification:new', () => reload());
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  return (
    <div>
      <PageHeader description="Reminders, assignments and feedback." actions={<Button variant="outline" size="sm" disabled={!data?.unread} onClick={async () => { if (await run(() => post('/notifications/read-all'))) reload(); }}><CheckCheck /> Mark all read</Button>} />
      {loading || !data ? <Skeleton className="h-64" /> : data.items.length === 0 ? <EmptyState icon={Bell} title="You’re all caught up" description="New workouts, meals, messages and reminders will show up here." /> : (
        <div className="surface-card divide-y divide-white/[0.05]">
          {data.items.map((n) => (
            <button key={n.id} onClick={async () => { if (!n.read) { await post(`/notifications/${n.id}/read`); reload(); } }} className={cn('flex w-full items-start gap-3.5 p-4 text-left transition-colors hover:bg-white/[0.02]', !n.read && 'bg-primary/[0.04]')}>
              <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} />
              <div className="min-w-0 flex-1"><p className="font-medium">{n.title}</p>{n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}<p className="mt-1 text-xs text-muted-foreground">{titleCase(n.type)} · {timeAgo(n.at)}</p></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Header bell: live unread count + toast on new notifications. */
export function NotificationBell({ href }: { href: string }) {
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => { api<NotifList>('/notifications?limit=1').then((r) => setCount(r.unread)).catch(() => undefined); }, []);
  useEffect(() => { refresh(); const t = setInterval(refresh, 60_000); return () => clearInterval(t); }, [refresh]);
  useSocketEvent<{ title: string }>('notification:new', (n) => { toast(n.title); refresh(); });
  return (
    <Link href={href} className="relative grid size-10 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground" aria-label={count ? `${count} unread notifications` : 'Notifications'}>
      <Bell className="size-[18px]" />
      {count > 0 && <span className="absolute right-1.5 top-1.5 grid min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">{count > 9 ? '9+' : count}</span>}
    </Link>
  );
}

