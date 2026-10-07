'use client';

import * as React from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ClientListItem, Paginated } from '@gym/types';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/misc';

// ───────────────────────── actions
/** Runs an API call with a loading flag, a success toast and the server's error message as a toast. Returns null on failure. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>, success?: string): Promise<T | null> => {
    setBusy(true);
    try {
      const r = await fn();
      if (success) toast.success(success);
      return r;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong');
      return null;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, run };
}

/** Field-level errors from a 400 response → { field: message } (first message per field). */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || !e.details) return {};
  return Object.fromEntries(Object.entries(e.details).map(([k, v]) => [k, v[0] ?? 'Invalid']));
}

export const post = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
export const put = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'PUT', body: body ?? {} });
export const patch = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body: body ?? {} });
export const del = <T,>(path: string) => api<T>(path, { method: 'DELETE' });

// ───────────────────────── layout
export function PageHeader({ title, description, actions }: { title?: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {title && <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>}
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, description, children, wide }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div role="dialog" aria-modal="true" aria-label={title} className={cn('surface-card relative my-6 w-full p-6 shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.18 }}>
            <button onClick={onClose} className="absolute right-4 top-4 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.06]" aria-label="Close"><X className="size-4" /></button>
            <h3 className="pr-8 font-display text-lg font-bold tracking-tight">{title}</h3>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            <div className="mt-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const fieldCls = 'flex w-full rounded-md border border-input bg-white/[0.03] px-3.5 text-sm text-foreground transition-colors focus-visible:border-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-50 aria-[invalid=true]:border-destructive/70';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <select ref={ref} className={cn(fieldCls, 'h-11 [&>option]:bg-elevated', className)} {...p}>{children}</select>
));
Select.displayName = 'Select';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(fieldCls, 'min-h-[88px] py-2.5', className)} {...p} />
));
Textarea.displayName = 'Textarea';

/** Labelled form row that takes any control as its child. */
export function FormRow({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: (id: string) => React.ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      {children(id)}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ id: T; label: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cn('whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors', value === t.id ? 'bg-white/[0.09] text-foreground' : 'text-muted-foreground hover:text-foreground')}>{t.label}</button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={cn('rounded-full border px-3 py-1 text-xs font-semibold transition-colors', active ? 'border-primary/50 bg-primary/10 text-primary' : 'border-white/10 text-muted-foreground hover:text-foreground')}>{children}</button>;
}

export function SearchBox({ value, onChange, placeholder = 'Search…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" aria-label={placeholder} />
    </div>
  );
}

export function ConfirmButton({ children, onConfirm, label = 'Are you sure?', variant = 'outline', size = 'sm', disabled }: { children: React.ReactNode; onConfirm: () => void; label?: string; variant?: 'outline' | 'destructive' | 'ghost'; size?: 'sm' | 'default'; disabled?: boolean }) {
  const [asking, setAsking] = useState(false);
  useEffect(() => { if (!asking) return; const t = setTimeout(() => setAsking(false), 4000); return () => clearTimeout(t); }, [asking]);
  return asking ? (
    <Button variant="destructive" size={size} onClick={() => { setAsking(false); onConfirm(); }}>{label}</Button>
  ) : (
    <Button variant={variant} size={size} disabled={disabled} onClick={() => setAsking(true)}>{children}</Button>
  );
}

// ───────────────────────── client scoping
const KEY = 'gp_selected_client';

/** Staff pick a client; the choice is remembered between pages. Clients get `null` and the API uses their own session. */
export function useClients() {
  return useApi<Paginated<ClientListItem>>('/clients?pageSize=100');
}

export function ClientPicker({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const { data, loading } = useClients();
  useEffect(() => {
    if (!data || data.items.length === 0) return;
    if (!value || !data.items.some((c) => c.id === value)) {
      let saved: string | null = null;
      try { saved = localStorage.getItem(KEY); } catch { /* storage unavailable */ }
      onChange(data.items.find((c) => c.id === saved)?.id ?? data.items[0]!.id);
    }
  }, [data, value, onChange]);
  if (loading || !data) return <div className="h-11 w-64 animate-pulse rounded-md bg-white/[0.05]" />;
  if (data.items.length === 0) return <p className="text-sm text-muted-foreground">No clients yet.</p>;
  const current = data.items.find((c) => c.id === value);
  return (
    <div className="flex items-center gap-2.5">
      {current && <Avatar name={current.name} size={34} />}
      <Select aria-label="Client" className="w-64" value={value ?? ''} onChange={(e) => { try { localStorage.setItem(KEY, e.target.value); } catch { /* ignore */ } onChange(e.target.value); }}>
        {data.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
    </div>
  );
}

/** Renders `children(clientId)`; for staff it shows a picker first, for clients it passes `null` (= "me"). */
export function WithClient({ isClient, children, header }: { isClient: boolean; children: (clientId: string | null, qs: string) => React.ReactNode; header?: React.ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const pick = useCallback((v: string) => setId(v), []);
  if (isClient) return <>{children(null, '')}</>;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><ClientPicker value={id} onChange={pick} />{header}</div>
      {id && <React.Fragment key={id}>{children(id, `clientId=${id}`)}</React.Fragment>}
    </div>
  );
}

/** Appends a clientId query parameter to a path when acting for a client as staff. */
export const withQs = (path: string, qs: string) => (qs ? `${path}${path.includes('?') ? '&' : '?'}${qs}` : path);

export const today = () => new Date().toISOString().slice(0, 10);
export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');
export const titleCase = (s: string) => (s === 'UPI' ? 'UPI' : s.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()));
export const num = (v: string): number | null => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));
