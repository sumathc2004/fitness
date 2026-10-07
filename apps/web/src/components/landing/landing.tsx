'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import {
  ArrowRight, BadgeCheck, Box, CalendarCheck, ChartNoAxesCombined, ChevronDown, ClipboardList, Gauge, Menu, MessageSquare, Salad, ScanLine, Target, Users, X, FileText, Sparkles, MousePointer2,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Progress, Skeleton } from '@/components/ui/misc';
import { GrowthAreaChart } from '@/components/dashboard/charts';
import { cn } from '@/lib/utils';

const Dumbbell3D = dynamic(() => import('./dumbbell-3d'), { ssr: false, loading: () => <Skeleton className="size-full rounded-2xl" /> });

const fade: Variants = { hidden: { opacity: 0, y: 24 }, show: (i: number = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.08, ease: 'easeOut' } }) };
const reveal = { initial: 'hidden', whileInView: 'show', viewport: { once: true, margin: '-80px' } } as const;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.07] px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">{children}</span>;
}

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: React.ReactNode; text?: string }) {
  return (
    <motion.div variants={fade} {...reveal} className="mx-auto mb-14 max-w-2xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-5 font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">{title}</h2>
      {text && <p className="mt-4 text-lg text-muted-foreground">{text}</p>}
    </motion.div>
  );
}

