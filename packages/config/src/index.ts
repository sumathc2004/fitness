/**
 * Shared, framework-free configuration used by both the API and the web app.
 * Nothing in here is a secret.
 */

// ───────────────────────── Roles & routing
export const ROLE_NAMES = ['SUPER_ADMIN', 'TRAINER', 'CLIENT'] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export const ROLE_HOME: Record<RoleName, string> = {
  SUPER_ADMIN: '/admin',
  TRAINER: '/trainer',
  CLIENT: '/client',
};

export const ROLE_LABEL: Record<RoleName, string> = {
  SUPER_ADMIN: 'Super Admin',
  TRAINER: 'Trainer',
  CLIENT: 'Client',
};

/** URL prefix → the only role allowed inside it. */
export const ROUTE_ROLE: Record<string, RoleName> = {
  '/admin': 'SUPER_ADMIN',
  '/trainer': 'TRAINER',
  '/client': 'CLIENT',
};

// ───────────────────────── Permissions (enforced by the API; the UI only mirrors them)
export const PERMISSIONS = [
  'dashboard:admin',
  'dashboard:trainer',
  'dashboard:client',
  'users:manage',
  'trainers:manage',
  'clients:read-all',
  'clients:read-assigned',
  'clients:manage',
  'exercises:manage',
  'exercises:read',
  'workouts:manage',
  'workouts:read-own',
  'workouts:perform',
  'diets:manage',
  'diets:read-own',
  'diets:log',
  'nutrition:configure',
  'nutrition:calculate',
  'foods:manage',
  'foods:read',
  'body:manage',
  'body:read-own',
  'progress:read-all',
  'progress:read-assigned',
  'progress:read-own',
  'attendance:manage',
  'attendance:read-own',
  'habits:log',
  'messages:use',
  'notifications:use',
  'memberships:manage',
  'payments:manage',
  'payments:read-own',
  'analytics:read-all',
  'analytics:read-assigned',
  'reports:generate',
  'audit:read',
  'settings:manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<RoleName, readonly Permission[]> = {
  SUPER_ADMIN: [
    'dashboard:admin',
    'users:manage',
    'trainers:manage',
    'clients:read-all',
    'clients:manage',
    'exercises:manage',
    'exercises:read',
    'workouts:manage',
    'diets:manage',
    'nutrition:configure',
    'nutrition:calculate',
    'foods:manage',
    'foods:read',
    'body:manage',
    'progress:read-all',
    'attendance:manage',
    'messages:use',
    'notifications:use',
    'memberships:manage',
    'payments:manage',
    'analytics:read-all',
    'reports:generate',
    'audit:read',
    'settings:manage',
  ],
  TRAINER: [
    'dashboard:trainer',
    'clients:read-assigned',
    'clients:manage',
    'exercises:manage',
    'exercises:read',
    'workouts:manage',
    'diets:manage',
    'nutrition:configure',
    'nutrition:calculate',
    'foods:manage',
    'foods:read',
    'body:manage',
    'progress:read-assigned',
    'attendance:manage',
    'messages:use',
    'notifications:use',
    'analytics:read-assigned',
    'reports:generate',
  ],
  CLIENT: [
    'dashboard:client',
    'exercises:read',
    'workouts:read-own',
    'workouts:perform',
    'diets:read-own',
    'diets:log',
    'nutrition:calculate',
    'foods:read',
    'body:read-own',
    'progress:read-own',
    'attendance:read-own',
    'habits:log',
    'messages:use',
    'notifications:use',
    'payments:read-own',
  ],
};

export function can(role: RoleName, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export { NUTRITION_DEFAULTS } from './defaults';

// ───────────────────────── Client attention engine thresholds (Phase 4 uses all signals; Phase 1 uses what exists)
export const ATTENTION = {
  /** Days a brand-new client is exempt from "inactive" flags. */
  newClientGraceDays: 7,
  /** Days without any logged activity before a client turns yellow / red. */
  inactiveDaysMonitor: 3,
  inactiveDaysAttention: 7,
  /** Workouts missed in the last 14 days. */
  missedWorkoutsMonitor: 1,
  missedWorkoutsAttention: 3,
  /** Compliance ratios (0–1) over the trailing window. */
  complianceMonitorBelow: 0.7,
  complianceAttentionBelow: 0.4,
  windowDays: 14,
} as const;

// ───────────────────────── Auth
export const AUTH = {
  accessCookie: 'gp_access',
  refreshCookie: 'gp_refresh',
  passwordMinLength: 10,
  maxFailedLogins: 8,
  lockMinutes: 15,
} as const;

export const APP_NAME = 'SVD Fitness OS';
export * from './nutrition';
