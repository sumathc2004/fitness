import { z } from 'zod';
import { emailSchema, passwordSchema } from './common';
import type { AttentionLevel } from './index';

const name = z.string().trim().min(1, 'Required').max(60);
const phone = z.string().trim().max(30).regex(/^[+\d][\d\s\-()]{5,}$/, 'Enter a valid phone number').optional().or(z.literal('').transform(() => undefined));
const username = z
  .string().trim().toLowerCase().min(3, 'At least 3 characters').max(40)
  .regex(/^[a-z0-9._-]+$/, 'Use letters, numbers, dot, dash or underscore')
  .optional().or(z.literal('').transform(() => undefined));

export const sexSchema = z.enum(['MALE', 'FEMALE', 'OTHER']);
export const activityLevelSchema = z.enum(['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE']);
export const experienceSchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
export const goalSchema = z.enum(['FAT_LOSS', 'RECOMPOSITION', 'MUSCLE_BUILDING']);
export type Goal = z.infer<typeof goalSchema>;
export type Sex = z.infer<typeof sexSchema>;
export type ActivityLevel = z.infer<typeof activityLevelSchema>;
export type Experience = z.infer<typeof experienceSchema>;

export const createTrainerSchema = z.object({
  email: emailSchema, username, password: passwordSchema, firstName: name, lastName: name, phone,
  bio: z.string().trim().max(1000).optional(),
  specialties: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  maxClients: z.coerce.number().int().min(1).max(500).optional(),
});
export type CreateTrainerInput = z.infer<typeof createTrainerSchema>;

export const updateTrainerSchema = createTrainerSchema.omit({ password: true }).partial().extend({ status: z.enum(['ACTIVE', 'SUSPENDED']).optional() });
export type UpdateTrainerInput = z.infer<typeof updateTrainerSchema>;

export const createClientSchema = z.object({
  email: emailSchema, username, password: passwordSchema, firstName: name, lastName: name, phone,
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional().or(z.literal('').transform(() => undefined)),
  sex: sexSchema.default('MALE'),
  heightCm: z.coerce.number().min(100).max(250).default(170),
  weightKg: z.coerce.number().min(25).max(350).optional(),
  goal: goalSchema.default('RECOMPOSITION'),
  activityLevel: activityLevelSchema.default('MODERATE'),
  trainingExperience: experienceSchema.default('BEGINNER'),
  emergencyContact: z.string().trim().max(120).optional(),
  injuries: z.string().trim().max(1000).optional(),
  trainerId: z.string().optional(),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = z.object({
  firstName: name.optional(), lastName: name.optional(), phone, username,
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('').transform(() => undefined)),
  status: z.enum(['ACTIVE', 'PAUSED', 'INACTIVE']).optional(),
  emergencyContact: z.string().trim().max(120).optional(),
  sex: sexSchema.optional(),
  heightCm: z.coerce.number().min(100).max(250).optional(),
  goal: goalSchema.optional(),
  activityLevel: activityLevelSchema.optional(),
  trainingExperience: experienceSchema.optional(),
  injuries: z.string().trim().max(1000).optional(),
});
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const adminSetPasswordSchema = z.object({ password: passwordSchema });

export interface TrainerListItem {
  id: string; userId: string; name: string; email: string; username: string | null; phone: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'INVITED'; clients: number; maxClients: number | null; specialties: string[]; bio: string | null;
}

export interface ClientListItem {
  id: string; userId: string; name: string; email: string; phone: string | null; status: 'ACTIVE' | 'PAUSED' | 'INACTIVE';
  goal: Goal | null; trainerId: string | null; trainerName: string | null; joinedAt: string;
  level: AttentionLevel; reasons: string[]; lastActivityAt: string | null; weightKg: number | null; membershipEnds: string | null;
}

export interface ClientDetail {
  id: string; userId: string; firstName: string; lastName: string; email: string; username: string | null; phone: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'INACTIVE'; accountStatus: 'ACTIVE' | 'SUSPENDED' | 'INVITED'; joinedAt: string; dateOfBirth: string | null; ageYears: number | null;
  emergencyContact: string | null; qrCode: string | null; trainerId: string | null; trainerName: string | null; notes: string | null;
  profile: { sex: Sex; heightCm: number; activityLevel: ActivityLevel; trainingExperience: Experience; goal: Goal; injuries: string | null } | null;
  attention: { level: AttentionLevel; reasons: string[] };
  membership: { name: string; endDate: string; status: string } | null;
  target: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; waterMl: number | null } | null;
}
