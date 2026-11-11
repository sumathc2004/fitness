'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen, UserCircle, X } from 'lucide-react';
import { ROLE_HOME, ROLE_LABEL, type RoleName } from '@gym/config';
import { NotificationBell } from '@/components/features/messages';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { findNav, findSection, ROLE_ICON, SECTIONS, type NavSection } from './nav-config';

const COLLAPSE_KEY = 'gp_sidebar_collapsed';
// useLayoutEffect on the client (no flash of the wrong accent), useEffect during SSR (avoids the warning).
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="SVD Fitness OS home">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary font-display text-sm font-extrabold text-primary-foreground shadow-glow">S</span>
      {!compact && <span className="font-display text-[15px] font-bold tracking-tight">SVD Fitness <span className="text-primary">OS</span></span>}
    </Link>
  );
}

/** The 6 sidebar sections. A section links to its first page; its other pages are tabs under the header. */
function SideNav({ role, collapsed = false, onNavigate }: { role: RoleName; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname() ?? '';
  const current = findSection(role, pathname);
  return (
    <nav aria-label="Main">
      <ul className="space-y-1">
        {SECTIONS[role].map((s) => {
          const active = s === current;
          const Icon = s.icon;
          return (
            <li key={s.label}>
              <Link
                href={s.items[0]!.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? s.label : undefined}
                className={cn(
                  'group relative flex items-center rounded-xl text-[15px] font-medium transition-colors',
                  collapsed ? 'mx-auto size-11 justify-center' : 'gap-3 px-3.5 py-2.5',
                  active ? 'text-foreground' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
                )}
              >
                {active && <motion.span layoutId={`nav-active-${onNavigate ? 'm' : 'd'}`} className="absolute inset-0 rounded-xl bg-primary/[0.1] ring-1 ring-primary/25" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                {active && !collapsed && <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-primary" />}
                <span className={cn('relative grid size-8 shrink-0 place-items-center rounded-lg transition-colors', active ? 'bg-primary text-primary-foreground' : 'bg-white/[0.04] group-hover:bg-white/[0.08]')}>
                  <Icon className="size-[17px]" />
                </span>
                {collapsed ? <span className="sr-only">{s.label}</span> : (
                  <>
                    <span className="relative flex-1 truncate">{s.label}</span>
                    {s.items.length > 1 && <span className={cn('relative text-[11px] font-semibold tabular-nums', active ? 'text-primary' : 'text-muted-foreground/60')}>{s.items.length}</span>}
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Pages of the current section, as tabs. */
function SectionTabs({ role, section }: { role: RoleName; section: NavSection }) {
  const pathname = usePathname() ?? '';
  const page = findNav(role, pathname);
  return (
    <div className="no-scrollbar shrink-0 overflow-x-auto border-b border-white/[0.06] bg-background/60 px-4 backdrop-blur-xl sm:px-8">
      <nav className="mx-auto flex max-w-[1280px] gap-1 py-2" aria-label={`${section.label} pages`}>
        {section.items.map((it) => {
          const active = it === page;
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                active ? 'bg-primary text-primary-foreground shadow-glow' : 'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground',
              )}
            >
              <Icon className="size-4" /> {it.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * The content area is exactly the space left on screen. When a page is taller than that, a pager appears and
 * Prev / Next move one screen at a time (the mouse wheel and keyboard still work, and the counter follows them).
 */
function PagedMain({ resetKey, children }: { resetKey: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);
  const OVERLAP = 64; // keep a strip of the previous screen visible for context

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const step = Math.max(1, el.clientHeight - OVERLAP);
    const extra = el.scrollHeight - el.clientHeight;
    const n = extra > 2 ? Math.ceil(extra / step) + 1 : 1;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    setPages(n);
    setPage(n === 1 ? 0 : atEnd ? n - 1 : Math.min(n - 1, Math.round(el.scrollTop / step)));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener('scroll', measure, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', measure); };
  }, [measure]);

  // new page → back to the top
  useEffect(() => { ref.current?.scrollTo({ top: 0 }); measure(); }, [resetKey, measure]);

  const go = (to: number) => {
    const el = ref.current;
    if (!el) return;
    const step = Math.max(1, el.clientHeight - OVERLAP);
    const target = to >= pages - 1 ? el.scrollHeight : Math.max(0, to) * step;
    el.scrollTo({ top: target, behavior: 'smooth' });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <main ref={ref} className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain" tabIndex={-1}>
        <div className={cn('mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-8 sm:py-6', pages > 1 && 'pb-24')}>
          {/* opacity only: a transform here would become the containing block for position:fixed modals inside pages */}
          <motion.div key={resetKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
            {children}
          </motion.div>
        </div>
      </main>
      <AnimatePresence>
        {pages > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-background via-background/80 to-transparent pb-4 pt-10"
          >
            <nav className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/[0.08] bg-elevated/95 p-1 shadow-card backdrop-blur-xl" aria-label="Page navigation">
              <button
                onClick={() => go(page - 1)} disabled={page === 0}
                className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
              >
                <ChevronLeft className="size-4" /> Prev
              </button>
              <span className="px-2 text-xs font-semibold tabular-nums text-muted-foreground" aria-live="polite">Page {page + 1} of {pages}</span>
              <button
                onClick={() => go(page + 1)} disabled={page >= pages - 1}
                className="inline-flex h-9 items-center gap-1 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-35"
              >
                Next <ChevronRight className="size-4" />
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileMenu({ role }: { role: RoleName }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const fullName = user ? `${user.firstName} ${user.lastName}` : '';
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] py-1 pl-1 pr-2.5 transition-colors hover:border-primary/30 hover:bg-white/[0.06]"
      >
        <Avatar name={fullName || '?'} size={30} />
        <span className="hidden text-sm font-medium sm:block">{user?.firstName}</span>
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.12 }}
            className="absolute right-0 top-[calc(100%+8px)] z-40 w-60 overflow-hidden rounded-xl border border-white/[0.08] bg-elevated p-1.5 shadow-card"
          >
            <div className="px-3 py-2.5">
              <p className="truncate text-sm font-semibold">{fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              <p className="mt-1.5 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{ROLE_LABEL[role]}</p>
            </div>
            <div className="my-1 h-px bg-white/[0.06]" />
            <Link role="menuitem" href={`${ROLE_HOME[role]}/settings`} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground">
              <UserCircle className="size-4" /> Profile &amp; settings
            </Link>
            <button role="menuitem" onClick={() => void logout()} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="size-4" /> Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppShell({ role, children }: { role: RoleName; children: React.ReactNode }) {
  const { loading } = useAuth();
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const RoleIcon = ROLE_ICON[role];
  const section = findSection(role, pathname);
  const page = findNav(role, pathname);
  const title = section && section.items.length > 1 ? section.label : (page?.label ?? 'Dashboard');

  // Role accent for everything on the page, including portals (modals) rendered outside this tree.
  useIsoLayoutEffect(() => {
    document.documentElement.dataset.role = role;
    return () => { delete document.documentElement.dataset.role; };
  }, [role]);

  useEffect(() => { try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1'); } catch { /* storage unavailable */ } }, []);
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* ignore */ } return !c; });

  useEffect(() => setOpen(false), [pathname]);

  return (
    // Exactly one screen tall: the window never scrolls; the content area pages (see PagedMain).
    <div className="flex h-dvh overflow-hidden" data-role={role}>
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,hsl(var(--primary)/0.07),transparent)]" aria-hidden />

      {/* desktop sidebar (collapsible) */}
      <aside className={cn('hidden shrink-0 flex-col border-r border-white/[0.06] bg-surface/85 backdrop-blur-xl transition-[width] duration-200 lg:flex', collapsed ? 'w-[76px]' : 'w-[232px]')}>
        <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center' : 'px-5')}><Brand compact={collapsed} /></div>
        {!collapsed && (
          <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/[0.06] px-3 py-2 text-xs font-semibold text-muted-foreground">
            <RoleIcon className="size-4 text-primary" /> {ROLE_LABEL[role]} console
          </div>
        )}
        <div className={cn('min-h-0 flex-1 overflow-y-auto', collapsed ? 'px-2' : 'px-3')}><SideNav role={role} collapsed={collapsed} /></div>
        <div className={cn('shrink-0 border-t border-white/[0.06] p-3', collapsed && 'flex justify-center')}>
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn('flex items-center gap-2.5 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground', collapsed ? 'size-10 justify-center' : 'w-full px-3 py-2')}
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <><PanelLeftClose className="size-[18px]" /> Collapse</>}
          </button>
        </div>
      </aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-white/[0.08] bg-surface lg:hidden"
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              role="dialog" aria-modal="true" aria-label="Navigation"
            >
              <div className="flex h-16 items-center justify-between px-5"><Brand /><button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.06]" aria-label="Close menu"><X className="size-5" /></button></div>
              <div className="flex-1 overflow-y-auto px-3 pb-8"><SideNav role={role} onNavigate={() => setOpen(false)} /></div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-background/75 px-4 backdrop-blur-xl sm:px-8">
          <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.06] lg:hidden" aria-label="Open menu"><Menu className="size-5" /></button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationBell href={`${ROLE_HOME[role]}/notifications`} />
            {loading ? <Skeleton className="h-9 w-32 rounded-full" /> : <ProfileMenu role={role} />}
          </div>
        </header>
        {section && section.items.length > 1 && <SectionTabs role={role} section={section} />}
        <PagedMain resetKey={pathname}>{children}</PagedMain>
      </div>
    </div>
  );
}
