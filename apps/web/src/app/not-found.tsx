import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div className="space-y-5">
        <p className="font-display text-7xl font-bold text-gradient">404</p>
        <h1 className="font-display text-2xl font-bold">This page doesn’t exist</h1>
        <p className="text-muted-foreground">The link may be old, or you may not have access to it.</p>
        <Link href="/" className={cn(buttonVariants())}>Back to home</Link>
      </div>
    </main>
  );
}
