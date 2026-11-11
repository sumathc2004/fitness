'use client';

import Link from 'next/link';
import { CheckCircle2, type LucideIcon } from 'lucide-react';
import type { ClientAttention } from '@gym/types';
import { cn, timeAgo } from '@/lib/utils';
import { Avatar } from '@/components/ui/misc';

/** One compact row: avatar, name, one line of detail, and a right-hand tag. Clicking opens `href`. */
export function PersonRow({ name, detail, tag, tagTone, href }: { name: string; detail: string; tag?: string; tagTone?: string; href: string }) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]">
        <Avatar name={name} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium group-hover:text-primary">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
        {tag && <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold', tagTone ?? 'bg-white/[0.06] text-muted-foreground')}>{tag}</span>}
      </Link>
    </li>
  );
}

export function EmptyLine({ icon: Icon = CheckCircle2, text }: { icon?: LucideIcon; text: string }) {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <Icon className="size-6 text-good" />
      {text}
    </div>
  );
}

const LEVEL_TAG: Record<string, { label: string; tone: string }> = {
  ATTENTION: { label: 'Needs attention', tone: 'bg-attention/15 text-attention' },
  MONITOR: { label: 'Monitor', tone: 'bg-monitor/15 text-monitor' },
  NEW: { label: 'New', tone: 'bg-primary/15 text-primary' },
  GOOD: { label: 'On track', tone: 'bg-good/15 text-good' },
};

/** The most urgent clients, one line each (first reason only); full detail lives on the client page. */
export function AttentionRows({ items, base, limit = 4 }: { items: ClientAttention[]; base: string; limit?: number }) {
  if (items.length === 0) return <EmptyLine text="Everyone is on track." />;
  return (
    <ul className="-mx-2 space-y-0.5">
      {items.slice(0, limit).map((c) => {
        const tag = LEVEL_TAG[c.level] ?? LEVEL_TAG.MONITOR!;
        const detail = c.reasons[0] ?? (c.lastActivityAt ? `Last active ${timeAgo(c.lastActivityAt)}` : 'Joined recently');
        return <PersonRow key={c.clientId} name={c.name} detail={detail} tag={tag.label} tagTone={tag.tone} href={`${base}/clients/${c.clientId}`} />;
      })}
    </ul>
  );
}
