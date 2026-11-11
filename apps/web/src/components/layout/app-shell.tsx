'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen, UserCircle, X } from 'lucide-react';
import { ROLE_HOME, ROLE_LABEL, type RoleName } from '@gym/config';
import { NotificationBell } from '@/components/features/messages';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { findNav, isActive, NAV, ROLE_ICON } from './nav-config';

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

function NavLinks({ role, collapsed = false, onNavigate }: { role: RoleName; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname() ?? '';
  const items = NAV[role].filter((n) => !n.hidden);
  const groups = [...new Set(items.map((n) => n.group))];
  return (
    <nav className={cn('flex flex-col', collapsed ? 'gap-2' : 'gap-4')} aria-label="Main">
      {groups.map((g, gi) => (
        <div key={g}>
          {collapsed
            ? gi > 0 && <div className="mx-auto mb-2 h-px w-6 bg-white/[0.08]" aria-hidden />
            : <p className="mb-1 px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">{g}</p>}
          <ul className="space-y-0.5">
            {items.filter((n) => n.group === g).map((n) => {
              const active = isActive(n, pathname, ROLE_HOME[role]);
              const Icon = n.icon;
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? n.label : undefined}
                    className={cn(
                      'group relative flex items-center rounded-lg text-sm font-medium transition-colors',
                      collapsed ? 'mx-auto size-10 justify-center' : 'gap-3 px-3 py-[7px]',
                      active ? 'text-foreground' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
                    )}
                  >
                    {active && <motion.span layoutId={`nav-active-${onNavigate ? 'm' : 'd'}`} className="absolute inset-0 rounded-lg bg-primary/[0.09] ring-1 ring-primary/20" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                    {active && !collapsed && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />}
                    <Icon className={cn('relative size-[18px] shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                    {collapsed ? <span className="sr-only">{n.label}</span> : <span className="relative truncate">{n.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
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
  const current = findNav(role, pathname);

  // Role accent for everything on the page, including portals (modals) rendered outside this tree.
  useIsoLayoutEffect(() => {
    document.documentElement.dataset.role = role;
    return () => { delete document.documentElement.dataset.role; };
  }, [role]);

  useEffect(() => { try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1'); } catch { /* storage unavailable */ } }, []);
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* ignore */ } return !c; });

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div className="min-h-screen" data-role={role}>
      {/* soft role-coloured glow behind the page */}
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,hsl(var(--primary)/0.07),transparent)]" aria-hidden />

      {/* desktop sidebar (collapsible) */}
      <aside className={cn('fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/[0.06] bg-surface/85 backdrop-blur-xl transition-[width] duration-200 lg:flex', collapsed ? 'w-[76px]' : 'w-[248px]')}>
        <div className={cn('flex h-16 items-center', collapsed ? 'justify-center' : 'px-5')}><Brand compact={collapsed} /></div>
        {!collapsed && (
          <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/[0.06] px-3 py-2 text-xs font-semibold text-muted-foreground">
            <RoleIcon className="size-4 text-primary" /> {ROLE_LABEL[role]} console
          </div>
        )}
        <div className={cn('flex-1 overflow-y-auto pb-4', collapsed ? 'px-2' : 'px-3')}><NavLinks role={role} collapsed={collapsed} /></div>
        <div className={cn('border-t border-white/[0.06] p-3', collapsed && 'flex justify-center')}>
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
              className="fixed inset-y-0 left-0 z-50 flex w-[284px] flex-col border-r border-white/[0.08] bg-surface lg:hidden"
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              role="dialog" aria-modal="true" aria-label="Navigation"
            >
              <div className="flex h-16 items-center justify-between px-5"><Brand /><button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.06]" aria-label="Close menu"><X className="size-5" /></button></div>
              <div className="flex-1 overflow-y-auto px-3 pb-8"><NavLinks role={role} onNavigate={() => setOpen(false)} /></div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-[76px]' : 'lg:pl-[248px]')}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-background/75 px-4 backdrop-blur-xl sm:px-8">
          <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.06] lg:hidden" aria-label="Open menu"><Menu className="size-5" /></button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold tracking-tight">{current?.label ?? 'Dashboard'}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationBell href={`${ROLE_HOME[role]}/notifications`} />
            {loading ? <Skeleton className="h-9 w-32 rounded-full" /> : <ProfileMenu role={role} />}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">
          {/* opacity only: a transform here would become the containing block for position:fixed modals inside pages */}
          <motion.div key={pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
