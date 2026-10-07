'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, X } from 'lucide-react';
import { ROLE_HOME, ROLE_LABEL, type RoleName } from '@gym/config';
import { NotificationBell } from '@/components/features/messages';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { findNav, NAV, ROLE_ICON } from './nav-config';

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Home">
      <span className="grid size-9 place-items-center rounded-lg bg-primary font-display text-sm font-extrabold text-primary-foreground shadow-glow">S</span>
      <span className="font-display text-[15px] font-bold tracking-tight">SVD Fitness <span className="text-primary">OS</span></span>
    </Link>
  );
}

function NavLinks({ role, onNavigate }: { role: RoleName; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = NAV[role];
  const groups = [...new Set(items.map((n) => n.group))];
  return (
    <nav className="flex flex-col gap-5" aria-label="Main">
      {groups.map((g) => (
        <div key={g}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">{g}</p>
          <ul className="space-y-0.5">
            {items.filter((n) => n.group === g).map((n) => {
              const active = n.href === pathname || (n.href.length > `/${role === 'SUPER_ADMIN' ? 'admin' : role.toLowerCase()}`.length && pathname.startsWith(`${n.href}/`));
              const Icon = n.icon;
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn('group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors', active ? 'text-foreground' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground')}
                  >
                    {active && <motion.span layoutId={`nav-active-${onNavigate ? 'm' : 'd'}`} className="absolute inset-0 rounded-md bg-white/[0.07] ring-1 ring-white/[0.08]" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                    {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />}
                    <Icon className={cn('relative size-[18px] shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                    <span className="relative truncate">{n.label}</span>
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

export function AppShell({ role, children }: { role: RoleName; children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const RoleIcon = ROLE_ICON[role];
  const current = findNav(role, pathname);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const fullName = user ? `${user.firstName} ${user.lastName}` : '';

  return (
    <div className="min-h-screen">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-white/[0.06] bg-surface/80 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center px-5"><Brand /></div>
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-muted-foreground">
          <RoleIcon className="size-4 text-primary" /> {ROLE_LABEL[role]} console
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6"><NavLinks role={role} /></div>
      </aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-[290px] flex-col border-r border-white/[0.08] bg-surface lg:hidden"
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              role="dialog" aria-modal="true" aria-label="Navigation"
            >
              <div className="flex h-16 items-center justify-between px-5"><Brand /><button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.06]" aria-label="Close menu"><X className="size-5" /></button></div>
              <div className="flex-1 overflow-y-auto px-3 pb-8"><NavLinks role={role} onNavigate={() => setOpen(false)} /></div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-background/75 px-4 backdrop-blur-xl sm:px-8">
          <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.06] lg:hidden" aria-label="Open menu"><Menu className="size-5" /></button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold tracking-tight">{current?.label ?? 'Dashboard'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell href={`${ROLE_HOME[role]}/notifications`} />
            {loading ? (
              <Skeleton className="h-9 w-36 rounded-full" />
            ) : (
              <div className="flex items-center gap-2.5 rounded-full border border-white/[0.07] bg-white/[0.03] py-1 pl-1 pr-3">
                <Avatar name={fullName || '?'} size={30} />
                <span className="hidden text-sm font-medium sm:block">{user?.firstName}</span>
              </div>
            )}
            <button onClick={() => void logout()} className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground" aria-label="Log out">
              <LogOut className="size-4" /> <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
