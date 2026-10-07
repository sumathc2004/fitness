import { z } from 'zod';


export type { RoleName, Permission } from '@gym/config';

import { emailSchema, passwordSchema, roleSchema } from './common';
export { emailSchema, passwordSchema, roleSchema } from './common';

// ───────────────────────── Auth requests
/** Sign in with an email, or with a username + the role to sign in as (usernames are unique per role). */
export const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1, 'Enter your email or username').max(190),
  password: z.string().min(1, 'Enter your password').max(128),
  role: roleSchema.optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'Reset link is invalid').max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(128),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d][\d\s\-()]{5,}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ───────────────────────── Auth responses
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: z.infer<typeof roleSchema>;
  status: 'ACTIVE' | 'SUSPENDED' | 'INVITED';
  trainerId: string | null;
  clientId: string | null;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

// ───────────────────────── Client attention status
export type AttentionLevel = 'GOOD' | 'MONITOR' | 'ATTENTION' | 'NEW';

export interface ClientAttention {
  clientId: string;
  name: string;
  level: AttentionLevel;
  reasons: string[];
  lastActivityAt: string | null;
}

// ───────────────────────── Dashboards
export interface ActivityItem {
  id: string;
  type: string;
  clientId: string | null;
  clientName: string | null;
  at: string;
  summary: string;
}

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface AdminDashboard {
  generatedAt: string;
  totals: {
    clients: number;
    activeClients: number;
    trainers: number;
    attendanceToday: number;
    activeSubscriptions: number;
    expiringSubscriptions: number;
  };
  rates: {
    /** 0–1, or null when there is nothing to measure yet. */
    workoutCompletion: number | null;
    dietCompliance: number | null;
  };
  revenue: { thisMonth: number; lastMonth: number; currency: string };
  growth: { clients: SeriesPoint[]; revenue: SeriesPoint[] };
  attention: ClientAttention[];
  trainerPerformance: Array<{
    trainerId: string;
    name: string;
    clients: number;
    workoutCompletion: number | null;
    needAttention: number;
  }>;
  recentActivity: ActivityItem[];
}

export interface TrainerDashboard {
  generatedAt: string;
  totals: { assignedClients: number; activeClients: number; needAttention: number; workoutsToday: number };
  rates: { workoutCompliance: number | null; dietCompliance: number | null };
  attention: ClientAttention[];
  todaysSchedule: Array<{
    workoutId: string;
    name: string;
    clientId: string;
    clientName: string;
    status: string;
    exerciseCount: number;
  }>;
  clientProgress: Array<{ clientId: string; name: string; weightChangeKg: number | null; workoutsThisWeek: number }>;
  recentActivity: ActivityItem[];
}

export interface ClientDashboard {
  generatedAt: string;
  greetingName: string;
  goal: 'FAT_LOSS' | 'RECOMPOSITION' | 'MUSCLE_BUILDING' | null;
  trainerName: string | null;
  week: { workoutsPlanned: number; workoutsCompleted: number; attendanceDays: number };
  streakDays: number;
  todaysWorkout: {
    id: string;
    name: string;
    status: string;
    exercises: Array<{ id: string; name: string; sets: number; reps: string; restSec: number }>;
  } | null;
  nutrition: {
    target: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; waterMl: number | null } | null;
    consumed: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number };
  };
  habits: { waterMl: number; sleepHours: number | null };
  weightSeries: Array<{ date: string; weightKg: number }>;
  trainerMessages: Array<{ id: string; body: string; at: string; read: boolean }>;
}

// ───────────────────────── Audit log
export interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  ip: string | null;
  at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export * from './people';
export * from './training';
export * from './nutrition';
