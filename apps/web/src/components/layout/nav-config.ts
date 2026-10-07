import {
  Activity, BarChart3, Bell, Calculator, CalendarDays, CalendarCheck, ClipboardList, CreditCard, Dumbbell, FileText, Flame, Gauge, Heart, Image as ImageIcon, LayoutDashboard,
  Layers, LineChart, ListChecks, MessageSquare, Moon, Ruler, ScrollText, Settings, Salad, Droplets, ShieldCheck, Sparkles, Ticket, UserCog, Users, Utensils, Receipt, Box, Wallet, UserCircle,
  type LucideIcon,
} from 'lucide-react';
import type { RoleName } from '@gym/config';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  group: string;
}

const i = (label: string, href: string, icon: LucideIcon, group: string): NavItem => ({ label, href, icon, group });

export const NAV: Record<RoleName, NavItem[]> = {
  SUPER_ADMIN: [
    i('Dashboard', '/admin', LayoutDashboard, 'Overview'),
    i('Trainers', '/admin/trainers', UserCog, 'People'),
    i('Clients', '/admin/clients', Users, 'People'),
    i('Exercises', '/admin/exercises', Dumbbell, 'Training'),
    i('3D Exercise Library', '/admin/exercise-3d', Box, 'Training'),
    i('Workout Templates', '/admin/workout-templates', ClipboardList, 'Training'),
    i('Diet Templates', '/admin/diet-templates', Utensils, 'Nutrition'),
    i('Nutrition Settings', '/admin/nutrition-settings', Salad, 'Nutrition'),
    i('Memberships', '/admin/memberships', Ticket, 'Business'),
    i('Subscriptions', '/admin/subscriptions', Layers, 'Business'),
    i('Payments', '/admin/payments', CreditCard, 'Business'),
    i('Attendance', '/admin/attendance', CalendarCheck, 'Operations'),
    i('Analytics', '/admin/analytics', BarChart3, 'Operations'),
    i('Reports', '/admin/reports', FileText, 'Operations'),
    i('Notifications', '/admin/notifications', Bell, 'Operations'),
    i('Messages', '/admin/messages', MessageSquare, 'Operations'),
    i('Audit Logs', '/admin/audit-logs', ScrollText, 'System'),
    i('Settings', '/admin/settings', Settings, 'System'),
  ],
  TRAINER: [
    i('Dashboard', '/trainer', LayoutDashboard, 'Overview'),
    i('My Clients', '/trainer/clients', Users, 'Clients'),
    i('Workout Builder', '/trainer/workout-builder', Dumbbell, 'Training'),
    i('Workout Calendar', '/trainer/workout-calendar', CalendarDays, 'Training'),
    i('Workout Templates', '/trainer/workout-templates', ClipboardList, 'Training'),
    i('3D Exercise Library', '/trainer/exercise-3d', Box, 'Training'),
    i('Diet Builder', '/trainer/diet-builder', Utensils, 'Nutrition'),
    i('Meal Plans', '/trainer/meal-plans', Salad, 'Nutrition'),
    i('Nutrition Calculator', '/trainer/nutrition-calculator', Calculator, 'Nutrition'),
    i('Body Analysis', '/trainer/body-analysis', Gauge, 'Analysis'),
    i('Progress Tracking', '/trainer/progress', LineChart, 'Tracking'),
    i('Measurements', '/trainer/measurements', Ruler, 'Tracking'),
    i('Progress Photos', '/trainer/progress-photos', ImageIcon, 'Tracking'),
    i('Attendance', '/trainer/attendance', CalendarCheck, 'Tracking'),
    i('Messages', '/trainer/messages', MessageSquare, 'Communication'),
    i('Notifications', '/trainer/notifications', Bell, 'Communication'),
    i('Reports', '/trainer/reports', FileText, 'Communication'),
    i('Account', '/trainer/settings', Settings, 'Account'),
  ],
  CLIENT: [
    i('Dashboard', '/client', LayoutDashboard, 'Overview'),
    i('Today’s Workout', '/client/workout', Flame, 'Training'),
    i('Workout History', '/client/workout-history', ListChecks, 'Training'),
    i('3D Exercises', '/client/exercise-3d', Box, 'Training'),
    i('My Diet', '/client/diet', Utensils, 'Nutrition'),
    i('Nutrition Calculator', '/client/nutrition-calculator', Calculator, 'Nutrition'),
    i('Body Analysis', '/client/body-analysis', Gauge, 'Analysis'),
    i('Progress', '/client/progress', LineChart, 'Tracking'),
    i('Measurements', '/client/measurements', Ruler, 'Tracking'),
    i('Progress Photos', '/client/progress-photos', ImageIcon, 'Tracking'),
    i('Attendance', '/client/attendance', CalendarCheck, 'Tracking'),
    i('Water', '/client/water', Droplets, 'Habits'),
    i('Sleep', '/client/sleep', Moon, 'Habits'),
    i('Habits', '/client/habits', Heart, 'Habits'),
    i('Messages', '/client/messages', MessageSquare, 'Communication'),
    i('Notifications', '/client/notifications', Bell, 'Communication'),
    i('Profile', '/client/settings', UserCircle, 'Account'),
  ],
};

export const ROLE_ICON: Record<RoleName, LucideIcon> = { SUPER_ADMIN: ShieldCheck, TRAINER: Activity, CLIENT: Sparkles };

// Re-exported so pages can reference icons without importing lucide everywhere.
export { Wallet, Receipt };

export function findNav(role: RoleName, pathname: string): NavItem | undefined {
  // longest matching href wins so /admin/audit-logs beats /admin
  return [...NAV[role]].sort((a, b) => b.href.length - a.href.length).find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
}
