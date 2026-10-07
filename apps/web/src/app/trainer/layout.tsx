import type { Metadata } from 'next';
import { RoleLayout } from '@/components/layout/role-layout';

export const metadata: Metadata = { title: 'Trainer' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="TRAINER">{children}</RoleLayout>;
}
