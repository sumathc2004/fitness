'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Box, ChartNoAxesCombined, ShieldCheck, Utensils } from 'lucide-react';

const POINTS = [
  { icon: Box, title: '3D exercise guidance', text: 'Rotate and zoom every movement before you lift.' },
  { icon: Utensils, title: 'Nutrition that adapts', text: 'Targets built from your body and your goal.' },
  { icon: ChartNoAxesCombined, title: 'Progress you can measure', text: 'Weight, composition, strength and consistency.' },
];

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-white/[0.06] lg:block">
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute -left-24 top-1/4 size-[420px] rounded-full bg-primary/[0.14] blur-[110px]" />
        <div className="absolute -bottom-24 right-0 size-[360px] rounded-full bg-chart-2/[0.12] blur-[110px]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-lg bg-primary font-display font-extrabold text-primary-foreground shadow-glow">S</span>
            <span className="font-display text-lg font-bold">SVD Fitness <span className="text-primary">OS</span></span>
          </Link>
          <div className="space-y-10">
            <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="font-display text-5xl font-bold leading-[1.05] tracking-tight">
              Train smart.<br /><span className="text-gradient">Move better.</span>
            </motion.h2>
            <ul className="space-y-5">
              {POINTS.map((p, i) => (
                <motion.li key={p.title} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.12 }} className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-primary"><p.icon className="size-5" /></span>
                  <div><p className="font-display font-semibold">{p.title}</p><p className="text-sm text-muted-foreground">{p.text}</p></div>
                </motion.li>
              ))}
            </ul>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" /> Your data is encrypted in transit and access is role-protected.</p>
        </div>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-[420px]">
          <Link href="/" className="mb-10 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-lg bg-primary font-display font-extrabold text-primary-foreground">S</span>
            <span className="font-display font-bold">SVD Fitness <span className="text-primary">OS</span></span>
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mb-8 mt-2 text-muted-foreground">{subtitle}</p>
          {children}
          {footer && <div className="mt-8 text-center text-sm text-muted-foreground">{footer}</div>}
        </motion.div>
      </main>
    </div>
  );
}