// ───────────────────────── header
const LINKS = [['Features', '#features'], ['3D guidance', '#guidance'], ['Nutrition', '#nutrition'], ['Roles', '#roles'], ['Membership', '#pricing'], ['FAQ', '#faq']] as const;

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto mt-4 flex h-14 max-w-6xl items-center justify-between rounded-full border border-white/[0.08] bg-background/70 px-3 pl-5 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2.5" aria-label="SVD Fitness OS home">
          <span className="grid size-8 place-items-center rounded-lg bg-primary font-display text-sm font-extrabold text-primary-foreground">S</span>
          <span className="font-display text-[15px] font-bold tracking-tight">SVD Fitness <span className="text-primary">OS</span></span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
          {LINKS.map(([l, h]) => <a key={h} href={h} className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground">{l}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/auth/login" className={cn(buttonVariants({ size: 'sm' }), 'rounded-full')}>Member login</Link>
          <button className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-white/[0.06] md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>{open ? <X className="size-5" /> : <Menu className="size-5" />}</button>
        </div>
      </div>
      {open && (
        <motion.nav initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-2 rounded-2xl border border-white/[0.08] bg-surface/95 p-2 backdrop-blur-xl md:hidden" aria-label="Sections">
          {LINKS.map(([l, h]) => <a key={h} href={h} onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">{l}</a>)}
        </motion.nav>
      )}
    </header>
  );
}

// ───────────────────────── hero
function ProductPreview() {
  return (
    <motion.div variants={fade} custom={4} initial="hidden" animate="show" className="relative mx-auto mt-16 max-w-5xl">
      <div className="absolute -inset-x-10 -top-10 bottom-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--primary)/0.22),transparent_65%)]" />
      <div className="glass rounded-2xl p-3 shadow-card sm:p-4">
        <div className="mb-3 flex items-center gap-1.5 px-1"><span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" /><span className="ml-3 text-[11px] text-muted-foreground">Client dashboard · illustrative preview</span></div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="surface-card col-span-1 rounded-xl p-4 md:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Today’s workout</p>
            <p className="mt-1 font-display text-xl font-bold">Leg Day</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[['Barbell Back Squat', '4 × 8'], ['Split Lunge', '3 × 10'], ['Standing Calf Raise', '4 × 15']].map(([n, s], i) => (
                <li key={n} className="flex items-center gap-3"><span className="grid size-7 place-items-center rounded-md bg-white/[0.06] text-xs font-bold text-muted-foreground">{i + 1}</span><span className="flex-1 font-medium">{n}</span><span className="tabular-nums text-muted-foreground">{s}</span></li>
              ))}
            </ul>
          </div>
          <div className="surface-card rounded-xl p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Nutrition</p>
            <div className="mt-3 space-y-3 text-sm">
              {[['Calories', 1980, 2500], ['Protein', 142, 150], ['Carbs', 215, 290]].map(([l, v, t]) => (
                <div key={l as string} className="space-y-1.5"><div className="flex justify-between"><span>{l}</span><span className="tabular-nums text-muted-foreground">{v} / {t}</span></div><Progress value={v as number} max={t as number} /></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-40 sm:pt-48">
      <div className="grid-bg absolute inset-0 -z-10" />
      <div className="absolute left-1/2 top-24 -z-10 size-[620px] -translate-x-1/2 rounded-full bg-primary/[0.09] blur-[120px]" />
      <div className="mx-auto max-w-4xl text-center">
        <motion.div variants={fade} initial="hidden" animate="show"><Eyebrow><Sparkles className="size-3.5" /> The fitness operating system</Eyebrow></motion.div>
        <motion.h1 variants={fade} custom={1} initial="hidden" animate="show" className="mt-7 font-display text-5xl font-bold uppercase leading-[0.98] tracking-tight sm:text-7xl lg:text-[5.5rem]">
          Train smart.<br />Move better.<br /><span className="text-gradient">Become stronger.</span>
        </motion.h1>
        <motion.p variants={fade} custom={2} initial="hidden" animate="show" className="mx-auto mt-7 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Personalized workouts, 3D exercise guidance, nutrition intelligence and measurable progress — all in one fitness platform.
        </motion.p>
        <motion.div variants={fade} custom={3} initial="hidden" animate="show" className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="#pricing" className={cn(buttonVariants({ size: 'lg' }), 'group rounded-full px-8 uppercase tracking-wide')}>Get started <ArrowRight className="transition-transform group-hover:translate-x-1" /></a>
          <Link href="/auth/login" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'rounded-full px-8 uppercase tracking-wide')}>Member login</Link>
        </motion.div>
      </div>
      <ProductPreview />
    </section>
  );
}

function Marquee() {
  const items = ['Personal workouts', '3D exercise models', 'Nutrition targets', 'Body analysis', 'Progress tracking', 'Attendance & QR', 'Trainer chat', 'PDF reports'];
  return (
    <div className="overflow-hidden border-y border-white/[0.06] bg-white/[0.015] py-5" aria-hidden>
      <div className="flex w-max animate-marquee gap-12 whitespace-nowrap font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {[...items, ...items, ...items, ...items].map((t, i) => <span key={i} className="flex items-center gap-12">{t}<span className="size-1.5 rounded-full bg-primary" /></span>)}
      </div>
    </div>
  );
}

// ───────────────────────── features
const FEATURES = [
  { icon: ClipboardList, title: 'Workout builder', text: 'Sets, reps, weight, rest, tempo, supersets and dropsets — with drag-and-drop ordering and reusable templates.' },
  { icon: Box, title: '3D exercise library', text: 'Rotate, zoom and study every movement, with muscles worked, instructions and common mistakes.' },
  { icon: Salad, title: 'Nutrition intelligence', text: 'Calories, protein, carbs, fat and fibre calculated from the body profile and goal — adjustable by the trainer.' },
  { icon: Gauge, title: 'Body analysis', text: 'BMI, estimated body fat, lean mass, BMR and maintenance calories, tracked over time.' },
  { icon: Target, title: 'Goal engine', text: 'Fat loss, recomposition or muscle building — a recommendation with the reasons behind it.' },
  { icon: ChartNoAxesCombined, title: 'Progress tracking', text: 'Weight, composition, measurements, strength and compliance in clear interactive charts.' },
  { icon: CalendarCheck, title: 'Attendance & QR', text: 'Manual or QR check-in, late and leave tracking, built to grow into biometric hardware.' },
  { icon: MessageSquare, title: 'Trainer ↔ client chat', text: 'Real-time messages with read receipts and notifications that keep people accountable.' },
  { icon: FileText, title: 'Monthly reports', text: 'Professional client reports with trends and trainer comments, downloadable as PDF.' },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-28">
      <SectionHead eyebrow="Everything in one place" title={<>One platform for the <span className="text-gradient">whole gym</span></>} text="From the first assessment to the monthly review, every step of a client’s journey is connected." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div key={f.title} variants={fade} custom={i % 3} {...reveal} className="group surface-card relative overflow-hidden rounded-xl p-6 transition-colors hover:border-primary/30">
            <div className="absolute -right-10 -top-10 size-32 rounded-full bg-primary/[0.07] blur-2xl transition-opacity group-hover:opacity-100" />
            <span className="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"><f.icon className="size-5" /></span>
            <h3 className="mt-5 font-display text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────── 3D
function Guidance() {
  return (
    <section id="guidance" className="relative overflow-hidden border-y border-white/[0.06] bg-surface/50 py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
        <motion.div variants={fade} {...reveal}>
          <Eyebrow><Box className="size-3.5" /> 3D exercise guidance</Eyebrow>
          <h2 className="mt-5 font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">See the movement <span className="text-gradient">before you lift it</span></h2>
          <p className="mt-5 text-lg text-muted-foreground">Every exercise gets an interactive 3D model your clients can rotate and zoom, next to the muscles worked, step-by-step instructions and the mistakes to avoid.</p>
          <ul className="mt-8 space-y-3.5">
            {['Interactive GLB/glTF models with animation', 'Primary and secondary muscles at a glance', 'Instructions, equipment and difficulty', 'Add new exercises from the admin panel'].map((t) => (
              <li key={t} className="flex items-center gap-3 text-[15px]"><BadgeCheck className="size-5 shrink-0 text-primary" />{t}</li>
            ))}
          </ul>
          <p className="mt-8 text-xs text-muted-foreground">The viewer on the right is a live 3D preview. The full exercise library ships in Phase 5.</p>
        </motion.div>
        <motion.div variants={fade} custom={2} {...reveal} className="relative aspect-square w-full overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_50%_40%,hsl(var(--primary)/0.14),transparent_65%)]">
          <Dumbbell3D />
          <span className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-background/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"><MousePointer2 className="size-3.5" /> Drag to rotate</span>
        </motion.div>
      </div>
    </section>
  );
}

// ───────────────────────── nutrition + status + progress
function Nutrition() {
  const rows = [['Calories', 1980, 2500, 'kcal', 'bg-primary'], ['Protein', 142, 150, 'g', 'bg-chart-1'], ['Carbohydrates', 215, 290, 'g', 'bg-chart-2'], ['Fat', 61, 75, 'g', 'bg-chart-3'], ['Fibre', 27, 35, 'g', 'bg-chart-4']] as const;
  return (
    <section id="nutrition" className="mx-auto max-w-6xl px-6 py-28">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <motion.div variants={fade} {...reveal} className="surface-card order-2 rounded-2xl p-7 lg:order-1">
          <div className="mb-6 flex items-center justify-between"><p className="font-display font-semibold">Daily nutrition</p><span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">Illustrative example</span></div>
          <div className="space-y-5">
            {rows.map(([l, v, t, u, c]) => (
              <div key={l} className="space-y-2"><div className="flex items-baseline justify-between text-sm"><span className="font-medium">{l}</span><span className="tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{v}</span> / {t} {u}</span></div><Progress value={v} max={t} barClassName={c} /></div>
            ))}
          </div>
        </motion.div>
        <motion.div variants={fade} custom={2} {...reveal} className="order-1 lg:order-2">
          <Eyebrow><Salad className="size-3.5" /> Personalized nutrition</Eyebrow>
          <h2 className="mt-5 font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">Targets built from <span className="text-gradient">the person</span></h2>
          <p className="mt-5 text-lg text-muted-foreground">Body profile and goal in, calories and macros out — using configurable, evidence-based ranges. Trainers review and adjust every number before it becomes the client’s plan.</p>
          <p className="mt-4 text-sm text-muted-foreground/80">Body-fat figures are clearly labelled as estimates, and recommendations are coaching guidance — never medical advice.</p>
        </motion.div>
      </div>
    </section>
  );
}

function Management() {
  const sample = [
    { n: 'Member A', s: 'good', t: 'On track — 6/6 workouts', c: 'text-good border-good/30 bg-good/10', l: 'Good' },
    { n: 'Member B', s: 'monitor', t: '1 missed workout · no activity 4 days', c: 'text-monitor border-monitor/30 bg-monitor/10', l: 'Monitor' },
    { n: 'Member C', s: 'attention', t: '3 missed workouts · low diet compliance', c: 'text-attention border-attention/30 bg-attention/10', l: 'Needs attention' },
  ];
  const progress = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((label, i) => ({ label, value: [86, 85, 83.6, 82.2, 81][i]! }));
  return (
    <section className="border-y border-white/[0.06] bg-surface/50 py-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead eyebrow="Trainer management & progress" title={<>Know who needs you <span className="text-gradient">before they quit</span></>} text="An automatic status for every client, built from missed workouts, diet compliance, attendance and activity." />
        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div variants={fade} {...reveal} className="surface-card rounded-2xl p-7">
            <div className="mb-5 flex items-center justify-between"><p className="font-display font-semibold">Client status</p><span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">Illustrative example</span></div>
            <ul className="space-y-3">
              {sample.map((m) => (
                <li key={m.n} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3.5">
                  <span className="grid size-10 place-items-center rounded-full bg-white/[0.06] text-sm font-bold text-muted-foreground">{m.n.slice(-1)}</span>
                  <div className="min-w-0 flex-1"><p className="font-medium">{m.n}</p><p className="truncate text-sm text-muted-foreground">{m.t}</p></div>
                  <span className={cn('shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold', m.c)}>{m.l}</span>
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div variants={fade} custom={2} {...reveal} className="surface-card rounded-2xl p-7">
            <div className="mb-3 flex items-center justify-between"><p className="font-display font-semibold">Weight trend (kg)</p><span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">Illustrative example</span></div>
            <GrowthAreaChart data={progress} id="landing" fmt={(n) => `${n} kg`} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── roles
const ROLES = [
  { icon: Users, name: 'Gym owners', points: ['Trainers, clients, memberships and revenue in one dashboard', 'Attention list across the whole gym', 'Audit trail of every important action'] },
  { icon: ClipboardList, name: 'Trainers', points: ['Build workouts and diets with live macro totals', 'Body analysis and goal recommendations to review', 'Know instantly who is slipping'] },
  { icon: ScanLine, name: 'Members', points: ['Today’s workout with a 3D demo for every move', 'Nutrition, water, sleep and habits in one place', 'Progress charts that show the work paying off'] },
];

function Roles() {
  return (
    <section id="roles" className="mx-auto max-w-6xl px-6 py-28">
      <SectionHead eyebrow="Built for everyone in the gym" title={<>One system, <span className="text-gradient">three experiences</span></>} text="Owners, trainers and members each get a focused workspace — and the server enforces who can see what." />
      <div className="grid gap-4 md:grid-cols-3">
        {ROLES.map((r, i) => (
          <motion.div key={r.name} variants={fade} custom={i} {...reveal} className="surface-card rounded-2xl p-7">
            <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20"><r.icon className="size-6" /></span>
            <h3 className="mt-5 font-display text-xl font-bold">{r.name}</h3>
            <ul className="mt-4 space-y-3">{r.points.map((p) => <li key={p} className="flex gap-2.5 text-sm text-muted-foreground"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" />{p}</li>)}</ul>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────── pricing
const PLANS = [
  { name: 'Basic', price: '₹1,999', text: 'Everything to start training with structure.', feats: ['Gym floor access', 'Workout tracking', 'Progress & measurements'], hot: false },
  { name: 'Pro', price: '₹3,999', text: 'For regulars who want coaching and nutrition.', feats: ['Everything in Basic', 'Unlimited group classes', 'Nutrition plans & tracking', '3D exercise library'], hot: true },
  { name: 'Elite', price: '₹6,999', text: 'The full experience with a personal trainer.', feats: ['Everything in Pro', 'Personal trainer', 'Body analysis & goal engine', '24/7 access'], hot: false },
];

function Pricing() {
  return (
    <section id="pricing" className="border-y border-white/[0.06] bg-surface/50 py-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead eyebrow="Membership" title={<>Pick your <span className="text-gradient">power level</span></>} text="Indicative plans. Your gym sets the real prices and perks in the admin panel." />
        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <motion.div key={p.name} variants={fade} custom={i} {...reveal} className={cn('relative flex flex-col rounded-2xl border p-8', p.hot ? 'border-primary/50 bg-gradient-to-b from-primary/[0.09] to-card shadow-glow md:-mt-4 md:mb-4' : 'surface-card')}>
              {p.hot && <span className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">Most popular</span>}
              <h3 className="font-display text-xl font-bold">{p.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
              <p className="mt-6 font-display text-5xl font-bold tracking-tight">{p.price}<span className="text-base font-medium text-muted-foreground"> / month</span></p>
              <ul className="my-8 flex-1 space-y-3">{p.feats.map((f) => <li key={f} className="flex gap-2.5 text-sm"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" />{f}</li>)}</ul>
              <Link href="/auth/login" className={cn(buttonVariants({ variant: p.hot ? 'default' : 'outline', size: 'lg' }), 'w-full rounded-full')}>Join with your gym</Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── FAQ + footer
const FAQ = [
  ['How do I get an account?', 'Accounts are created by your gym. Your trainer or the front desk sets you up, and you receive a login to sign in with.'],
  ['Is the body-fat percentage accurate?', 'It is an estimate calculated from your measurements (the US Navy method). It is useful for tracking trends, but it is not a clinical measurement.'],
  ['Do the nutrition targets replace advice from my doctor?', 'No. Targets are coaching guidance based on your profile and goal. If you have a medical condition, follow your doctor’s advice.'],
  ['Who can see my progress photos and data?', 'Only you, your assigned trainer and the gym’s administrators. Access is enforced on the server, not just hidden in the interface.'],
  ['Can I use it on my phone?', 'Yes. The whole platform is responsive and designed to work well on a phone in the gym.'],
  ['Can the gym add its own exercises and 3D models?', 'Yes. Admins and trainers can add exercises and upload GLB models; the library grows with your gym.'],
];

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-28">
      <SectionHead eyebrow="FAQ" title="Questions, answered" />
      <div className="space-y-3">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group surface-card rounded-xl px-6 py-1 open:border-primary/30">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-display font-semibold [&::-webkit-details-marker]:hidden">{q}<ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" /></summary>
            <p className="pb-5 text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="px-6 pb-28">
      <motion.div variants={fade} {...reveal} className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/[0.12] via-card to-card px-8 py-16 text-center">
        <div className="absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-primary/20 blur-[90px]" />
        <h2 className="relative font-display text-4xl font-bold tracking-tight sm:text-5xl">Ready to train smarter?</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-lg text-muted-foreground">Ask your gym for your login, or sign in if you already have one.</p>
        <Link href="/auth/login" className={cn(buttonVariants({ size: 'lg' }), 'relative mt-8 rounded-full px-10 uppercase tracking-wide')}>Member login <ArrowRight /></Link>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.06] px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-lg bg-primary font-display text-sm font-extrabold text-primary-foreground">S</span><span className="font-display font-bold">SVD Fitness <span className="text-primary">OS</span></span></div>
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground" aria-label="Footer">{LINKS.map(([l, h]) => <a key={h} href={h} className="hover:text-foreground">{l}</a>)}<Link href="/auth/login" className="hover:text-foreground">Member login</Link></nav>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} SVD Fitness. All rights reserved.</p>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Marquee />
        <Features />
        <Guidance />
        <Nutrition />
        <Management />
        <Roles />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
