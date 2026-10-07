import type { Metadata } from 'next';
import { RoleLayout } from '@/components/layout/role-layout';

export const metadata: Metadata = { title: 'My fitness' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="CLIENT">{children}</RoleLayout>;
}
