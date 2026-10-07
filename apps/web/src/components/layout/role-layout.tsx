import type { RoleName } from '@gym/config';
import { AuthProvider } from '@/lib/auth-context';
import { AppShell } from './app-shell';

export function RoleLayout({ role, children }: { role: RoleName; children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShell role={role}>{children}</AppShell>
    </AuthProvider>
  );
}
