import {
  Activity, BarChart3, Bell, BookOpen, Calculator, CalendarCheck, CalendarDays, ClipboardList, CreditCard, Dumbbell, FileText, Gauge, Heart,
  Image as ImageIcon, Layers, LayoutDashboard, LineChart, ListChecks, MessageSquare, Ruler, Salad, ScrollText, Settings, ShieldCheck, Sparkles,
  Ticket, UserCircle, UserCog, Users, Utensils, Wallet, Droplets, Moon,
  type LucideIcon,
} from 'lucide-react';
import type { RoleName } from '@gym/config';

/** One page of a console. */
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * A sidebar entry. Each role has 6 sections; a section with several pages shows them as tabs under the header,
 * so the sidebar stays short while every page remains one click away.
 */
export interface NavSection {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

const p = (label: string, href: string, icon: LucideIcon): NavItem => ({ label, href, icon });

export const SECTIONS: Record<RoleName, NavSection[]> = {
  SUPER_ADMIN: [
    { label: 'Home', icon: LayoutDashboard, items: [p('Dashboard', '/admin', LayoutDashboard)] },
    { label: 'People', icon: Users, items: [p('Clients', '/admin/clients', Users), p('Trainers', '/admin/trainers', UserCog), p('Attendance', '/admin/attendance', CalendarCheck)] },
    { label: 'Programs', icon: Dumbbell, items: [p('Exercises', '/admin/exercises', Dumbbell), p('Workout Templates', '/admin/workout-templates', ClipboardList), p('Diet Templates', '/admin/diet-templates', Utensils), p('Nutrition Settings', '/admin/nutrition-settings', Salad)] },
    { label: 'Business', icon: Wallet, items: [p('Payments', '/admin/payments', CreditCard), p('Memberships', '/admin/memberships', Ticket), p('Subscriptions', '/admin/subscriptions', Layers)] },
    { label: 'Insights', icon: BarChart3, items: [p('Analytics', '/admin/analytics', BarChart3), p('Reports', '/admin/reports', FileText), p('Audit Logs', '/admin/audit-logs', ScrollText)] },
    { label: 'Messages', icon: MessageSquare, items: [p('Messages', '/admin/messages', MessageSquare), p('Notifications', '/admin/notifications', Bell)] },
  ],
  TRAINER: [
    { label: 'Home', icon: LayoutDashboard, items: [p('Dashboard', '/trainer', LayoutDashboard)] },
    { label: 'Clients', icon: Users, items: [p('My Clients', '/trainer/clients', Users), p('Attendance', '/trainer/attendance', CalendarCheck), p('Reports', '/trainer/reports', FileText)] },
    { label: 'Training', icon: Dumbbell, items: [p('Workout Builder', '/trainer/workout-builder', Dumbbell), p('Calendar', '/trainer/workout-calendar', CalendarDays), p('Templates', '/trainer/workout-templates', ClipboardList), p('Exercise Library', '/trainer/exercises', BookOpen)] },
    { label: 'Nutrition', icon: Utensils, items: [p('Diet Builder', '/trainer/diet-builder', Utensils), p('Meal Plans', '/trainer/meal-plans', Salad), p('Calculator', '/trainer/nutrition-calculator', Calculator)] },
    { label: 'Progress', icon: LineChart, items: [p('Progress', '/trainer/progress', LineChart), p('Body Analysis', '/trainer/body-analysis', Gauge), p('Measurements', '/trainer/measurements', Ruler), p('Photos', '/trainer/progress-photos', ImageIcon)] },
    { label: 'Messages', icon: MessageSquare, items: [p('Messages', '/trainer/messages', MessageSquare), p('Notifications', '/trainer/notifications', Bell)] },
  ],
  CLIENT: [
    { label: 'Home', icon: LayoutDashboard, items: [p('Dashboard', '/client', LayoutDashboard)] },
    { label: 'Training', icon: Dumbbell, items: [p('Workouts', '/client/workout', Dumbbell), p('History', '/client/workout-history', ListChecks), p('Exercise Library', '/client/exercises', BookOpen)] },
    { label: 'Nutrition', icon: Utensils, items: [p('My Diet', '/client/diet', Utensils), p('Calculator', '/client/nutrition-calculator', Calculator)] },
    { label: 'Progress', icon: LineChart, items: [p('Progress', '/client/progress', LineChart), p('Body Analysis', '/client/body-analysis', Gauge), p('Measurements', '/client/measurements', Ruler), p('Photos', '/client/progress-photos', ImageIcon)] },
    { label: 'Tracking', icon: Heart, items: [p('Attendance', '/client/attendance', CalendarCheck), p('Habits', '/client/habits', Heart), p('Water', '/client/water', Droplets), p('Sleep', '/client/sleep', Moon)] },
    { label: 'Messages', icon: MessageSquare, items: [p('Messages', '/client/messages', MessageSquare), p('Notifications', '/client/notifications', Bell)] },
  ],
};

/** Pages reached from the header (profile menu) rather than the sidebar. */
const HIDDEN: Record<RoleName, NavItem[]> = {
  SUPER_ADMIN: [p('Settings', '/admin/settings', Settings)],
  TRAINER: [p('Account', '/trainer/settings', Settings)],
  CLIENT: [p('Profile', '/client/settings', UserCircle)],
};

/** Every page of a console, flat. */
export const NAV: Record<RoleName, NavItem[]> = {
  SUPER_ADMIN: [...SECTIONS.SUPER_ADMIN.flatMap((s) => s.items), ...HIDDEN.SUPER_ADMIN],
  TRAINER: [...SECTIONS.TRAINER.flatMap((s) => s.items), ...HIDDEN.TRAINER],
  CLIENT: [...SECTIONS.CLIENT.flatMap((s) => s.items), ...HIDDEN.CLIENT],
};

export const ROLE_ICON: Record<RoleName, LucideIcon> = { SUPER_ADMIN: ShieldCheck, TRAINER: Activity, CLIENT: Sparkles };

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** The page for a path: the longest matching href wins, so /admin/audit-logs beats /admin. */
export function findNav(role: RoleName, pathname: string): NavItem | undefined {
  return [...NAV[role]].sort((a, b) => b.href.length - a.href.length).find((n) => under(pathname, n.href));
}

/** The sidebar section that owns a path (undefined for header-only pages such as settings). */
export function findSection(role: RoleName, pathname: string): NavSection | undefined {
  const page = findNav(role, pathname);
  return page && SECTIONS[role].find((s) => s.items.includes(page));
}

/** Whether a path is a page of this role's console (used by the catch-all route guards). */
export function isRoutable(role: RoleName, path: string): boolean {
  return NAV[role].some((n) => n.href === path);
}
